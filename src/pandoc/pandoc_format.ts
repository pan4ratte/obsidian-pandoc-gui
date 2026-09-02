import type { CuratedVariable } from '../args/writer_args';

/* What a template writes, and what that writer can be asked to do. */

/** The `-t`/`--to` a template ends up passing, without any `+extensions`. */
export const outputFormat = (...args: (string | undefined)[]): string | undefined => {
  let writer: string | undefined;
  for (const arg of args) {
    for (const [, found] of (arg ?? '').matchAll(/(?:^|\s)(?:-t|--to)[= ]"?([\w.+-]+)/g)) {
      writer = found;
    }
  }
  // `commonmark_x-attributes` is the commonmark_x writer; no writer's own name carries a `+` or `-`, so the first one
  // starts the extension list.
  return writer?.toLowerCase().split(/[+-]/)[0] || undefined;
};

/**
 * Writers that ignore `--toc`, measured against pandoc 3.10 by writing the same document with and without it and
 * comparing the results.
 */
const TOC_UNSUPPORTED = new Set([
  'ansi',
  'asciidoc',
  'asciidoc_legacy',
  'asciidoctor',
  'bbcode',
  'bbcode_fluxbb',
  'bbcode_hubzilla',
  'bbcode_phpbb',
  'bbcode_steam',
  'bbcode_xenforo',
  'biblatex',
  'bibtex',
  'csljson',
  'djot',
  'docbook',
  'docbook4',
  'docbook5',
  'fb2',
  'haddock',
  'icml',
  'jats',
  'jats_archiving',
  'jats_articleauthoring',
  'jats_publishing',
  'jira',
  'json',
  'man',
  'muse',
  'native',
  'opml',
  'org',
  's5',
  'tei',
  'textile',
  'xml',
]);

/** Whether asking this writer for a table of contents would do anything. */
export const supportsToc = (writer?: string): boolean => !!writer && !TOC_UNSUPPORTED.has(writer);

/* The rest of the writer options the template modal offers. */
const supportedBy = (writers: readonly string[]) => {
  const supported = new Set(writers);
  return (writer?: string): boolean => !!writer && supported.has(writer);
};

/** "Number section headings in LaTeX, ConTeXt, HTML, Docx, ms, or EPUB output." */
export const supportsNumberSections = supportedBy([
  'latex',
  'beamer',
  'pdf',
  'context',
  'html',
  'html4',
  'html5',
  'chunkedhtml',
  'docx',
  'ms',
  'epub',
  'epub2',
  'epub3',
]);

/** `--number-offset`: "Currently this feature only affects HTML and Docx output." */
export const supportsNumberOffset = supportedBy(['html', 'html4', 'html5', 'chunkedhtml', 'docx']);

/** `--lof` and `--lot`, "supported in latex, context, and docx output". */
export const supportsSectionLists = supportedBy(['latex', 'pdf', 'context', 'docx']);

/** `--top-level-division`, honoured "in LaTeX, ConTeXt, DocBook, and TEI output". */
export const supportsTopLevelDivision = supportedBy(['latex', 'pdf', 'context', 'docbook', 'docbook4', 'docbook5', 'tei']);

/** The writers that colour code at all; the rest print it as it stands. */
export const supportsHighlighting = supportedBy([
  'latex',
  'beamer',
  'pdf',
  'context',
  'html',
  'html4',
  'html5',
  'chunkedhtml',
  'revealjs',
  'slidy',
  'slideous',
  'dzslides',
  's5',
  'docx',
  'odt',
  'opendocument',
  'ms',
  'typst',
  'epub',
  'epub2',
  'epub3',
]);

/**
 * Where a maths method is a question at all: the flags each name a way of getting TeX into HTML, so only the writers
 * that produce HTML have an answer.
 */
export const supportsMathMethod = supportedBy([
  'html',
  'html4',
  'html5',
  'chunkedhtml',
  'revealjs',
  'slidy',
  'slideous',
  'dzslides',
  's5',
  'epub',
  'epub2',
  'epub3',
]);

/** Whether pandoc will be handing the document to a PDF engine. */
export const isPdfOutput = (writer?: string): boolean => writer === 'pdf';

/** `--reference-doc`: "a style reference in producing a docx or ODT file", and pptx. */
export const supportsReferenceDoc = supportedBy(['docx', 'odt', 'pptx']);

/**
 * The writers that read a `custom-style` Div and set the named style on what is inside it — the two word processors,
 * and not pptx, whose writer has no such thing.
 */
export const supportsCustomStyle = supportedBy(['docx', 'odt']);

/**
 * `--template`, the counterpart of the reference document: the writers that lay their output out with a template of
 * pandoc's that one of the user's can stand in for.
 */
const TEMPLATE_UNSUPPORTED = new Set(['biblatex', 'bibtex', 'csljson', 'docx', 'ipynb', 'json', 'native', 'odt', 'opendocument', 'pptx']);

export const supportsTemplate = (writer?: string): boolean => !!writer && !TEMPLATE_UNSUPPORTED.has(writer);

/**
 * The writer a PDF engine lays its pages out with, for the engines that are not LaTeX. `-t pdf` names no writer of its
 * own: pandoc picks one from the engine, and it is that one whose template a `--template` stands in for.
 */
const PDF_TEMPLATE_WRITERS: Record<string, string> = {
  typst: 'typst',
  context: 'context',
  weasyprint: 'html',
  'pagedjs-cli': 'html',
  prince: 'html',
  wkhtmltopdf: 'html',
  groff: 'ms',
  pdfroff: 'ms',
};

/**
 * The extension pandoc adds to a `--template` that is named without one — `special` is `special.html` for HTML — or
 * nothing where the writer lays nothing out with a template.
 *
 * The extension is the writer's own name, which is not always the name of the language it writes: `-t html5` wants
 * `.html5`. Measured against pandoc 3.10 by asking it for a template that is not there and reading back the file it
 * says it looked for.
 */
export const templateExtension = (writer?: string, pdfEngine?: string): string | undefined => {
  if (!supportsTemplate(writer)) {
    return undefined;
  }
  return `.${isPdfOutput(writer) ? (PDF_TEMPLATE_WRITERS[pdfEngine ?? ''] ?? 'latex') : writer}`;
};

/** `--eol`: the writers whose output is a text file with lines to end. */
const EOL_UNSUPPORTED = new Set(['docx', 'odt', 'opendocument', 'pptx', 'epub', 'epub2', 'epub3', 'pdf']);

export const supportsEol = (writer?: string): boolean => !!writer && !EOL_UNSUPPORTED.has(writer);

/** `--css`: "only affects HTML (including HTML slide shows) and EPUB output". */
export const supportsCss = supportedBy([
  'html',
  'html4',
  'html5',
  'chunkedhtml',
  'revealjs',
  'slidy',
  'slideous',
  'dzslides',
  's5',
  'epub',
  'epub2',
  'epub3',
]);

/*
 * The include files, which the manual gives no list for: what happens to them is up to each writer's template, so the
 * two sets below were measured against pandoc 3.10 the way `--toc` was — the same document written with each option
 * and searched for the file's contents.
 */
const INCLUDES_UNSUPPORTED = new Set([
  'bbcode',
  'bbcode_fluxbb',
  'bbcode_hubzilla',
  'bbcode_phpbb',
  'bbcode_steam',
  'bbcode_xenforo',
  'csljson',
  'fb2',
  'haddock',
  'icml',
  'ipynb',
  'jats',
  'jats_archiving',
  'jats_articleauthoring',
  'jats_publishing',
  'json',
  'native',
  'opml',
  'pptx',
  'vimdoc',
  'xml',
]);

/** Whether `--include-before-body` and `--include-after-body` reach the output. */
export const supportsIncludes = (writer?: string): boolean => !!writer && !INCLUDES_UNSUPPORTED.has(writer);

/** The writers with a body to include around but no header to include into. */
const HEADER_UNSUPPORTED = new Set([
  'docbook',
  'docbook4',
  'docbook5',
  'docx',
  'dokuwiki',
  'jira',
  'mediawiki',
  't2t',
  'tei',
  'textile',
  'xwiki',
  'zimwiki',
]);

/** Whether `--include-in-header` reaches the output. */
export const supportsHeaderInclude = (writer?: string): boolean => supportsIncludes(writer) && !HEADER_UNSUPPORTED.has(writer);

/* The curated template variables, and who reads them. */
const HTML_WRITERS = ['html', 'html4', 'html5', 'chunkedhtml'] as const;
const EPUB_WRITERS = ['epub', 'epub2', 'epub3'] as const;
const LATEX_WRITERS = ['latex', 'beamer', 'pdf'] as const;

/**
 * `dir`: the writers that do something with a direction. The two word processors read it from the metadata, which
 * pandoc 3.11 taught them; the HTML and EPUB templates put it on the `html` element, as they always have.
 */
export const supportsTextDirection = supportedBy(['docx', 'odt', 'opendocument', ...HTML_WRITERS, ...EPUB_WRITERS]);

export const supportsVariable: Record<CuratedVariable, (writer?: string) => boolean> = {
  papersize: supportedBy(['latex', 'pdf', 'context', 'ms', 'typst', ...EPUB_WRITERS]),
  fontsize: supportedBy([...LATEX_WRITERS, 'context', 'typst', 'odt', ...HTML_WRITERS]),
  mainfont: supportedBy([...LATEX_WRITERS, 'context', 'typst', ...HTML_WRITERS, ...EPUB_WRITERS]),
  // The geometry package is LaTeX's; ConTeXt and Typst lay a page out their own way.
  geometry: supportedBy([...LATEX_WRITERS]),
  linkcolor: supportedBy([...LATEX_WRITERS, 'context', 'typst', ...HTML_WRITERS]),
  lang: supportedBy([
    ...LATEX_WRITERS,
    'context',
    'typst',
    ...HTML_WRITERS,
    ...EPUB_WRITERS,
    'revealjs',
    'slidy',
    'slideous',
    'dzslides',
    's5',
    'docx',
    'odt',
    'docbook',
    'docbook5',
    'tei',
    'muse',
  ]),
};

/**
 * `--ascii`: "Currently supported only for XML and HTML formats (which use entities instead of UTF-8 when this option
 * is selected), CommonMark, gfm, and Markdown (which use entities), roff ms (which use hexadecimal escapes), and to a
 * limited degree LaTeX (which uses standard commands for accented characters when possible)."
 */
export const supportsAscii = supportedBy([
  ...HTML_WRITERS,
  ...EPUB_WRITERS,
  ...LATEX_WRITERS,
  'docbook',
  'docbook4',
  'docbook5',
  'jats',
  'jats_archiving',
  'jats_articleauthoring',
  'jats_publishing',
  'tei',
  'opml',
  'xml',
  'markdown',
  'markdown_strict',
  'markdown_mmd',
  'markdown_phpextra',
  'markdown_github',
  'commonmark',
  'commonmark_x',
  'gfm',
  'ms',
]);

/*
 * The format-specific rows: a group each for the source a text writer produces, for slides, for EPUB, for a page, and
 * for the media a document carries.
 */

/** The slide shows, which are also a family a lua filter can be written for. */
const SLIDE_WRITERS = ['revealjs', 'slidy', 'slideous', 'dzslides', 's5', 'beamer', 'pptx'] as const;

/** A page, in the writers that produce one: HTML, its slide shows, chunked HTML. */
const HTML_PAGE_WRITERS = ['html', 'html4', 'html5', 'chunkedhtml', 'revealjs', 'slidy', 'slideous', 'dzslides', 's5'] as const;

/** The writers that wrap what they write. */
const WRAP_UNSUPPORTED = new Set([
  'bbcode',
  'bbcode_fluxbb',
  'bbcode_hubzilla',
  'bbcode_phpbb',
  'bbcode_steam',
  'bbcode_xenforo',
  'csljson',
  'docx',
  'dokuwiki',
  'epub',
  'epub2',
  'epub3',
  'fb2',
  'icml',
  'ipynb',
  'jira',
  'json',
  'native',
  'odt',
  'pptx',
  'rtf',
  't2t',
  'vimdoc',
  'xml',
  'xwiki',
  'zimwiki',
]);

/** `--wrap`, and the `--columns` it wraps at. */
export const supportsWrap = (writer?: string): boolean => !!writer && !WRAP_UNSUPPORTED.has(writer);

/** `--markdown-headings`: the writers with two ways of writing one. */
export const supportsMarkdownHeadings = supportedBy([
  'markdown',
  'markdown_strict',
  'markdown_mmd',
  'markdown_phpextra',
  'markdown_github',
  'commonmark',
  'commonmark_x',
  'gfm',
  'markua',
]);

/** `--reference-links`, in the writers with a reference link to write. */
export const supportsReferenceLinks = supportedBy([
  'markdown',
  'markdown_strict',
  'markdown_mmd',
  'markdown_phpextra',
  'markdown_github',
  'commonmark',
  'commonmark_x',
  'gfm',
  'markua',
  'djot',
  'plain',
  'rst',
]);

/** `--reference-location`: where the footnotes are put, once there are some. */
export const supportsReferenceLocation = supportedBy([
  'markdown',
  'markdown_strict',
  'markdown_mmd',
  'markdown_phpextra',
  'markdown_github',
  'commonmark',
  'commonmark_x',
  'gfm',
  'markua',
  'muse',
  'plain',
  'html',
  'html4',
  'html5',
  'chunkedhtml',
  'epub',
  'epub2',
  'epub3',
  'revealjs',
  'slidy',
  'slideous',
  'dzslides',
  's5',
]);

/** Whether the document being written is a slide show. */
export const isSlideOutput = supportedBy(SLIDE_WRITERS);

/** Whether it is an EPUB, which has a cover, a font and a title page of its own. */
export const isEpubOutput = supportedBy(['epub', 'epub2', 'epub3']);

/** `--split-level`, which chunked HTML splits on as an EPUB splits chapters. */
export const supportsSplitLevel = supportedBy(['epub', 'epub2', 'epub3', 'chunkedhtml']);

/** `--section-divs`, `--email-obfuscation` and `--id-prefix`. */
export const supportsHtmlOptions = supportedBy(HTML_PAGE_WRITERS);

/** `--embed-resources`: "only works with HTML output formats", chunked aside. */
export const supportsEmbedResources = supportedBy(HTML_PAGE_WRITERS.filter(w => w !== 'chunkedhtml'));

/** `--dpi`: the writers that have to put a real size on an image in pixels. */
export const supportsDpi = supportedBy(['latex', 'beamer', 'pdf', 'context', 'typst', 'docx', 'odt', 'icml', 'ms', 'rtf', 'texinfo']);

/* The families a filter can be written for. */
export const FORMAT_FAMILIES = ['latex', 'docx', 'odt', 'html', 'slides', 'markdown', 'typst'] as const;

export type FormatFamily = (typeof FORMAT_FAMILIES)[number];

const FAMILY_MEMBERS: Record<FormatFamily, readonly string[]> = {
  // `pdf` is here because pandoc's PDF goes through LaTeX unless told otherwise.
  latex: ['latex', 'beamer', 'pdf'],
  docx: ['docx'],
  odt: ['odt', 'opendocument'],
  // EPUB is HTML in a wrapper, and a filter writing HTML works in both.
  html: ['html', 'html4', 'html5', 'chunkedhtml', 'epub', 'epub2', 'epub3'],
  slides: SLIDE_WRITERS,
  markdown: [
    'markdown',
    'markdown_strict',
    'markdown_mmd',
    'markdown_phpextra',
    'markdown_github',
    'commonmark',
    'commonmark_x',
    'gfm',
    'djot',
    'markua',
  ],
  typst: ['typst'],
};

/** Every family a writer belongs to. A writer belongs to its own name as well. */
export const familiesOf = (writer?: string): string[] => {
  if (!writer) {
    return [];
  }
  const families = FORMAT_FAMILIES.filter(family => FAMILY_MEMBERS[family].includes(writer));
  return families.includes(writer as FormatFamily) ? families : [writer, ...families];
};

/** Whether a filter declaring `formats` can do anything for this writer. */
export const runsInFormat = (formats: readonly string[] | undefined, writer?: string): boolean => {
  if (!formats?.length || !writer) {
    return true;
  }
  const families = familiesOf(writer);
  return formats.some(f => families.includes(f));
};
