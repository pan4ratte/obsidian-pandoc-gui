/* A rendered pandoc command line, read back as the options object the wasm build takes.
 *
 * The wasm build has no `main`: it exports `convert(options)`, where `options` is a defaults file as JSON —
 * `--number-sections` is `number-sections: true`, `-o out.html` is `output-file: out.html`. The whole plugin writes
 * command lines, so this is the one place that knows both spellings. The mapping is pandoc's own, from the tables in
 * the "Defaults files" section of its manual.
 */

import { trimQuotes } from '../system/utils';

/** Splits a command line on whitespace, keeping anything inside double quotes together — as `output_arg` does. */
const TOKENS = /(?:[^\s"]+|"[^"]*")+/g;

const LONG = /^--([\w-]+)(?:=([\s\S]*))?$/;
const SHORT = /^-([a-zA-Z])([\s\S]*)$/;

/** What an option carries, and what it becomes in the options object. */
type Kind =
  | 'flag' // present means true; `=false` turns it off again
  | 'string'
  | 'number'
  | 'list' // repeated, and collected into an array
  | 'pairs' // `key=value`, collected into an object
  | 'paths'; // a list of paths, written as one entry per option

interface Option {
  /** The key in the options object. Defaults to the long name, which is what most of them are. */
  key?: string;
  kind: Kind;
  /** Whether the value names a file that has to exist in the virtual file system. */
  file?: boolean;
}

/** Long options, by the name they are written under. */
const OPTIONS: Record<string, Option> = {
  // General
  'from': { kind: 'string' },
  'read': { key: 'from', kind: 'string' },
  'to': { kind: 'string' },
  'write': { key: 'to', kind: 'string' },
  'output': { key: 'output-file', kind: 'string' },
  'standalone': { kind: 'flag' },

  // Reader
  'shift-heading-level-by': { kind: 'number' },
  'indented-code-classes': { kind: 'list' },
  'default-image-extension': { kind: 'string' },
  'file-scope': { kind: 'flag' },
  'preserve-tabs': { kind: 'flag' },
  'tab-stop': { kind: 'number' },
  'track-changes': { kind: 'string' },
  'strip-comments': { kind: 'flag' },
  'extract-media': { kind: 'string' },
  'abbreviations': { kind: 'string', file: true },
  'metadata': { kind: 'pairs' },
  'metadata-file': { key: 'metadata-files', kind: 'list', file: true },

  // Writer
  'template': { kind: 'string', file: true },
  'variable': { key: 'variables', kind: 'pairs' },
  'eol': { kind: 'string' },
  'dpi': { kind: 'number' },
  'wrap': { kind: 'string' },
  'columns': { kind: 'number' },
  'table-of-contents': { kind: 'flag' },
  'toc': { key: 'table-of-contents', kind: 'flag' },
  'toc-depth': { kind: 'number' },
  'number-sections': { kind: 'flag' },
  'number-offset': { kind: 'list' },
  'syntax-definition': { key: 'syntax-definitions', kind: 'list', file: true },
  'include-in-header': { kind: 'list', file: true },
  'include-before-body': { kind: 'list', file: true },
  'include-after-body': { kind: 'list', file: true },
  'resource-path': { kind: 'paths' },
  'listings': { kind: 'flag' },
  'list-of-figures': { kind: 'flag' },
  'lof': { key: 'list-of-figures', kind: 'flag' },
  'list-of-tables': { kind: 'flag' },
  'lot': { key: 'list-of-tables', kind: 'flag' },
  'list-tables': { kind: 'flag' },
  'figure-caption-position': { kind: 'string' },
  'table-caption-position': { kind: 'string' },
  'top-level-division': { kind: 'string' },
  'markdown-headings': { kind: 'string' },
  'reference-links': { kind: 'flag' },
  'reference-location': { kind: 'string' },
  'section-divs': { kind: 'flag' },
  'email-obfuscation': { kind: 'string' },
  'id-prefix': { key: 'identifier-prefix', kind: 'string' },
  'title-prefix': { kind: 'string' },
  'ascii': { kind: 'flag' },
  'html-q-tags': { kind: 'flag' },
  'link-images': { kind: 'flag' },
  'embed-resources': { kind: 'flag' },
  'self-contained': { kind: 'flag' },
  'css': { kind: 'list', file: true },
  'reference-doc': { kind: 'string', file: true },
  'incremental': { kind: 'flag' },
  'slide-level': { kind: 'number' },
  'split-level': { kind: 'number' },
  'chunk-template': { kind: 'string' },
  'epub-cover-image': { kind: 'string', file: true },
  'epub-metadata': { kind: 'string', file: true },
  'epub-embed-font': { key: 'epub-fonts', kind: 'list', file: true },
  'epub-title-page': { kind: 'flag' },
  'epub-subdirectory': { kind: 'string' },
  'ipynb-output': { kind: 'string' },

  // Citations
  'bibliography': { kind: 'string', file: true },
  'csl': { kind: 'string', file: true },
  'citation-abbreviations': { kind: 'string', file: true },

  // Highlighting. `--syntax-highlighting` is what pandoc 3.7 renamed the other two to.
  'syntax-highlighting': { kind: 'string' },
  'highlight-style': { key: 'syntax-highlighting', kind: 'string' },
};

/** Options with a short spelling, by the letter. */
const SHORTS: Record<string, string> = {
  f: 'from',
  r: 'read',
  t: 'to',
  w: 'write',
  o: 'output',
  s: 'standalone',
  V: 'variable',
  M: 'metadata',
  H: 'include-in-header',
  B: 'include-before-body',
  A: 'include-after-body',
  c: 'css',
  N: 'number-sections',
  i: 'incremental',
  p: 'preserve-tabs',
  T: 'title-prefix',
  L: 'lua-filter',
  F: 'filter',
};

/**
 * Options that mean nothing without a process to run or a network to reach, dropped rather than reported. The pdf
 * engine is among them: an export that would have needed one never gets this far — see `unsupportedBy` — and every
 * other export is one where naming an engine changes nothing.
 */
const IGNORED = new Set(['verbose', 'quiet', 'trace', 'dump-args', 'no-check-certificate']);

/** The same, for the ones that carry a value — which has to be stepped over rather than read as the input file. */
const IGNORED_WITH_VALUE = new Set(['data-dir', 'log', 'request-header', 'pdf-engine', 'pdf-engine-opt']);

/** `--mathjax` and friends, which share one key. `--math-method` is what pandoc 3.11 renamed them to. */
const MATH_METHODS = ['mathjax', 'katex', 'mathml', 'webtex', 'gladtex'];

/** The same for citations: two flags that are each a value of one key. `--citeproc` is a filter and stands apart. */
const CITE_METHODS = ['natbib', 'biblatex'];

/** A filter as a defaults file names one: the built-in `citeproc`, or a script with the kind it is. */
export type Filter = string | { type: string; path?: string };

export interface PandocDefaults extends Record<string, unknown> {
  from?: string;
  to?: string;
  'output-file'?: string;
  filters?: Filter[];
}

/** Whether a filter is one with a file behind it, rather than the built-in named on its own. */
const hasPath = (filter: Filter): filter is { type: string; path: string } => typeof filter === 'object' && typeof filter.path === 'string';

export interface TranslatedCommand {
  defaults: PandocDefaults;
  /** The input file the command names, as written. Empty when it reads standard input. */
  inputFiles: string[];
  /** Every path the options name, for the caller to put in the virtual file system. */
  files: string[];
  /** Options the wasm build has no answer for, as they were written. */
  unsupported: string[];
}

const isFalse = (value?: string) => value?.toLowerCase() === 'false';

/** `key=value`, or `key` alone for a bare `true`. */
const pair = (value: string): [string, string | true] => {
  const at = value.indexOf('=');
  return at === -1 ? [value, true] : [value.substring(0, at), trimQuotes(value.substring(at + 1))];
};

/**
 * A path list as one option can carry it. Splitting on `:` would cut a Windows path in half at its drive letter, so
 * that separator is only used where no segment looks like one.
 */
const splitPaths = (value: string): string[] => {
  const parts = value.split(';');
  if (parts.length > 1 || /^[a-zA-Z]:[\\/]/.test(value)) {
    return parts.filter(Boolean);
  }
  return value.split(':').filter(Boolean);
};

/** The options object `cmd` describes, and what it needs to run. */
export function commandToDefaults(cmd: string): TranslatedCommand {
  const defaults: PandocDefaults = {};
  const files: string[] = [];
  const unsupported: string[] = [];
  const inputFiles: string[] = [];
  const filters: Filter[] = [];

  const collect = (option: Option, name: string, raw: string | undefined) => {
    const key = option.key ?? name;
    const value = raw === undefined ? undefined : trimQuotes(raw);

    switch (option.kind) {
      case 'flag':
        defaults[key] = !isFalse(value);
        break;
      case 'number': {
        const number = Number(value);
        defaults[key] = Number.isFinite(number) ? number : value;
        break;
      }
      case 'list': {
        const list = (defaults[key] as unknown[] | undefined) ?? [];
        // `--number-offset=1,4` is the one list written as a single option.
        const items = key === 'number-offset' ? value.split(',').map(Number) : [value];
        defaults[key] = [...list, ...items];
        break;
      }
      case 'paths': {
        const list = (defaults[key] as string[] | undefined) ?? [];
        defaults[key] = [...list, ...splitPaths(value)];
        break;
      }
      case 'pairs': {
        const map = (defaults[key] as Record<string, unknown> | undefined) ?? {};
        const [name_, val] = pair(value);
        defaults[key] = { ...map, [name_]: val };
        break;
      }
      default:
        defaults[key] = value;
    }

    if (option.file && value) {
      files.push(value);
    }
  };

  const tokens = cmd.match(TOKENS) ?? [];
  // The first token is the program, whatever it was called; everything after it is the command.
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token === '--') {
      continue;
    }

    const long = LONG.exec(token);
    const short = long ? null : SHORT.exec(token);
    if (!long && !short) {
      // A bare word is the file being read.
      inputFiles.push(trimQuotes(token));
      continue;
    }

    const name = long ? long[1] : SHORTS[short[1]];
    let value = long ? long[2] : short[2] ? trimQuotes(short[2]).replace(/^=/, '') : undefined;

    if (!name) {
      unsupported.push(token);
      continue;
    }

    if (IGNORED.has(name)) {
      continue;
    }
    if (IGNORED_WITH_VALUE.has(name)) {
      // Stepped over, or the path it carries would be read as another file to convert.
      if (value === undefined) {
        i += 1;
      }
      continue;
    }

    // Filters keep their order, and the built-in citeproc stands among them.
    if (name === 'citeproc') {
      filters.push('citeproc');
      continue;
    }
    if (name === 'lua-filter' || name === 'filter') {
      if (value === undefined && i + 1 < tokens.length) {
        value = tokens[(i += 1)];
      }
      const file = trimQuotes(value ?? '');
      if (name === 'filter') {
        // A json filter is a program, and there is nothing to run one with.
        unsupported.push(`--filter=${file}`);
        continue;
      }
      filters.push({ type: 'lua', path: file });
      files.push(file);
      continue;
    }

    if (MATH_METHODS.includes(name)) {
      const url = value === undefined ? undefined : trimQuotes(value);
      defaults['html-math-method'] = url ? { method: name, url } : { method: name };
      continue;
    }
    // The key stays `html-math-method` whichever spelling named it: 3.11 renamed it to `math-method` but still reads
    // the old one, and a build downloaded before 3.11 reads nothing else.
    if (name === 'math-method') {
      if (value === undefined && i + 1 < tokens.length) {
        value = tokens[(i += 1)];
      }
      const named = trimQuotes(value ?? '');
      const at = named.indexOf(':');
      const method = at === -1 ? named : named.slice(0, at);
      const url = at === -1 ? '' : named.slice(at + 1);
      if (method) {
        defaults['html-math-method'] = url ? { method, url } : { method };
      }
      continue;
    }
    if (CITE_METHODS.includes(name)) {
      defaults['cite-method'] = name;
      continue;
    }
    if (name === 'no-highlight') {
      defaults['syntax-highlighting'] = 'none';
      continue;
    }

    const option = OPTIONS[name];
    if (!option) {
      unsupported.push(long ? token : `-${short[1]}`);
      continue;
    }

    // A flag never takes the token after it; everything else does when it carries no value of its own.
    if (value === undefined && option.kind !== 'flag') {
      if (i + 1 >= tokens.length) {
        unsupported.push(token);
        continue;
      }
      value = tokens[(i += 1)];
    }

    collect(option, name, value);
  }

  if (filters.length > 0) {
    defaults.filters = filters;
  }

  return { defaults, inputFiles, files, unsupported };
}

/** Keys whose value is one path. */
const PATH_KEYS = [
  'template',
  'bibliography',
  'csl',
  'citation-abbreviations',
  'reference-doc',
  'epub-cover-image',
  'epub-metadata',
  'abbreviations',
] as const;

/** Keys whose value is a list of paths. */
const PATH_LIST_KEYS = [
  'css',
  'include-in-header',
  'include-before-body',
  'include-after-body',
  'syntax-definitions',
  'epub-fonts',
  'metadata-files',
] as const;

/** Keys naming a folder rather than a file: one to search, and one to write into. */
const FOLDER_KEYS = ['resource-path', 'extract-media'] as const;

/** Where a path is to be put — a folder and a file are not moved the same way. */
export interface PathMap {
  file: (path: string) => string;
  directory: (path: string) => string;
}

/**
 * Every path in `defaults`, moved into the file system the conversion will actually run in.
 *
 * Each path goes through exactly one of the two maps, and only once: nothing here reads back what it has written.
 */
export function rewritePaths(defaults: PandocDefaults, move: PathMap): void {
  for (const key of [...PATH_KEYS, 'output-file'] as const) {
    const value = defaults[key];
    if (typeof value === 'string') {
      defaults[key] = move.file(value);
    }
  }
  /** Each item of a list, where it is a path — a list can hold anything, and only strings are moved. */
  const each = (value: unknown, one: (path: string) => string) =>
    (value as unknown[]).map(item => (typeof item === 'string' ? one(item) : item));

  for (const key of PATH_LIST_KEYS) {
    if (Array.isArray(defaults[key])) {
      defaults[key] = each(defaults[key], move.file);
    }
  }
  for (const key of FOLDER_KEYS) {
    const value = defaults[key];
    if (typeof value === 'string') {
      defaults[key] = move.directory(value);
    } else if (Array.isArray(value)) {
      defaults[key] = each(value, move.directory);
    }
  }
  if (defaults.filters) {
    defaults.filters = defaults.filters.map(filter => (hasPath(filter) ? { ...filter, path: move.file(filter.path) } : filter));
  }
}

/** The paths in `defaults` that name a file which has to be readable — folders and outputs are not among them. */
export function readablePaths(defaults: PandocDefaults): string[] {
  const paths: string[] = [];
  for (const key of PATH_KEYS) {
    if (typeof defaults[key] === 'string') {
      paths.push(defaults[key]);
    }
  }
  for (const key of PATH_LIST_KEYS) {
    if (Array.isArray(defaults[key])) {
      paths.push(...(defaults[key] as unknown[]).filter((v): v is string => typeof v === 'string'));
    }
  }
  for (const filter of defaults.filters ?? []) {
    if (hasPath(filter)) {
      paths.push(filter.path);
    }
  }
  return paths;
}
