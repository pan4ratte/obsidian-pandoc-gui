import { t } from '../lang/helpers';
import { TemplateError } from '../templates/template';

type Hints = typeof t.ERROR_HINTS;

/** A failed export, with the command line stripped out and a suggestion where one is known. */
export interface ExportFailure {
  /** The error as it was reported, with the command line taken out. */
  detail: string;
  /** What to try, for the errors that come up again and again. */
  recommendation?: string;
  /** Which of them this was, for a caller that does something about it rather than saying it — see `typst_pdf.ts`. */
  hint?: keyof Hints;
}

/** The errors worth recognising, most specific first — the first pattern to match wins. */
const RECOMMENDATIONS: ReadonlyArray<readonly [RegExp, keyof Hints]> = [
  // "The file is not yours to write" — Windows locks an open PDF, pdflatex says its own words.
  [
    /\b(EBUSY|EPERM|EACCES)\b|permission denied|access is denied|being used by another process|resource busy or locked|can'?t write on file|cannot open [^\n]{0,80} for writing/i,
    'fileInUse',
  ],
  // The plugin's own `mkdir` before the command runs.
  [/no such file or directory, (mkdir|open)|ENOTDIR/i, 'outputFolder'],
  // Typst before the rest of the engines: the plugin installs one of its own, so a reader who has done that is owed
  // the reason it was not the one run — and the LaTeX distributions named below are no answer here.
  [/\btypst(\.exe)?\b[^\n]{0,60}(not found|is not recognized|no such file|does not exist|cannot be found)|install typst/i, 'typstEngine'],
  // Pandoc names the engine it could not run, and says so twice over.
  [
    /select a different --pdf-engine|\b(pdflatex|xelatex|lualatex|tectonic|context|wkhtmltopdf|weasyprint|prince|typst|pdfroff)(\.exe)?\b[^\n]{0,60}(not found|is not recognized|no such file|does not exist|cannot be found)/i,
    'pdfEngine',
  ],
  // Nothing ran at all: the shell could not find what it was asked to run.
  [
    /is not recognized as an internal or external command|command not found|the system cannot find the (file|path) specified|\bspawn\b[^\n]*ENOENT/i,
    'pandocNotFound',
  ],
  // pdfLaTeX's 8-bit fonts meet a character the note is written with.
  [/unicode character[^\n]{0,60}not set up for use with latex|inputenc error/i, 'latexUnicode'],
  [/file `?[^\n`']{1,80}\.(sty|cls)'? not found|latex error: file/i, 'latexPackage'],
  // The Zotero filter asks Better BibTeX on its local port, and nothing answers there.
  [/:23119\b[\s\S]*?(connectionfailure|connection refused|econnrefused)/i, 'zoteroNotRunning'],
  [/error running filter|\.lua:\d+:|attempt to (call|index)[^\n]{0,40}\(a nil value\)/i, 'luaFilter'],
  // A path the template names — layout template, reference document, syntax file.
  [/could not find data file|could not find template|could not read file/i, 'missingDataFile'],
  // A path the note names — an embedded image, an attachment.
  [/could not fetch resource|not found in resource path|openbinaryfile: does not exist|could not load image/i, 'missingResource'],
  [/yaml parse (exception|error)|could not parse yaml/i, 'frontMatter'],
  [/citeproc|bibliography|\.bib\b|\.csl\b/i, 'citations'],
  [/unrecognized option|unknown option|unknown (input|output|reader|writer) format|unknown extension|invalid argument/i, 'unknownOption'],
];

/** Whatever the thrown thing had to say, preferring the program's own output. */
function errorText(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err instanceof Error) {
    // `ExecException` carries the streams on some paths, folds stderr into the message on others.
    const { stderr } = err as Error & { stderr?: string };
    return [stderr, err.message].map(text => text?.trim()).find(Boolean) ?? '';
  }
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  if (err == null) {
    return '';
  }
  // Neither text nor an `Error`: its fields beat `[object Object]`.
  try {
    return JSON.stringify(err) || '';
  } catch {
    return '';
  }
}

/** The error with the command line dropped — node prefixes `Command failed:`, shells echo it. */
function extractDetail(err: unknown, cmd: string): string {
  const command = cmd?.trim();
  return errorText(err)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => {
      const text = line.trim();
      return !text.startsWith('Command failed:') && !(command && text.includes(command));
    })
    .join('\n')
    .trim();
}

export function describeExportFailure(err: unknown, cmd: string): ExportFailure {
  const detail = extractDetail(err, cmd) || t.ERROR_NO_OUTPUT;
  // Recognised by type rather than by pattern: this one is the plugin's own, and
  // nothing pandoc writes should be able to claim it.
  if (err instanceof TemplateError) {
    return { detail, recommendation: t.ERROR_HINTS.template, hint: 'template' };
  }
  const matched = RECOMMENDATIONS.find(([pattern]) => pattern.test(detail));
  return { detail, recommendation: matched && t.ERROR_HINTS[matched[1]], hint: matched?.[1] };
}
