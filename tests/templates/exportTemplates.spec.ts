import { readdirSync } from 'fs';
import path from 'path';
import export_templates from '../../src/templates/export_templates';
import {
  FIGURE_DEFAULT_STYLE,
  TABLE_DEFAULT_STYLE,
  figureStyle,
  flattenOrdered,
  listStyles,
  tableStyle,
} from '../../src/filters/filter_args';
import { DEFAULT_TEMPLATE_PRESETS } from '../../src/settings';
import { renderTemplate } from '../../src/system/utils';

/*
 * A preset is a command line with holes in it, and nothing type-checks the holes: a variable that is never filled in,
 * or an input file named twice, reads perfectly well right up until pandoc is handed it.
 */

const VARIABLES = {
  pluginDir: '/vault/config/plugins/x',
  luaDir: '/vault/config/plugins/x/lua',
  outputDir: '/out',
  outputPath: '/out/Note.docx',
  outputFileName: 'Note',
  outputFileFullName: 'Note.docx',
  currentDir: '/vault/Notes',
  currentPath: '/vault/Notes/Note.md',
  currentFileName: 'Note',
  currentFileFullName: 'Note.md',
  attachmentFolderPath: '/vault/Attachments',
  vaultDir: '/vault',
  metadata: null as unknown,
  embedDirs: '/vault/Notes/Note-attachments',
  options: {} as Record<string, unknown>,
  fromFormat: 'markdown+wikilinks_title_after_pipe',
};

/** The command line as `export.ts` builds it, for a pandoc preset. */
const render = (preset: string, variables: Record<string, unknown> = { ...VARIABLES }) => {
  const template = export_templates[preset];
  if (template.type !== 'pandoc') {
    throw new Error(`${preset} is not a pandoc template`);
  }
  const cmdTpl = ['pandoc', '"${currentPath}"', template.arguments, template.customArguments]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ');
  return renderTemplate(cmdTpl, variables);
};

const pandocPresets = Object.entries(export_templates)
  .filter(([, t]) => t.type === 'pandoc')
  .map(([key]) => key);

describe('every preset renders a command', () => {
  test.each(pandocPresets)('%s', preset => {
    const cmd = render(preset);
    // A variable nothing filled in is left as `${name}` rather than throwing, so an unrenderable command reaches
    // pandoc looking almost right.
    expect(cmd).not.toMatch(/\$\{/);
    expect(cmd).toContain('-o "/out/');
    // The note is an argument, not an option's value: naming it twice makes pandoc read it twice and write the
    // document out doubled.
    expect(cmd.split('"/vault/Notes/Note.md"')).toHaveLength(2);
  });

  test('a note that embeds nothing is not given an empty resource path', () => {
    for (const preset of pandocPresets) {
      const cmd = render(preset, { ...VARIABLES, embedDirs: '' });
      expect(cmd).not.toContain('--resource-path=""');
    }
  });

  test('the folders of embedded files are on the resource path of what carries images', () => {
    for (const preset of ['PDF', 'Word (.docx)', 'OpenOffice', 'Html', 'Epub', 'PowerPoint (.pptx)', 'Latex']) {
      expect(render(preset)).toContain('--resource-path="/vault/Notes/Note-attachments"');
    }
  });

  test('and so is the vault itself, which is what a link written as a whole path is read against', () => {
    // `![[Folder/folder/image.png]]`: Obsidian reads it from the vault root, and pandoc given only the note's own
    // folder cannot find it at all.
    for (const preset of ['PDF', 'Word (.docx)', 'OpenOffice', 'Html', 'Epub', 'PowerPoint (.pptx)', 'Latex', 'Markdown']) {
      expect(render(preset)).toContain('--resource-path="/vault"');
    }
  });

  test('what carries images reads Obsidian’s own way of naming them', () => {
    for (const preset of ['PDF', 'Word (.docx)', 'OpenOffice', 'Html', 'Epub', 'PowerPoint (.pptx)', 'Latex']) {
      expect(render(preset)).toContain('wikilink_images.lua');
    }
  });
});

describe('what the defaults are', () => {
  test('every seeded preset exists, and none of them is the custom one', () => {
    for (const preset of DEFAULT_TEMPLATE_PRESETS) {
      expect(export_templates[preset]).toBeDefined();
      expect(export_templates[preset].type).toBe('pandoc');
    }
  });

  test('the list is shorter than the presets it is drawn from', () => {
    // The point of the list: every format pandoc writes is still offered under *New template*, but an export dropdown
    // opens with the ones people export.
    expect(DEFAULT_TEMPLATE_PRESETS.length).toBeLessThan(pandocPresets.length);
  });
});

describe('the corrections these presets carry', () => {
  test('PDF is written by an engine that can set the whole of Unicode', () => {
    expect(render('PDF')).toContain('--pdf-engine=xelatex');
    expect(render('PDF')).not.toContain('pdflatex');
  });

  test('a bibliography is read from the note once', () => {
    const cmd = render('Bibliography (.bib)');
    expect(cmd.split('"/vault/Notes/Note.md"')).toHaveLength(2);
    expect(cmd).toContain('--to=bibtex');
  });

  test("HTML asks for a page title without overruling the note's own", () => {
    const cmd = render('Html');
    expect(cmd).toContain('-V pagetitle="Note"');
    expect(cmd).not.toContain('--metadata title');
  });

  test("Obsidian's own markdown is read where a document is rendered for reading", () => {
    for (const preset of ['PDF', 'Word (.docx)', 'Html', 'Epub', 'Latex', 'Beamer slides (.pdf)']) {
      // Last `-f` wins, so this is the one pandoc reads by — the preset's own `-f ${fromFormat}` stands ahead of it.
      // Which of them comes last is the whole assertion; what follows on the line is filters, and they are not read by.
      const from = [...render(preset).matchAll(/-f (\S+)/g)];
      expect(from[from.length - 1][1]).toBe('markdown+wikilinks_title_after_pipe+mark');
    }
  });

  test('a new Word template comes with the style tweaks that work on their own', () => {
    // Read back through the rows' own readers: what the editor shows ticked is the whole point of the default.
    const args = (export_templates['Word (.docx)'] as { customArguments: string }).customArguments;
    expect(figureStyle(args)).toBe(FIGURE_DEFAULT_STYLE);
    expect(tableStyle(args)).toBe(TABLE_DEFAULT_STYLE);
    // Measured against pandoc's stock reference document: it defines List Bullet with no numbering of its own, so
    // handing it the bullets before the user has named a document of theirs leaves a bullet list with none. The row
    // switches itself on with the reference document instead.
    expect(listStyles(args)).toBe(false);
    expect(flattenOrdered(args)).toBe(false);
  });

  test('callouts are left to the extensions row, which is where the caveat belongs', () => {
    // Measured, not assumed: pandoc's `alerts` reads `> [!NOTE]`, and Obsidian writes `> [!note]`, which it leaves as
    // a plain blockquote.
    for (const preset of pandocPresets) {
      expect(render(preset)).not.toContain('+alerts');
    }
  });

  test('the lua filters named are ones the plugin still ships', () => {
    // Read off the folder rather than listed here: a preset naming a filter that is not written to `lua/` fails every
    // export it is used for, and a list in a test is one more thing to forget to update.
    const shipped = readdirSync(path.join(import.meta.dirname, '..', '..', 'lua-filters', 'bundled'));
    for (const preset of pandocPresets) {
      for (const [, file] of render(preset).matchAll(/--lua-filter="[^"]*\/([^"/]+)"/g)) {
        expect(shipped).toContain(file);
      }
    }
  });

  test('a note that embeds another is written out whole, wherever it is read', () => {
    // Transclusion is Obsidian's own, and every format that renders a note for reading has to answer to it.
    for (const preset of ['PDF', 'Word (.docx)', 'Html', 'Epub', 'Latex', 'Typst', 'PowerPoint (.pptx)']) {
      expect(render(preset)).toContain('embeds.lua');
    }
    for (const preset of ['Markdown', 'Markdown (GFM)', 'Markdown (Hugo)', 'TextBundle', 'Bibliography (.bib)']) {
      expect(render(preset)).not.toContain('embeds.lua');
    }
  });
});
