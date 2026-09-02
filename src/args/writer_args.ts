/*
 * The writer options a template carries, read out of and written into its *extra* arguments —
 * the arguments proper are rewritten wholesale on every format change and would take these
 * with them. Reading is more forgiving than writing: every spelling pandoc accepts is
 * understood, and the last of a repeated option wins, as it does for pandoc.
 */

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A value as it appears after an option, quoted or bare. */
const VALUE = String.raw`("[^"]*"|[^\s"]+)`;

/** Every spelling of one option, as one alternation. */
const alternation = (names: Names) => (typeof names === 'string' ? [names] : names).map(escapeRegExp).join('|');

/** The spelling written back, which is always the first one named. */
const written = (names: Names) => (typeof names === 'string' ? names : names[0]);

/** An option under all the names pandoc answers to for it, longest form first. */
type Names = string | readonly string[];

/** Flags with nothing after them, as one alternation. */
const flagsPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})(?=\s|$)`;

/** A flag carrying a value: `--pdf-engine=xelatex`, `--highlight-style kate`. */
const optionPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})[= ]${VALUE}(?=\s|$)`;

/** `args` without anything `pattern` matches, tidied up after. */
const without = (args: string | undefined, pattern: string) =>
  (args ?? '')
    .replace(new RegExp(pattern, 'g'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const append = (args: string, flag: string) => (args ? `${args} ${flag}` : flag);

const unquote = (value: string) => (value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);

/** Only a value that would not survive the round trip needs the quotes. */
const quote = (value: string) => (/\s/.test(value) ? `"${value}"` : value);

/** The last match of `pattern`, since the last option given is the one pandoc takes. */
const lastMatch = (args: string | undefined, pattern: string): RegExpMatchArray | undefined => {
  let last: RegExpMatchArray | undefined;
  for (const match of (args ?? '').matchAll(new RegExp(pattern, 'g'))) {
    last = match;
  }
  return last;
};

/** The value `args` gives `name`, or undefined where it does not give one. */
const valueOf = (args: string | undefined, name: Names): string | undefined => {
  const found = lastMatch(args, optionPattern(name))?.[1];
  return found === undefined ? undefined : unquote(found);
};

/** `args` with `name` set to `value`, or taken back out at undefined. */
const setValue = (args: string | undefined, name: Names, value?: string): string => {
  const stripped = without(args, optionPattern(name));
  return value ? append(stripped, `${written(name)}=${quote(value)}`) : stripped;
};

const has = (args: string | undefined, names: Names) => new RegExp(flagsPattern(names)).test(args ?? '');

/** `args` carrying the first of `names`, or none of them. */
const setPresence = (args: string | undefined, names: Names, on: boolean): string => {
  const stripped = without(args, flagsPattern(names));
  return on ? append(stripped, written(names)) : stripped;
};

/**
 * A switch in all three spellings pandoc 3 takes: `--section-divs`, and the `=true` and `=false` that let a later
 * option undo an earlier one.
 */
const switchPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})(?:=(true|false))?(?=\s|$)`;

/** What `args` says about a switch, or undefined where it says nothing. */
const switchValue = (args: string | undefined, names: Names): boolean | undefined => {
  const found = lastMatch(args, switchPattern(names));
  return found ? found[1] !== 'false' : undefined;
};

/** `args` saying a switch is `on`, against a default of `byDefault`. */
const setSwitch = (args: string | undefined, names: Names, on: boolean, byDefault = false): string => {
  const stripped = without(args, switchPattern(names));
  return on === byDefault ? stripped : append(stripped, on ? written(names) : `${written(names)}=false`);
};

/** Both lines as pandoc sees them, the extra arguments last, since they win. */
const joined = (args: readonly (string | undefined)[]) => args.filter(Boolean).join(' ');

/** A count, as a count: what a field meant for one is allowed to hold. */
const digits = (value: string) => value.replace(/\D/g, '');

/* -- Numbered headings ---------------------------------------------------- */

/** `-N` is pandoc's short form; the long one is what gets written. */
const NUMBER_SECTIONS = ['--number-sections', '-N'] as const;
const NUMBER_OFFSET = '--number-offset';

export const numberSections = (args?: string): boolean => has(args, NUMBER_SECTIONS);

export const setNumberSections = (args: string | undefined, on: boolean): string => {
  const next = setPresence(args, NUMBER_SECTIONS, on);
  // An offset is only ever an offset into numbering, and pandoc reads one as asking for numbering — left behind, it
  // would switch straight back on.
  return on ? next : setValue(next, NUMBER_OFFSET);
};

/**
 * Where the numbering starts: pandoc's comma-separated list of per-level offsets, `5` for a first heading numbered 6,
 * `1,4` for one numbered 1.5.
 */
export const numberOffset = (args?: string): string | undefined => valueOf(args, NUMBER_OFFSET);

export const setNumberOffset = (args: string | undefined, offset: string): string => {
  // Digits and the commas between them, which is all pandoc accepts.
  const cleaned = offset
    .replace(/[^\d,]/g, '')
    .replace(/,{2,}/g, ',')
    .replace(/^,+|,+$/g, '');
  return setValue(args, NUMBER_OFFSET, cleaned || undefined);
};

/* -- Reading the note ----------------------------------------------------- */

/* Options pandoc applies as it reads the note, before any writer sees it. */

const TAB_STOP = '--tab-stop';
const STRIP_COMMENTS = '--strip-comments';

/** How many spaces a tab in the note stands for. Pandoc's own answer is 4. */
export const tabStop = (args?: string): string | undefined => valueOf(args, TAB_STOP);

export const setTabStop = (args: string | undefined, spaces: string): string => setValue(args, TAB_STOP, digits(spaces) || undefined);

/** Whether HTML comments in the note are dropped rather than passed through. */
export const stripComments = (args?: string): boolean => switchValue(args, STRIP_COMMENTS) ?? false;

export const setStripComments = (args: string | undefined, on: boolean): string => setSwitch(args, STRIP_COMMENTS, on);

/* -- Heading level -------------------------------------------------------- */

const SHIFT_HEADING_LEVEL_BY = '--shift-heading-level-by';

/**
 * How far the note's headings move on the way out: `1` makes an `#` into an `##`, `-1` promotes it and turns a single
 * top-level heading into the document title.
 */
export const SHIFT_HEADING_LEVELS = [-3, -2, -1, 1, 2, 3] as const;

export const shiftHeadingLevelBy = (args?: string): string | undefined => valueOf(args, SHIFT_HEADING_LEVEL_BY);

export const setShiftHeadingLevelBy = (args: string | undefined, shift: string): string => {
  const level = Number(shift);
  const wanted = Number.isInteger(level) && level !== 0 && Math.abs(level) <= 6;
  return setValue(args, SHIFT_HEADING_LEVEL_BY, wanted ? String(level) : undefined);
};

/* -- Lists of figures and tables ------------------------------------------ */

const LIST_OF_FIGURES = ['--list-of-figures', '--lof'] as const;
const LIST_OF_TABLES = ['--list-of-tables', '--lot'] as const;

export const listOfFigures = (args?: string): boolean => has(args, LIST_OF_FIGURES);
export const setListOfFigures = (args: string | undefined, on: boolean): string => setPresence(args, LIST_OF_FIGURES, on);

export const listOfTables = (args?: string): boolean => has(args, LIST_OF_TABLES);
export const setListOfTables = (args: string | undefined, on: boolean): string => setPresence(args, LIST_OF_TABLES, on);

/* -- Top-level division --------------------------------------------------- */

/** What a level-1 heading becomes. */
export const TOP_LEVEL_DIVISIONS = ['section', 'chapter', 'part'] as const;
export type TopLevelDivision = (typeof TOP_LEVEL_DIVISIONS)[number];

const TOP_LEVEL_DIVISION = '--top-level-division';

const isDivision = (value?: string): value is TopLevelDivision => TOP_LEVEL_DIVISIONS.includes(value as TopLevelDivision);

export const topLevelDivision = (args?: string): TopLevelDivision | undefined => {
  const value = valueOf(args, TOP_LEVEL_DIVISION);
  return isDivision(value) ? value : undefined;
};

export const setTopLevelDivision = (args: string | undefined, division: string): string =>
  setValue(args, TOP_LEVEL_DIVISION, isDivision(division) ? division : undefined);

/* -- Code highlighting ---------------------------------------------------- */

/** The styles pandoc ships, `pygments` — its own default — first. */
export const HIGHLIGHT_STYLES = ['pygments', 'tango', 'espresso', 'zenburn', 'kate', 'monochrome', 'breezedark', 'haddock'] as const;

/** Highlighting switched off, as against left to pandoc — that is `undefined`. */
export const HIGHLIGHT_NONE = 'none';

const HIGHLIGHT = String.raw`(?:^|\s)(?:(--no-highlight)|(?:--highlight-style|--syntax-highlighting)[= ]${VALUE})(?=\s|$)`;

/** The style asked for, `HIGHLIGHT_NONE`, or undefined where pandoc is left to itself. */
export const highlightStyle = (args?: string): string | undefined => {
  const found = lastMatch(args, HIGHLIGHT);
  if (!found) {
    return undefined;
  }
  // `--syntax-highlighting=none` says what `--no-highlight` says.
  return found[1] ? HIGHLIGHT_NONE : unquote(found[2]);
};

export const setHighlightStyle = (args: string | undefined, style: string): string => {
  const stripped = without(args, HIGHLIGHT);
  if (!style) {
    return stripped;
  }
  return append(stripped, style === HIGHLIGHT_NONE ? '--no-highlight' : `--highlight-style=${quote(style)}`);
};

/** The two spellings pandoc 3.7 renamed, both of which it now warns about on every run. */
const LEGACY_HIGHLIGHT = String.raw`(^|\s)(?:--no-highlight|--highlight-style[= ]${VALUE})(?=\s|$)`;

/**
 * The command line in the spelling pandoc 3.7 and later ask for. Templates keep the old one, which every version the
 * plugin supports takes; only the command that runs is brought up to date, and only where the binary is new enough.
 */
export const renameHighlightFlags = (cmd: string): string =>
  cmd.replace(
    new RegExp(LEGACY_HIGHLIGHT, 'g'),
    (_match, lead: string, style?: string) => `${lead}--syntax-highlighting=${style ?? 'none'}`
  );

/* -- Math ----------------------------------------------------------------- */

/**
 * How TeX math reaches HTML. Three of these may carry a URL naming the build to load — the Html preset pins one that
 * way — and it is read and written as a field of its own, since nothing else in the modal could say it.
 */
export const MATH_METHODS = ['mathjax', 'katex', 'mathml', 'webtex', 'gladtex', 'plain'] as const;
export type MathMethod = (typeof MATH_METHODS)[number];

/** The five pandoc gave a flag of their own, before `--math-method` gathered them under one option in 3.11. */
const LEGACY_MATH_METHODS: readonly MathMethod[] = ['mathjax', 'katex', 'mathml', 'webtex', 'gladtex'];

/** The three that load something from somewhere. */
const MATH_URL_METHODS: readonly MathMethod[] = ['mathjax', 'katex', 'webtex'];

export const takesMathUrl = (method?: string): boolean => MATH_URL_METHODS.includes(method as MathMethod);

/** Both spellings: the five flags, each taking an `=URL`, and `--math-method`, whose URL follows a colon. */
const MATH = String.raw`(?:^|\s)(?:--(${LEGACY_MATH_METHODS.join('|')})(?:=${VALUE})?|--math-method[= ]${VALUE})(?=\s|$)`;

/** `mathjax:https://…` split where pandoc splits it: at the first colon, the URL carrying colons of its own. */
const splitMathValue = (value: string): { method: string; url?: string } => {
  const at = value.indexOf(':');
  return at === -1 ? { method: value } : { method: value.slice(0, at), url: value.slice(at + 1) };
};

/** What a match of either spelling names. */
const readMath = (found?: RegExpMatchArray): { method?: string; url?: string } => {
  if (!found) {
    return {};
  }
  if (found[1]) {
    return { method: found[1], url: found[2] === undefined ? undefined : unquote(found[2]) };
  }
  return splitMathValue(unquote(found[3]));
};

export const mathMethod = (args?: string): MathMethod | undefined => {
  const { method } = readMath(lastMatch(args, MATH));
  return MATH_METHODS.includes(method as MathMethod) ? (method as MathMethod) : undefined;
};

/** The build the chosen method is pointed at, where it names one. */
export const mathUrl = (args?: string): string | undefined => readMath(lastMatch(args, MATH)).url;

/**
 * The five keep the flag of their own, which every version the plugin supports takes; only the command that runs is
 * moved to the spelling the binary at hand wants. `plain` has no older spelling — before 3.11 it was simply what
 * pandoc did when no method was named at all.
 */
const writeMath = (args: string, method: string, url?: string) => {
  const wanted = url && takesMathUrl(method) ? url : undefined;
  if (LEGACY_MATH_METHODS.includes(method as MathMethod)) {
    return append(args, wanted ? `--${method}=${quote(wanted)}` : `--${method}`);
  }
  return append(args, `--math-method=${quote(wanted ? `${method}:${wanted}` : method)}`);
};

export const setMathMethod = (args: string | undefined, method: string): string => {
  const stripped = without(args, MATH);
  return MATH_METHODS.includes(method as MathMethod) ? writeMath(stripped, method) : stripped;
};

/** The URL for whichever method is already chosen; nothing to set it on without one. */
export const setMathUrl = (args: string | undefined, url: string): string => {
  const method = mathMethod(args);
  if (!method) {
    return args ?? '';
  }
  return writeMath(without(args, MATH), method, url.trim() || undefined);
};

/** The five spellings pandoc 3.11 replaced, all of which it now warns about on every run. */
const LEGACY_MATH = String.raw`(^|\s)--(${LEGACY_MATH_METHODS.join('|')})(?:=${VALUE})?(?=\s|$)`;

/** The one option that took their place, which only pandoc 3.11 and later know. */
const NEW_MATH = String.raw`(^|\s)--math-method[= ]${VALUE}(?=\s|$)`;

/** The command line in the spelling pandoc 3.11 and later ask for. */
export const renameMathFlags = (cmd: string): string =>
  cmd.replace(
    new RegExp(LEGACY_MATH, 'g'),
    (_match, lead: string, method: string, url?: string) => `${lead}--math-method=${quote(url ? `${method}:${unquote(url)}` : method)}`
  );

/** The same line for a pandoc older than 3.11, which knows only the five flags — and, for `plain`, no flag at all. */
export const legacyMathFlags = (cmd: string): string =>
  cmd.replace(new RegExp(NEW_MATH, 'g'), (match, lead: string, value: string) => {
    const { method, url } = splitMathValue(unquote(value));
    if (!MATH_METHODS.includes(method as MathMethod)) {
      // Not a method pandoc names: left as written, for pandoc itself to complain about.
      return match;
    }
    // `plain` comes back out altogether, space and all: it is what a pandoc without the option does anyway.
    return method === 'plain' ? '' : `${lead}--${method}${url && takesMathUrl(method) ? `=${quote(url)}` : ''}`;
  });

/* -- The output template -------------------------------------------------- */

const TEMPLATE = '--template';

/** A layout of the user's own, in place of pandoc's built-in one for the writer. */
export const templateFile = (args?: string): string | undefined => valueOf(args, TEMPLATE);

export const setTemplateFile = (args: string | undefined, file: string): string => setValue(args, TEMPLATE, file || undefined);

/* -- Syntax definition ---------------------------------------------------- */

const SYNTAX_DEFINITION = '--syntax-definition';

/** A KDE XML syntax file, teaching the highlighter a language it does not know. */
export const syntaxDefinition = (args?: string): string | undefined => valueOf(args, SYNTAX_DEFINITION);

export const setSyntaxDefinition = (args: string | undefined, file: string): string => setValue(args, SYNTAX_DEFINITION, file || undefined);

/* -- The bytes written ---------------------------------------------------- */

/** How lines end. `native` is the platform's own, and pandoc's default. */
export const EOL_MODES = ['native', 'lf', 'crlf'] as const;

const EOL = '--eol';
const ASCII = '--ascii';

export const eol = (args?: string): string | undefined => valueOf(args, EOL);

export const setEol = (args: string | undefined, mode: string): string => setValue(args, EOL, mode || undefined);

/**
 * Whether anything outside ASCII is escaped rather than written as itself — entities in HTML and XML, commands in
 * LaTeX, hexadecimal in roff.
 */
export const ascii = (args?: string): boolean => switchValue(args, ASCII) ?? false;

export const setAscii = (args: string | undefined, on: boolean): string => setSwitch(args, ASCII, on);

/* -- PDF engine ----------------------------------------------------------- */

/** The engines pandoc names, likeliest first. */
export const PDF_ENGINES = [
  'pdflatex',
  'xelatex',
  'lualatex',
  'tectonic',
  'latexmk',
  'typst',
  'context',
  'weasyprint',
  'pagedjs-cli',
  'prince',
  'wkhtmltopdf',
  'groff',
  'pdfroff',
] as const;

const PDF_ENGINE = '--pdf-engine';

export const pdfEngine = (args?: string): string | undefined => valueOf(args, PDF_ENGINE);

export const setPdfEngine = (args: string | undefined, engine: string): string => setValue(args, PDF_ENGINE, engine || undefined);

/* -- Citations ------------------------------------------------------------ */

/**
 * `-C` is pandoc's short form; the long one is what gets written.
 *
 * Where it lands on the line does not matter, unlike a filter's: `--citeproc` runs after every `--lua-filter`
 * whatever order they are written in — the positional form is `--filter citeproc`, which is a separate program and
 * not what this writes.
 */
const CITEPROC = ['--citeproc', '-C'] as const;
const BIBLIOGRAPHY = '--bibliography';
const CSL = '--csl';

export const citeproc = (args?: string): boolean => has(args, CITEPROC);

export const setCiteproc = (args: string | undefined, on: boolean): string => {
  const next = setPresence(args, CITEPROC, on);
  // Neither file does anything by itself — both only set a metadata field that citeproc goes on to read — and the
  // rows they are typed into are hidden along with the toggle.
  return on ? next : setValue(setValue(next, CSL), BIBLIOGRAPHY);
};

/** The references citeproc reads. */
export const bibliography = (args?: string): string | undefined => valueOf(args, BIBLIOGRAPHY);

export const setBibliography = (args: string | undefined, file: string): string => setValue(args, BIBLIOGRAPHY, file || undefined);

/** The style file the citations and the bibliography are formatted to. */
export const csl = (args?: string): string | undefined => valueOf(args, CSL);

export const setCsl = (args: string | undefined, file: string): string => setValue(args, CSL, file || undefined);

/* -- Reference document --------------------------------------------------- */

/** The document a docx, odt or pptx export takes its styles from. */
const REFERENCE_DOC = '--reference-doc';

export const referenceDoc = (args?: string): string | undefined => valueOf(args, REFERENCE_DOC);

export const setReferenceDoc = (args: string | undefined, file: string): string => setValue(args, REFERENCE_DOC, file || undefined);

/* -- Stylesheet ----------------------------------------------------------- */

/** `--css` is repeatable as well, and is read and written as the one file. */
const CSS = ['--css', '-c'] as const;

export const css = (args?: string): string | undefined => valueOf(args, CSS);

export const setCss = (args: string | undefined, file: string): string => setValue(args, CSS, file || undefined);

/* -- Include files -------------------------------------------------------- */

/**
 * Files copied into the written document verbatim — a LaTeX preamble, a script in an HTML head, a footer under the
 * body.
 */
const INCLUDE_IN_HEADER = ['--include-in-header', '-H'] as const;
const INCLUDE_BEFORE_BODY = ['--include-before-body', '-B'] as const;
const INCLUDE_AFTER_BODY = ['--include-after-body', '-A'] as const;

export const includeInHeader = (args?: string): string | undefined => valueOf(args, INCLUDE_IN_HEADER);
export const setIncludeInHeader = (args: string | undefined, file: string): string => setValue(args, INCLUDE_IN_HEADER, file || undefined);

export const includeBeforeBody = (args?: string): string | undefined => valueOf(args, INCLUDE_BEFORE_BODY);
export const setIncludeBeforeBody = (args: string | undefined, file: string): string =>
  setValue(args, INCLUDE_BEFORE_BODY, file || undefined);

export const includeAfterBody = (args?: string): string | undefined => valueOf(args, INCLUDE_AFTER_BODY);
export const setIncludeAfterBody = (args: string | undefined, file: string): string =>
  setValue(args, INCLUDE_AFTER_BODY, file || undefined);

/* -- Variables and metadata ----------------------------------------------- */

/** One `key=value`. A value of `''` is pandoc's bare `-V key`, which is true. */
export type Pair = { key: string; value: string };

/**
 * A `key=value` after `-V`, quoted whole (`-V "mainfont=PT Serif"`), quoted in part (`-V mainfont="PT Serif"`) or not
 * at all.
 */
const PAIR = String.raw`((?:"[^"]*"|[^\s"])+)`;

const pairPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})[= ]${PAIR}(?=\s|$)`;

/** `key=value` split at the first `=`, which is where pandoc splits it. */
const readPair = (token: string): Pair => {
  const bare = token.replace(/"/g, '');
  const at = bare.indexOf('=');
  return at === -1 ? { key: bare, value: '' } : { key: bare.slice(0, at), value: bare.slice(at + 1) };
};

const writePair = ({ key, value }: Pair) => quote(value ? `${key}=${value}` : key);

/** The readers and writers a repeatable `KEY=VALUE` option needs. */
const pairOption = (names: readonly string[]) => {
  const pattern = pairPattern(names);

  /** Every pair in the line, in the order pandoc reads them. */
  const all = (args?: string): Pair[] => [...(args ?? '').matchAll(new RegExp(pattern, 'g'))].map(m => readPair(m[1]));

  /** The line without the pairs `drop` names, the rest left where they were. */
  const strip = (args: string | undefined, drop: (key: string) => boolean) =>
    (args ?? '')
      .replace(new RegExp(pattern, 'g'), (whole, token: string) => (drop(readPair(token).key) ? ' ' : whole))
      .replace(/\s{2,}/g, ' ')
      .trim();

  const add = (args: string, pairs: readonly Pair[]) => pairs.reduce((line, pair) => append(line, `${names[0]} ${writePair(pair)}`), args);

  return {
    all,
    /** The value the line gives `key` — the last, since that is the one pandoc takes. */
    valueOf: (args: string | undefined, key: string): string | undefined =>
      all(args)
        .filter(p => p.key === key)
        .pop()?.value,
    /** The line with `key` set, or taken back out at an empty value. */
    set: (args: string | undefined, key: string, value: string): string => {
      const stripped = strip(args, k => k === key);
      return value ? add(stripped, [{ key, value }]) : stripped;
    },
    /**
     * The line rewritten to `pairs`, less the keys `keep` names — those are written by rows of their own and are left
     * exactly as they were found.
     */
    setAll: (args: string | undefined, pairs: readonly Pair[], keep: readonly string[] = []): string => {
      const stripped = strip(args, k => !keep.includes(k));
      return add(
        stripped,
        pairs.filter(p => p.key && !keep.includes(p.key))
      );
    },
  };
};

const VARIABLES = pairOption(['-V', '--variable']);
const METADATA = pairOption(['-M', '--metadata']);

export const variables = VARIABLES.all;
export const variable = VARIABLES.valueOf;
export const setVariable = VARIABLES.set;
export const setVariables = VARIABLES.setAll;

export const metadata = METADATA.all;
export const metadataValue = METADATA.valueOf;
export const setMetadataValue = METADATA.set;
export const setMetadata = METADATA.setAll;

/** The variables the modal asks for by name, each with a row of its own. */
export const CURATED_VARIABLES = ['papersize', 'fontsize', 'mainfont', 'geometry', 'linkcolor', 'lang'] as const;

export type CuratedVariable = (typeof CURATED_VARIABLES)[number];

/* -- Text direction ------------------------------------------------------- */

/**
 * Which way the text runs. Pandoc reads `dir` out of the document's metadata and not out of the template variables —
 * the ODT and docx writers look it up there and nowhere else — so it goes in with `-M`, which the HTML and EPUB
 * templates that ask for a `dir` see just as well. Word and OpenDocument only began to honour it in pandoc 3.11;
 * before that the option is read and written all the same, and simply does nothing.
 */
export const TEXT_DIRECTIONS = ['ltr', 'rtl'] as const;
export type TextDirection = (typeof TEXT_DIRECTIONS)[number];

const DIRECTION = 'dir';

export const textDirection = (args?: string): TextDirection | undefined => {
  const value = metadataValue(args, DIRECTION);
  return TEXT_DIRECTIONS.includes(value as TextDirection) ? (value as TextDirection) : undefined;
};

export const setTextDirection = (args: string | undefined, direction: string): string =>
  setMetadataValue(args, DIRECTION, TEXT_DIRECTIONS.includes(direction as TextDirection) ? direction : '');

/** The list as it is typed: one `key=value` a line, blank lines passed over. */
export const pairsFromText = (text: string): Pair[] =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const at = line.indexOf('=');
      return at === -1 ? { key: line, value: '' } : { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    })
    .filter(pair => pair.key.length > 0);

/** The same list as it is shown. A pair with no value is pandoc's bare `-V key`. */
export const textFromPairs = (pairs: readonly Pair[]): string =>
  pairs.map(({ key, value }) => (value ? `${key}=${value}` : key)).join('\n');

/* -- The command, for reading --------------------------------------------- */

/** The command's tokens, in the order pandoc reads them. */
const commandTokens = (command: string): string[] => {
  const tokens: string[] = [];
  let token = '';
  let depth = 0;
  let quoted = false;

  const end = () => {
    if (token) {
      tokens.push(token);
      token = '';
    }
  };

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    // Everything up to the closing quote belongs to the token, `}` included — a brace inside a path is not the end of
    // a substitution.
    if (quoted) {
      token += char;
      quoted = char !== '"';
      continue;
    }
    if (char === '"') {
      quoted = true;
      token += char;
      continue;
    }
    if (char === '$' && command[i + 1] === '{') {
      depth += 1;
      token += '${';
      i += 1;
      continue;
    }
    if (char === '}' && depth > 0) {
      depth -= 1;
      token += char;
      continue;
    }
    if (depth === 0 && /\s/.test(char)) {
      end();
      continue;
    }
    token += char;
  }
  end();
  return tokens;
};

/** The command as one line an option — the form it is read in, not the form it is run in. */
export const commandLines = (command: string): string[] => {
  const tokens = commandTokens(command);
  return tokens.reduce<string[]>((lines, token, i) => {
    const previous = tokens[i - 1];
    const takesValue = previous !== undefined && previous.startsWith('-') && !previous.includes('=');
    const starts = lines.length === 0 || token.startsWith('-') || (token.startsWith('${') && !takesValue);
    if (starts) {
      lines.push(token);
    } else {
      lines[lines.length - 1] += ` ${token}`;
    }
    return lines;
  }, []);
};

/** The sizes pandoc's own documentation names, in the spelling LaTeX takes. */
export const PAPER_SIZES = ['a4', 'letter', 'a5', 'b5', 'legal', 'executive'] as const;

/** What a LaTeX document class accepts; other writers take any CSS length. */
export const FONT_SIZES = ['10pt', '11pt', '12pt'] as const;

/* -- The written source --------------------------------------------------- */

/** How the lines of the written file are broken. */
export const WRAP_MODES = ['none', 'preserve'] as const;

const WRAP = '--wrap';
const COLUMNS = '--columns';

/** Whatever the line asks for, `auto` and anything hand-written included. */
export const wrap = (args?: string): string | undefined => valueOf(args, WRAP);

export const setWrap = (args: string | undefined, mode: string): string => setValue(args, WRAP, mode || undefined);

/** Where `--wrap=auto` breaks a line. Pandoc's own answer is 72. */
export const columns = (args?: string): string | undefined => valueOf(args, COLUMNS);

export const setColumns = (args: string | undefined, count: string): string => setValue(args, COLUMNS, digits(count) || undefined);

/** How a heading is written in markdown. Pandoc's own answer is `atx`. */
export const MARKDOWN_HEADINGS = ['atx', 'setext'] as const;

const MARKDOWN_HEADING = '--markdown-headings';

export const markdownHeadings = (args?: string): string | undefined => valueOf(args, MARKDOWN_HEADING);

export const setMarkdownHeadings = (args: string | undefined, style: string): string =>
  setValue(args, MARKDOWN_HEADING, MARKDOWN_HEADINGS.includes(style as (typeof MARKDOWN_HEADINGS)[number]) ? style : undefined);

/** Links written as `[text][ref]` with the URLs collected below, not inline. */
const REFERENCE_LINKS = '--reference-links';

export const referenceLinks = (args?: string): boolean => switchValue(args, REFERENCE_LINKS) ?? false;

export const setReferenceLinks = (args: string | undefined, on: boolean): string => setSwitch(args, REFERENCE_LINKS, on);

/** Where the footnotes — and the link references, once they are collected — go. */
export const REFERENCE_LOCATIONS = ['block', 'section', 'document'] as const;

const REFERENCE_LOCATION = '--reference-location';

export const referenceLocation = (args?: string): string | undefined => valueOf(args, REFERENCE_LOCATION);

export const setReferenceLocation = (args: string | undefined, where: string): string =>
  setValue(args, REFERENCE_LOCATION, REFERENCE_LOCATIONS.includes(where as (typeof REFERENCE_LOCATIONS)[number]) ? where : undefined);

/* -- Slides --------------------------------------------------------------- */

/** `-i` is pandoc's short form; the long one is what gets written. */
const INCREMENTAL = ['--incremental', '-i'] as const;

export const incremental = (args?: string): boolean => switchValue(args, INCREMENTAL) ?? false;

export const setIncremental = (args: string | undefined, on: boolean): string => setSwitch(args, INCREMENTAL, on);

/** The heading level that starts a new slide. */
export const SLIDE_LEVELS = ['0', '1', '2', '3'] as const;

const SLIDE_LEVEL = '--slide-level';

export const slideLevel = (args?: string): string | undefined => valueOf(args, SLIDE_LEVEL);

export const setSlideLevel = (args: string | undefined, level: string): string => setValue(args, SLIDE_LEVEL, digits(level) || undefined);

/* -- EPUB ----------------------------------------------------------------- */

const EPUB_COVER_IMAGE = '--epub-cover-image';
const EPUB_EMBED_FONT = '--epub-embed-font';
const EPUB_TITLE_PAGE = '--epub-title-page';
const EPUB_SUBDIRECTORY = '--epub-subdirectory';

/** The heading level a new file is started at — a chapter, in an EPUB. */
export const SPLIT_LEVELS = ['1', '2', '3'] as const;

/** Pandoc calls this `--epub-chapter-level` as well, and still reads the older name. */
const SPLIT_LEVEL = ['--split-level', '--epub-chapter-level'] as const;

export const epubCoverImage = (args?: string): string | undefined => valueOf(args, EPUB_COVER_IMAGE);

export const setEpubCoverImage = (args: string | undefined, file: string): string => setValue(args, EPUB_COVER_IMAGE, file || undefined);

/** Repeatable, like the bibliography; the modal asks for the one font. */
export const epubEmbedFont = (args?: string): string | undefined => valueOf(args, EPUB_EMBED_FONT);

export const setEpubEmbedFont = (args: string | undefined, file: string): string => setValue(args, EPUB_EMBED_FONT, file || undefined);

/** A title page is what pandoc writes unless it is told not to. */
export const epubTitlePage = (args?: string): boolean => switchValue(args, EPUB_TITLE_PAGE) ?? true;

export const setEpubTitlePage = (args: string | undefined, on: boolean): string => setSwitch(args, EPUB_TITLE_PAGE, on, true);

export const splitLevel = (args?: string): string | undefined => valueOf(args, SPLIT_LEVEL);

export const setSplitLevel = (args: string | undefined, level: string): string => setValue(args, SPLIT_LEVEL, digits(level) || undefined);

/** The folder inside the EPUB container the contents are put in. */
export const epubSubdirectory = (args?: string): string | undefined => valueOf(args, EPUB_SUBDIRECTORY);

export const setEpubSubdirectory = (args: string | undefined, name: string): string =>
  setValue(args, EPUB_SUBDIRECTORY, name.trim() || undefined);

/* -- The written page ----------------------------------------------------- */

const EMBED_RESOURCES = '--embed-resources';
const SECTION_DIVS = '--section-divs';
const ID_PREFIX = '--id-prefix';

/** What is done with an address so that it is not read straight off the page. */
export const EMAIL_OBFUSCATIONS = ['none', 'javascript', 'references'] as const;

const EMAIL_OBFUSCATION = '--email-obfuscation';

/** Whether the page carries its own images, styles and scripts. */
export const embedResources = (...args: (string | undefined)[]): boolean => switchValue(joined(args), EMBED_RESOURCES) ?? false;

/**
 * `inherited` is what the arguments proper already say, so a template whose preset embeds resources writes nothing to
 * say so — and writes `--embed-resources=false` to say otherwise, which is how pandoc is told to undo an option given
 * earlier in the same line.
 */
export const setEmbedResources = (args: string | undefined, on: boolean, inherited = false): string =>
  setSwitch(args, EMBED_RESOURCES, on, inherited);

/** Each section wrapped in a `<div>`, so a stylesheet can reach one. */
export const sectionDivs = (args?: string): boolean => switchValue(args, SECTION_DIVS) ?? false;

export const setSectionDivs = (args: string | undefined, on: boolean): string => setSwitch(args, SECTION_DIVS, on);

export const emailObfuscation = (args?: string): string | undefined => valueOf(args, EMAIL_OBFUSCATION);

export const setEmailObfuscation = (args: string | undefined, method: string): string =>
  setValue(args, EMAIL_OBFUSCATION, EMAIL_OBFUSCATIONS.includes(method as (typeof EMAIL_OBFUSCATIONS)[number]) ? method : undefined);

/** Put in front of every identifier, so a page can hold two of these documents. */
export const idPrefix = (args?: string): string | undefined => valueOf(args, ID_PREFIX);

export const setIdPrefix = (args: string | undefined, prefix: string): string => setValue(args, ID_PREFIX, prefix || undefined);

/* -- Media ---------------------------------------------------------------- */

const EXTRACT_MEDIA = '--extract-media';
const DPI = '--dpi';

/** The folder the images are written out to. */
export const extractMedia = (...args: (string | undefined)[]): string | undefined => valueOf(joined(args), EXTRACT_MEDIA);

export const setExtractMedia = (args: string | undefined, dir: string): string => setValue(args, EXTRACT_MEDIA, dir || undefined);

/** What a pixel is worth where the writer has to put a real size on an image. */
export const dpi = (args?: string): string | undefined => valueOf(args, DPI);

export const setDpi = (args: string | undefined, value: string): string => setValue(args, DPI, digits(value) || undefined);
