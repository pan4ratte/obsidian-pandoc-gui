import type { ExportSetting } from '../settings';

// Template variables, for `/User/aaa/Documents/test.pdf`: `${outputDir}` is the folder,
// `${outputPath}` the whole path, `${outputFileName}` is `test`, `${outputFileFullName}` is
// `test.pdf`. The `current*` set says the same of the note being exported, and
// `${attachmentFolderPath}` comes from Obsidian's own settings.

/* What every template that carries images says, and what every template that renders a note for reading says. */
// The vault's own folder is on the list because a wikilink may be written as the whole path from the vault root —
// `![[Folder/folder/image.png]]` — which Obsidian reads against the vault and pandoc, given only the note's folder,
// cannot find at all.
const RESOURCE_PATHS = '--resource-path="${currentDir}" --resource-path="${attachmentFolderPath}" --resource-path="${vaultDir}"';
const EMBED_DIRS = '${ embedDirs ? `--resource-path="${embedDirs}"` : ` ` }';
/**
 * Obsidian's own image syntax, which pandoc's wikilink reader takes differently: the width written after the last
 * `|` is part of the description to it, and an embed that describes nothing is captioned with the file's own name.
 */
const WIKILINK_IMAGES = '--lua-filter="${luaDir}/wikilink_images.lua"';
/** What a template carrying images needs: where to look for them, and what the note means by naming them. */
const IMAGES = `${RESOURCE_PATHS} ${EMBED_DIRS} ${WIKILINK_IMAGES}`;
/** Two things every template that renders a note for reading starts with. */
const OBSIDIAN_SYNTAX = '--lua-filter="${luaDir}/embeds.lua" -f ${fromFormat}+mark';

/** Reassembles a `$$…$$` block the reader broke up over a LaTeX environment. */
const MATH_BLOCK = '--lua-filter="${luaDir}/math_block.lua"';

/**
 * The Styles rows a Word export starts with: an image with no caption is styled as a figure rather than left in body
 * text, and a table cell is left alone rather than stamped "Compact". Both create the style they name if the document
 * has none, so neither has anything to go wrong without a reference document.
 *
 * The list styles are not here, and cannot be: they hand the bullets over to the document's own List Bullet, and
 * pandoc's stock reference document defines that style without any numbering in it — the bullets would simply be
 * blank. The row switches itself on with the reference document instead; see `SettingTab`.
 */
const WORD_STYLES = '--lua-filter="${luaDir}/figures.lua" --lua-filter="${luaDir}/table-styles.lua"';

export default {
  'Markdown': {
    name: 'Markdown',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Markdown (GFM)': {
    name: 'Markdown (GFM)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t gfm`,
    extension: '.md',
  },
  'Markdown (Hugo)': {
    name: 'Markdown (Hugo)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown+hugo.lua" -s -o "\${outputPath}" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Html': {
    name: 'Html',
    type: 'pandoc',
    // `-V pagetitle` rather than `-M title`: the page needs a title, but a note that gives itself one in its
    // frontmatter has said what it is, and `--metadata` would overrule it.
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} --embed-resources --standalone -V pagetitle="\${currentFileName}" -s -o "\${outputPath}" -t html`,
    customArguments: `--mathjax="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js" ${OBSIDIAN_SYNTAX}`,
    extension: '.html',
  },
  'TextBundle': {
    name: 'TextBundle',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -V media_dir="\${outputDir}/\${outputFileName}.textbundle/assets" -s -o "\${outputDir}/\${outputFileName}.textbundle/text.md" -t commonmark_x-attributes`,
    extension: '.md',
  },
  'Typst': {
    name: 'Typst',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/markdown.lua" -s -o "\${outputPath}" -t typst`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.typ',
  },
  'PDF': {
    name: 'PDF',
    type: 'pandoc',
    // `math_block` before `pdf`: the first puts a broken `$$…$$` back together, the second is what the engine then
    // needs made of it.
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} --lua-filter="\${luaDir}/pdf.lua" \${ options.textemplate ? \`--resource-path="\${pluginDir}/textemplate" --template="\${options.textemplate}"\` : \` \` } -o "\${outputPath}" -t pdf`,
    // XeLaTeX rather than pdfLaTeX: pdfLaTeX cannot set a character it has no 8-bit font for, so a note with
    // Cyrillic, CJK or an emoji in it does not export at all.
    customArguments: `--pdf-engine=xelatex ${OBSIDIAN_SYNTAX}`,
    optionsMeta: {
      'textemplate': 'preset:textemplate', // reference from `PresetOptionsMeta` in `src/settings.ts`
    },
    extension: '.pdf',
  },
  'PDF (Typst)': {
    name: 'PDF (Typst)',
    type: 'pandoc',
    // `-t typst` with a `.pdf` to write: pandoc reads the extension and runs the typesetter over what the typst
    // writer produced. The same command works both ways — on an installed pandoc with typst beside it, and on the
    // wasm build, which carries its own typst and needs nothing installed. See `src/wasm/typst.ts`.
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -s -o "\${outputPath}" -t typst`,
    customArguments: `--pdf-engine=typst ${OBSIDIAN_SYNTAX}`,
    extension: '.pdf',
  },
  'Beamer slides (.pdf)': {
    name: 'Beamer slides',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -s -o "\${outputPath}" -t beamer`,
    customArguments: `--pdf-engine=xelatex ${OBSIDIAN_SYNTAX}`,
    extension: '.pdf',
  },
  'Reveal.js slides (.html)': {
    name: 'Reveal.js slides',
    type: 'pandoc',
    // One file that opens in a browser. reveal.js itself is still fetched from its CDN — `--embed-resources` carries
    // the note's own images, not the library laying them out.
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} --embed-resources --standalone -s -o "\${outputPath}" -t revealjs`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.html',
  },
  'Word (.docx)': {
    name: 'Word (.docx)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -o "\${outputPath}" -t docx`,
    customArguments: `${OBSIDIAN_SYNTAX} ${WORD_STYLES}`,
    extension: '.docx',
  },
  'OpenOffice': {
    name: 'OpenOffice',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -o "\${outputPath}" -t odt`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.odt',
  },
  'RTF': {
    name: 'RTF',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t rtf`,
    extension: '.rtf',
  },
  'Epub': {
    name: 'Epub',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -o "\${outputPath}" -t epub`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.epub',
  },
  'Latex': {
    name: 'Latex',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} \${ options.textemplate ? \`--resource-path="\${pluginDir}/textemplate" --template="\${options.textemplate}"\` : \` \` } --extract-media="\${outputDir}" -s -o "\${outputPath}" -t latex`,
    customArguments: OBSIDIAN_SYNTAX,
    optionsMeta: {
      'textemplate': 'preset:textemplate', // reference from `PresetOptionsMeta` in `src/settings.ts`
    },
    extension: '.tex',
  },
  'LaTeX fragment (.tex)': {
    name: 'LaTeX fragment',
    type: 'pandoc',
    // No `-s`: the body alone, for pasting into a document that already has a preamble — an Overleaf project, a
    // journal's class file.
    arguments: `-f \${fromFormat} ${IMAGES} --extract-media="\${outputDir}" -o "\${outputPath}" -t latex`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.tex',
  },
  'Media Wiki': {
    name: 'Media Wiki',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t mediawiki`,
    extension: '.mediawiki',
  },
  'reStructuredText': {
    name: 'reStructuredText',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t rst`,
    extension: '.rst',
  },
  'Textile': {
    name: 'Textile',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t textile`,
    extension: '.textile',
  },
  'OPML': {
    name: 'OPML',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t opml`,
    extension: '.opml',
  },
  'Plain text (.txt)': {
    name: 'Plain text',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} -s -o "\${outputPath}" -t plain`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.txt',
  },
  'Bibliography (.bib)': {
    name: 'Bibliography',
    type: 'pandoc',
    // The note itself is not named here: `export.ts` puts `"${currentPath}"` ahead of these arguments already, and
    // naming it twice had pandoc read the note twice.
    arguments: `-f \${fromFormat} ${RESOURCE_PATHS} --lua-filter="\${luaDir}/citefilter.lua" -o "\${outputPath}" --to=bibtex`,
    extension: '.bib',
  },
  'PowerPoint (.pptx)': {
    name: 'PowerPoint (.pptx)',
    type: 'pandoc',
    arguments: `-f \${fromFormat} ${IMAGES} ${MATH_BLOCK} -o "\${outputPath}" -t pptx`,
    customArguments: OBSIDIAN_SYNTAX,
    extension: '.pptx',
  },
  'Custom': {
    name: 'Custom',
    type: 'custom',
    command: 'your command',
    targetFileExtensions: '.ext',
  },
} satisfies Record<string, ExportSetting> as Record<string, ExportSetting>;
