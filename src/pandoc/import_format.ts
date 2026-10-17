/* What pandoc can read a file as on the way into the vault, and what that reader can be asked to do. */

/** The markdown a note can be written in, in the order the dialog offers them. */
export const MARKDOWN_FLAVOURS = [
  'gfm',
  'markdown',
  'commonmark',
  'commonmark_x',
  'markdown_strict',
  'markdown_mmd',
  'markdown_phpextra',
] as const;

export type MarkdownFlavour = (typeof MARKDOWN_FLAVOURS)[number];

/**
 * GitHub's markdown, which is the one Obsidian's own is built on: tables, task lists, strikethrough, footnotes and
 * properties, and none of the pandoc-only syntax — fenced divs, attribute spans, definition lists — that the others
 * write and Obsidian prints as it stands.
 */
export const DEFAULT_MARKDOWN_FLAVOUR: MarkdownFlavour = 'gfm';

/**
 * The writer a flavour is actually asked for, where Obsidian reads something other than what the flavour writes by
 * default.
 */
const WRITERS: Partial<Record<MarkdownFlavour, string>> = {
  // `tex_math_gfm` is GitHub's own maths: `$`x`$` inline and a ```math block for display, neither of which Obsidian
  // renders. Without it the writer falls back to `tex_math_dollars`, which is what Obsidian reads.
  gfm: 'gfm-tex_math_gfm',
};

export const writerFor = (flavour: MarkdownFlavour): string => WRITERS[flavour] ?? flavour;

/**
 * What each extension is read as. Only the formats pandoc has a reader for — it writes pptx and asciidoc, for two,
 * and can read neither.
 */
const READERS: Record<string, string> = {
  docx: 'docx',
  odt: 'odt',
  fodt: 'fodt',
  epub: 'epub',
  rtf: 'rtf',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  tex: 'latex',
  latex: 'latex',
  ipynb: 'ipynb',
  rst: 'rst',
  org: 'org',
  textile: 'textile',
  wiki: 'mediawiki',
  dokuwiki: 'dokuwiki',
  muse: 'muse',
  djot: 'djot',
  creole: 'creole',
  t2t: 't2t',
  man: 'man',
  jats: 'jats',
  fb2: 'fb2',
  opml: 'opml',
  ris: 'ris',
  bib: 'biblatex',
  csv: 'csv',
  tsv: 'tsv',
  json: 'json',
  native: 'native',
  md: 'markdown',
  markdown: 'markdown',
};

/** Every extension the file dialog offers, most likely kind first. */
export const IMPORT_EXTENSIONS = Object.keys(READERS);

/** The reader for a file, by its extension — `undefined` where pandoc has none. */
export const readerFor = (file?: string): string | undefined => {
  const extension = /\.([^.\\/]+)$/.exec(file ?? '')?.[1].toLowerCase();
  return extension ? READERS[extension] : undefined;
};

const supportedBy = (readers: readonly string[]) => {
  const supported = new Set(readers);
  return (reader?: string): boolean => !!reader && supported.has(reader);
};

/** `--track-changes`: the one format that keeps what an editor did as well as what the document says. */
export const supportsTrackChanges = supportedBy(['docx']);

/** The readers whose documents carry no media to extract — a bibliography, a table, pandoc's own tree. */
const MEDIA_LESS = new Set(['biblatex', 'bibtex', 'csljson', 'ris', 'csv', 'tsv', 'native', 'json', 'man', 'opml', 't2t']);

/** `--extract-media`: "Extract images and other media contained in or linked from the source document". */
export const supportsExtractMedia = (reader?: string): boolean => !!reader && !MEDIA_LESS.has(reader);

/** The formats a word processor writes rather than anyone types, so nothing in them was ever indented with a tab. */
const BINARY_READERS = new Set(['docx', 'odt', 'fodt', 'epub', 'rtf']);

/** `--tab-stop`, which only means anything where the source is typed. */
export const supportsTabStop = (reader?: string): boolean => !!reader && !BINARY_READERS.has(reader);

/** `--strip-comments`: "Strip out HTML comments in the Markdown or Textile source". */
export const supportsStripComments = supportedBy(['markdown', 'html', 'textile']);

/** The readers with nothing to say about the document itself — no title, no author, no date. */
const METADATA_LESS = new Set(['csv', 'tsv', 'native', 'json']);

/** `--standalone`, which is what puts that title block into the note's properties. */
export const supportsMetadata = (reader?: string): boolean => !!reader && !METADATA_LESS.has(reader);
