import { commandToDefaults, readablePaths, rewritePaths } from '../../src/wasm/defaults';
import export_templates from '../../src/templates/export_templates';
import { renderTemplate } from '../../src/templates/template';

/** The options a command comes down to, which is all most of these care about. */
const options = (cmd: string) => commandToDefaults(cmd).defaults;

describe('commandToDefaults', () => {
  test('reads the formats and the output file', () => {
    expect(options('pandoc "in.md" -f markdown -t html -o "out.html"')).toMatchObject({
      from: 'markdown',
      to: 'html',
      'output-file': 'out.html',
    });
  });

  test('reads every spelling of an option', () => {
    expect(options('pandoc --to=html')).toMatchObject({ to: 'html' });
    expect(options('pandoc --to html')).toMatchObject({ to: 'html' });
    expect(options('pandoc -t html')).toMatchObject({ to: 'html' });
    expect(options('pandoc -thtml')).toMatchObject({ to: 'html' });
    expect(options('pandoc --write html')).toMatchObject({ to: 'html' });
  });

  test('the file being read is not an option', () => {
    const { inputFiles, defaults } = commandToDefaults('pandoc "C:/vault/A note.md" -t html');
    expect(inputFiles).toEqual(['C:/vault/A note.md']);
    expect(defaults['input-files']).toBeUndefined();
  });

  test('a flag is true, and switches off where it is written to', () => {
    expect(options('pandoc -s --number-sections')).toMatchObject({ standalone: true, 'number-sections': true });
    expect(options('pandoc --epub-title-page=false')).toMatchObject({ 'epub-title-page': false });
  });

  test('numbers are numbers, which is what a defaults file expects', () => {
    expect(options('pandoc --toc-depth 3 --columns=72 --shift-heading-level-by=-1')).toMatchObject({
      'toc-depth': 3,
      columns: 72,
      'shift-heading-level-by': -1,
    });
  });

  test('the options with two names land on the one key', () => {
    expect(options('pandoc --toc')).toMatchObject({ 'table-of-contents': true });
    expect(options('pandoc --lof --lot')).toMatchObject({ 'list-of-figures': true, 'list-of-tables': true });
    expect(options('pandoc --id-prefix ch1')).toMatchObject({ 'identifier-prefix': 'ch1' });
    expect(options('pandoc --highlight-style kate')).toMatchObject({ 'syntax-highlighting': 'kate' });
    expect(options('pandoc --no-highlight')).toMatchObject({ 'syntax-highlighting': 'none' });
  });

  test('repeated options collect into a list', () => {
    expect(options('pandoc -c a.css --css b.css')).toMatchObject({ css: ['a.css', 'b.css'] });
    expect(options('pandoc --resource-path="/a" --resource-path="/b"')).toMatchObject({ 'resource-path': ['/a', '/b'] });
  });

  test('variables and metadata collect into a map, and a bare one is true', () => {
    expect(options('pandoc -V papersize=a4 -V lang=ru -M title="A note"')).toMatchObject({
      variables: { papersize: 'a4', lang: 'ru' },
      metadata: { title: 'A note' },
    });
    expect(options('pandoc -V draft')).toMatchObject({ variables: { draft: true } });
  });

  test('filters keep the order they were written in, citeproc among them', () => {
    expect(options('pandoc -L "a.lua" --citeproc --lua-filter="b.lua"')).toMatchObject({
      filters: [{ type: 'lua', path: 'a.lua' }, 'citeproc', { type: 'lua', path: 'b.lua' }],
    });
  });

  test('the maths method is one key, with the build it loads', () => {
    expect(options('pandoc --mathjax="https://example.com/tex.js"')).toMatchObject({
      'html-math-method': { method: 'mathjax', url: 'https://example.com/tex.js' },
    });
    expect(options('pandoc --mathml')).toMatchObject({ 'html-math-method': { method: 'mathml' } });
  });

  test('the option pandoc 3.11 renamed those to lands on the same key, which every build reads', () => {
    expect(options('pandoc --math-method=katex')).toMatchObject({ 'html-math-method': { method: 'katex' } });
    expect(options('pandoc --math-method mathml')).toMatchObject({ 'html-math-method': { method: 'mathml' } });
    expect(options('pandoc --math-method="mathjax:https://example.com/tex.js"')).toMatchObject({
      'html-math-method': { method: 'mathjax', url: 'https://example.com/tex.js' },
    });
    expect(options('pandoc --math-method=plain')).toMatchObject({ 'html-math-method': { method: 'plain' } });
  });

  test('the citation method is one key too, and citeproc is still a filter rather than a value of it', () => {
    expect(options('pandoc --natbib')).toMatchObject({ 'cite-method': 'natbib' });
    expect(options('pandoc --biblatex')).toMatchObject({ 'cite-method': 'biblatex' });
    expect(options('pandoc --citeproc')).toMatchObject({ filters: ['citeproc'] });
    expect(commandToDefaults('pandoc --natbib').unsupported).toEqual([]);
  });

  test('a path with spaces in it survives, quotes and all', () => {
    expect(options('pandoc --reference-doc="C:/My Files/ref.docx"')).toMatchObject({ 'reference-doc': 'C:/My Files/ref.docx' });
  });

  test('names what this build cannot do rather than dropping it silently', () => {
    const { unsupported } = commandToDefaults('pandoc --filter=pandoc-crossref --frobnicate');
    expect(unsupported).toEqual(['--filter=pandoc-crossref', '--frobnicate']);
  });

  test('options that need a system are left out without complaint', () => {
    const { defaults, unsupported } = commandToDefaults('pandoc --data-dir /x --quiet -t html');
    expect(defaults).toEqual({ to: 'html' });
    expect(unsupported).toEqual([]);
  });
});

describe('the bundled templates', () => {
  // The `${...}` a template writes, filled in as `exportNote` fills them.
  const variables = {
    currentDir: '/vault/Notes',
    currentPath: '/vault/Notes/note.md',
    currentFileName: 'note',
    attachmentFolderPath: '/vault/Attachments',
    embedDirs: '/vault/Images',
    outputDir: '/out',
    outputPath: '/out/note.docx',
    outputFileName: 'note',
    pluginDir: '/vault/.config/plugins/pandoc-gui',
    luaDir: '/vault/.config/plugins/pandoc-gui/lua',
    fromFormat: 'markdown+wikilinks_title_after_pipe',
    options: {},
  };

  const command = (template: { arguments?: string; customArguments?: string }) =>
    renderTemplate(`pandoc "\${currentPath}" ${template.arguments} ${template.customArguments ?? ''}`.trim(), variables);

  const pandocTemplates = Object.entries(export_templates).filter(([, template]) => template.type === 'pandoc');

  test('are read without anything left over', () => {
    for (const [name, template] of pandocTemplates) {
      const { unsupported } = commandToDefaults(command(template as never));
      expect({ name, unsupported }).toEqual({ name, unsupported: [] });
    }
  });

  test('every one of them names what it reads and what it writes', () => {
    for (const [name, template] of pandocTemplates) {
      const { defaults, inputFiles } = commandToDefaults(command(template as never));
      expect({ name, input: inputFiles, to: !!defaults.to, out: !!defaults['output-file'] }).toEqual({
        name,
        input: ['/vault/Notes/note.md'],
        to: true,
        out: true,
      });
    }
  });

  test('the Word preset comes out as the options pandoc names', () => {
    const { defaults } = commandToDefaults(command(export_templates['Word (.docx)'] as never));
    expect(defaults.to).toBe('docx');
    expect(defaults['output-file']).toBe('/out/note.docx');
    expect(defaults['resource-path']).toEqual(['/vault/Notes', '/vault/Attachments', '/vault/Images']);
    // embeds, math_block, figures and table-styles.
    expect(defaults.filters).toHaveLength(4);
  });
});

describe('rewritePaths', () => {
  /** Two maps told apart, so a path put through the wrong one is visible. */
  const move = { file: (path: string) => `file:${path}`, directory: (path: string) => `dir:${path}` };

  test('moves every path, each through the map that suits it', () => {
    const { defaults } = commandToDefaults(
      'pandoc "in.md" -o "out.html" --css "a.css" --reference-doc "r.docx" -L "f.lua" --resource-path "/a" --extract-media "m" -V lang=ru'
    );
    rewritePaths(defaults, move);
    expect(defaults).toMatchObject({
      'output-file': 'file:out.html',
      'css': ['file:a.css'],
      'reference-doc': 'file:r.docx',
      'filters': [{ type: 'lua', path: 'file:f.lua' }],
      // A folder to search and a folder to write into are folders, not files.
      'resource-path': ['dir:/a'],
      'extract-media': 'dir:m',
      'variables': { lang: 'ru' },
    });
  });

  test('moves each path once — a second pass would move what the first already had', () => {
    const { defaults } = commandToDefaults('pandoc "in.md" --resource-path "/a" -o "out.html"');
    rewritePaths(defaults, move);
    expect(defaults['resource-path']).toEqual(['dir:/a']);
    expect(defaults['output-file']).toBe('file:out.html');
  });

  test('the files that have to be readable are the ones pandoc opens', () => {
    const { defaults } = commandToDefaults(
      'pandoc "in.md" -o "out.html" --css "a.css" -L "f.lua" --resource-path "/a" --extract-media "m"'
    );
    // Not the output, not the media folder, and not a folder to search.
    expect(readablePaths(defaults).sort()).toEqual(['a.css', 'f.lua']);
  });
});
