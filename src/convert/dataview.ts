/* Dataview queries, rendered by Dataview and handed to `embeds.lua` to replace the code they are written as. */

import { Component, getFrontMatterInfo, type App, type TFile } from 'obsidian';

const DATAVIEW_PLUGIN = 'dataview';

const DQL_LANGUAGE = 'dataview';

/** How long a DataviewJS render must stay unchanged to count as finished, and the most it is waited for. */
const QUIET_MS = 500;
const RENDER_LIMIT_MS = 10_000;

/** Dataview draws a view's value slots first and fills them on a later frame, which a background window delays. */
const UNFILLED = 'td > span:empty, th > span:empty, li > span:empty';
/** How long an unfilled slot is waited on before it is taken for an empty value. */
const UNFILLED_QUIET_MS = 2_000;

const INDEX_LIMIT_MS = 10_000;

interface Result<T> {
  successful: boolean;
  value?: T;
  error?: string;
}

/** As much of Dataview's API as is used; every member optional, the installed version decides. */
interface DataviewApi {
  settings?: {
    dataviewJsKeyword?: string;
    inlineQueryPrefix?: string;
    inlineJsQueryPrefix?: string;
    enableDataviewJs?: boolean;
    enableInlineDataview?: boolean;
  };
  index?: { initialized?: boolean };
  value?: { toString?(value: unknown, settings?: unknown): string };
  queryMarkdown?(source: string, originFile?: string, settings?: { allowHtml?: boolean }): Promise<Result<string>>;
  executeJs?(code: string, container: HTMLElement, component: Component, filePath: string): Promise<void>;
  evaluateInline?(expression: string, origin: string): Result<unknown>;
}

export type QueryKind = 'dql' | 'js' | 'inline';

export interface Query {
  kind: QueryKind;
  /** The code block's language, empty for inline code: part of the key, so a plain `js` block is never matched. */
  language: string;
  /** What pandoc will read as the code's text. */
  code: string;
  /** What Dataview is given. */
  source: string;
}

export interface QuerySyntax {
  jsKeyword: string;
  inlinePrefix: string;
  inlineJsPrefix: string;
  js: boolean;
  inline: boolean;
}

export const DEFAULT_SYNTAX: QuerySyntax = {
  jsKeyword: 'dataviewjs',
  inlinePrefix: '=',
  inlineJsPrefix: '$=',
  js: true,
  inline: true,
};

export interface RenderedQuery {
  format: 'markdown' | 'html';
  text: string;
  /** A DataviewJS render still changing when the limit ran out. */
  unfinished?: boolean;
}

/** One rendered query, as `embeds.lua` looks it up. */
export interface QueryAnswer {
  note: string;
  key: string;
  format: RenderedQuery['format'];
  path: string;
}

const api = (app: App): DataviewApi | undefined =>
  (app.plugins?.plugins as Record<string, { api?: DataviewApi }> | undefined)?.[DATAVIEW_PLUGIN]?.api;

export const syntaxOf = (dataview: DataviewApi): QuerySyntax => {
  const settings = dataview.settings ?? {};
  return {
    jsKeyword: settings.dataviewJsKeyword || DEFAULT_SYNTAX.jsKeyword,
    inlinePrefix: settings.inlineQueryPrefix || DEFAULT_SYNTAX.inlinePrefix,
    inlineJsPrefix: settings.inlineJsQueryPrefix || DEFAULT_SYNTAX.inlineJsPrefix,
    js: settings.enableDataviewJs ?? DEFAULT_SYNTAX.js,
    inline: settings.enableInlineDataview ?? DEFAULT_SYNTAX.inline,
  };
};

/** `line` with `depth` blockquote markers taken off its start. */
const unquote = (line: string, depth: number): string => {
  let rest = line;
  for (let level = 0; level < depth; level++) {
    const marker = /^[ \t]*>/.exec(rest);
    if (!marker) {
      break;
    }
    rest = rest.slice(marker[0].length);
  }
  return rest;
};

const INLINE_CODE = /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;

/** Every Dataview query in a note's body, in the order written: fenced blocks, in blockquotes too, and inline `= …`. */
export const findQueries = (body: string, syntax: QuerySyntax = DEFAULT_SYNTAX): Query[] => {
  const found: Query[] = [];
  let open: { depth: number; fence: string; language: string; lines: string[] } | undefined;

  const close = () => {
    if (!open) {
      return;
    }
    const code = open.lines.join('\n');
    if (open.language === DQL_LANGUAGE) {
      found.push({ kind: 'dql', language: open.language, code, source: code });
    } else if (syntax.js && open.language === syntax.jsKeyword) {
      found.push({ kind: 'js', language: open.language, code, source: code });
    }
    open = undefined;
  };

  for (const line of body.split(/\r?\n/)) {
    if (open) {
      const inner = unquote(line, open.depth);
      const fence = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(inner);
      if (fence && fence[1][0] === open.fence[0] && fence[1].length >= open.fence.length) {
        close();
      } else {
        open.lines.push(inner);
      }
      continue;
    }

    const quotes = /^(?:[ \t]*>)*/.exec(line)?.[0] ?? '';
    const fence = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line.slice(quotes.length));
    // A backtick fence's info string cannot hold a backtick: that line is inline code.
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
      open = { depth: quotes.split('>').length - 1, fence: fence[1], language: fence[2].trim().split(/\s+/)[0], lines: [] };
      continue;
    }

    if (!syntax.inline) {
      continue;
    }
    for (const [, , content] of line.matchAll(INLINE_CODE)) {
      const text = content.trim();
      if (text.startsWith(syntax.inlineJsPrefix) || !text.startsWith(syntax.inlinePrefix)) {
        continue;
      }
      const source = text.slice(syntax.inlinePrefix.length).trim();
      if (source) {
        found.push({ kind: 'inline', language: '', code: content, source });
      }
    }
  }
  // An unclosed fence runs to the end of the note.
  close();
  return found;
};

/**
 * What `embeds.lua` looks a query up by: the SHA-1 of its language and its code with all whitespace gone, since pandoc
 * turns tabs into spaces and trims inline code. Only Lua's `%s` counts as whitespace, so both sides agree.
 */
export const queryKey = async (language: string, code: string): Promise<string> => {
  const text = `${language}\n${code.replace(/[ \t\n\r\f\v]/g, '')}`;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/** Dataview's index is filled in after startup; a query run before then finds nothing. */
const indexed = async (app: App, dataview: DataviewApi): Promise<void> => {
  if (dataview.index?.initialized !== false) {
    return;
  }
  await new Promise<void>(done => {
    const timer = window.setTimeout(finish, INDEX_LIMIT_MS);
    const ref = app.metadataCache.on('dataview:index-ready' as 'resolved', finish);
    function finish() {
      window.clearTimeout(timer);
      app.metadataCache.offref(ref);
      done();
    }
  });
};

/** Resolves once `container` holds something and has stopped changing, or the limit ran out: `true` if it settled. */
const settled = (container: HTMLElement): Promise<boolean> =>
  new Promise(done => {
    const start = Date.now();
    let changed = start;
    const observer = new MutationObserver(() => (changed = Date.now()));
    observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
    const timer = window.setInterval(() => {
      const now = Date.now();
      const quiet = now - changed;
      const ready = container.hasChildNodes() && ((quiet >= QUIET_MS && !container.querySelector(UNFILLED)) || quiet >= UNFILLED_QUIET_MS);
      if (ready || now - start >= RENDER_LIMIT_MS) {
        window.clearInterval(timer);
        observer.disconnect();
        done(ready);
      }
    }, 100);
  });

/** The rendered view as pandoc should read it: internal links as wikilinks, without the app's own furniture. */
const cleaned = (container: HTMLElement): string => {
  container.querySelectorAll('.small-text, .collapse-indicator, .list-collapse-indicator, button, svg').forEach(el => el.remove());
  container.querySelectorAll('[class]:not(a)').forEach(el => el.removeAttribute('class'));
  container.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.replaceWith(container.ownerDocument.createTextNode((box as HTMLInputElement).checked ? '☒ ' : '☐ '));
  });
  container.querySelectorAll('a.internal-link').forEach(link => {
    const target = link.getAttribute('data-href') ?? link.getAttribute('href') ?? '';
    for (const { name } of [...link.attributes]) {
      link.removeAttribute(name);
    }
    link.setAttribute('href', target);
    link.setAttribute('class', 'wikilink');
  });
  return container.innerHTML;
};

const runJs = async (dataview: DataviewApi, code: string, path: string): Promise<RenderedQuery> => {
  if (!dataview.executeJs) {
    throw new Error('This version of Dataview cannot run DataviewJS from another plugin');
  }
  const container = createDiv();
  const component = new Component();
  component.load();
  try {
    await dataview.executeJs(code, container, component, path);
    const finished = await settled(container);
    const error = container.querySelector('.dataview-error');
    if (error) {
      throw new Error(error.textContent?.trim() || 'DataviewJS error');
    }
    if (!container.hasChildNodes()) {
      throw new Error('The script showed nothing');
    }
    return { format: 'html', text: cleaned(container), unfinished: !finished };
  } finally {
    component.unload();
  }
};

const failed = <T>(result: Result<T> | undefined): never => {
  throw new Error(result?.error ?? 'Dataview returned nothing');
};

const run = async (dataview: DataviewApi, query: Query, path: string): Promise<RenderedQuery> => {
  switch (query.kind) {
    case 'dql': {
      // Without HTML a list in a table cell is written as text rather than as raw HTML most writers drop.
      const result = await dataview.queryMarkdown?.(query.source, path, { allowHtml: false });
      return result?.successful ? { format: 'markdown', text: result.value ?? '' } : failed(result);
    }
    case 'js':
      return runJs(dataview, query.source, path);
    case 'inline': {
      const result = dataview.evaluateInline?.(query.source, path);
      if (!result?.successful) {
        return failed(result);
      }
      const text = dataview.value?.toString?.(result.value, dataview.settings) ?? JSON.stringify(result.value);
      return { format: 'markdown', text };
    }
  }
};

export interface NoteQueries {
  /** What `embeds.lua` knows the note by: empty for the note being exported, the embed map's path for the rest. */
  note: string;
  file: TFile;
  /** By key; a query written twice in one note is rendered once. */
  queries: Map<string, Query>;
}

/** The queries in each note, or nothing where Dataview is not running. */
export const collectQueries = async (app: App, notes: Iterable<readonly [string, TFile]>): Promise<NoteQueries[]> => {
  const dataview = api(app);
  if (!dataview) {
    return [];
  }
  const syntax = syntaxOf(dataview);
  const collected: NoteQueries[] = [];
  for (const [note, file] of notes) {
    const text = await app.vault.cachedRead(file);
    const queries = new Map<string, Query>();
    for (const query of findQueries(text.slice(getFrontMatterInfo(text).contentStart), syntax)) {
      queries.set(await queryKey(query.language, query.code), query);
    }
    if (queries.size > 0) {
      collected.push({ note, file, queries });
    }
  }
  return collected;
};

export interface QueryOutcome {
  note: string;
  file: TFile;
  key: string;
  query: Query;
  rendered?: RenderedQuery;
  error?: string;
}

/** Every query rendered at once, so the DataviewJS waits overlap; one that fails is reported, not fatal. */
export const renderQueries = async (app: App, notes: readonly NoteQueries[]): Promise<QueryOutcome[]> => {
  const dataview = api(app);
  if (!dataview || notes.length === 0) {
    return [];
  }
  await indexed(app, dataview);
  return Promise.all(
    notes.flatMap(({ note, file, queries }) =>
      [...queries].map(async ([key, query]): Promise<QueryOutcome> => {
        try {
          return { note, file, key, query, rendered: await run(dataview, query, file.path) };
        } catch (e) {
          console.warn(`Could not run the Dataview query in "${file.path}"`, e);
          return { note, file, key, query, error: e instanceof Error ? e.message : String(e) };
        }
      })
    )
  );
};
