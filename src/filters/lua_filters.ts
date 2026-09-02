import { moment, requestUrl } from 'obsidian';
import type PandocGuiPlugin from '../main';

/* The lua-filter store. */

/** The shelves the store is divided into, in the order they are shown. */
export const LUA_FILTER_CATEGORIES = ['structure', 'citations', 'figures', 'prose', 'other'] as const;

export type LuaFilterCategory = (typeof LUA_FILTER_CATEGORIES)[number];

/** Where an entry with no category of its own — a third-party catalogue's — lands. */
export const DEFAULT_LUA_FILTER_CATEGORY: LuaFilterCategory = 'other';

const isCategory = (value: unknown): value is LuaFilterCategory => LUA_FILTER_CATEGORIES.includes(value as LuaFilterCategory);

/** The shelves that were named after an output format, and the shelf their filters stand on now. */
const MERGED_CATEGORIES: Record<string, LuaFilterCategory> = {
  word: 'prose',
  latex: 'prose',
  tools: 'other',
};

/** The shelf a value names, whatever the shelves were called when it was written. */
export const shelfOf = (value: unknown): LuaFilterCategory =>
  isCategory(value) ? value : (MERGED_CATEGORIES[value as string] ?? DEFAULT_LUA_FILTER_CATEGORY);

/** One row of the catalogue — everything a card shows, plus where to fetch it. */
export interface LuaFilterEntry {
  id: string;
  storeName: string;
  description: string;
  /** Who wrote it. Shown on the card, alongside the licence it is used under. */
  author: string;
  license?: string;
  category: LuaFilterCategory;
  /** The output formats the filter is written for, as families from `pandoc_format`. */
  formats?: string[];
  /** What has to be installed or set up for the filter to work at all. */
  requires?: string;
  /** Compared against the installed copy's to offer an update. */
  updated?: string;
  /** What the filter is called in `lua/`. Defaults to `<id>.lua`. */
  fileName?: string;
  /** Relative to the catalogue's base URL. */
  path?: string;
  /** Absolute URL, which wins over `path`. */
  url?: string;
  /** Where to read about it. */
  homepage?: string;
}

/** What a catalogue can say in another language — the three fields a card reads rather than acts on. */
export type LuaFilterTranslation = Partial<Pick<LuaFilterEntry, 'storeName' | 'description' | 'requires'>>;

/**
 * An entry as it stands in the catalogue: the English of it, and whatever it has been translated into.
 *
 * The translations travel with the catalogue rather than living in `lang/`, because the catalogue is a feed — a vault
 * can point `luaFilterRepoUrl` at another one, and a filter this plugin has never heard of still has to be able to
 * say what it is.
 */
export interface RawLuaFilterEntry extends LuaFilterEntry {
  i18n?: Record<string, LuaFilterTranslation>;
}

/**
 * The translation to read an entry through: the locale as Obsidian gives it, or the language of it — `ru` answers for
 * `ru-RU`, and a catalogue that spells the whole thing out is answered in kind.
 */
const translation = (entry: RawLuaFilterEntry, locale: string): LuaFilterTranslation =>
  entry.i18n?.[locale] ?? entry.i18n?.[locale.split('-')[0]] ?? {};

/** What is recorded in the settings once a filter is on disk. */
export interface InstalledLuaFilter {
  id: string;
  fileName: string;
  storeName: string;
  /** Only a filter of the user's own carries one: a catalogue's is read from the catalogue each time. */
  description?: string;
  updated?: string;
  category: LuaFilterCategory;
  /**
   * Recorded alongside the file so a template editor can tell whether the filter is any use to what it writes without
   * the catalogue in front of it.
   */
  formats?: string[];
}

/**
 * What tells a filter of the user's own from one the catalogue offers, in the id both are known by. No catalogue can
 * take an id back off the user: an entry that named itself this way would be skipped as a duplicate.
 */
export const LOCAL_FILTER_PREFIX = 'local:';

export const isLocalFilter = (id: string): boolean => id.startsWith(LOCAL_FILTER_PREFIX);

/** The three things a filter of the user's own is written from. */
export interface LuaFilterDraft {
  name: string;
  description?: string;
  code: string;
}

/**
 * A name as a file name: what a file system takes of it, and `filter` where that is nothing — a name written in
 * another script has no letters for this to keep.
 */
export const luaFileSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'filter';

/** The catalogue, unless a vault points `luaFilterRepoUrl` elsewhere. */
export const DEFAULT_LUA_FILTER_REPO_URL = 'https://raw.githubusercontent.com/pan4ratte/obsidian-pandoc-gui/main/lua-filters/';

// ── The pandoc argument a filter is used through ──────────────────────────────

/**
 * `${luaDir}` is a variable `export.ts` fills in at export time, so what is stored is the literal text — written
 * without a template literal so the `$` is plainly not this file's to interpolate.
 */
export const luaFilterArg = (fileName: string) => '--lua-filter="${luaDir}/' + fileName + '"';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `args` already runs the filter. */
export const hasLuaFilterArg = (args: string | undefined, fileName: string) => !!args && args.includes(luaFilterArg(fileName));

/** `args` with the filter appended, or unchanged if it is already there. */
export const addLuaFilterArg = (args: string | undefined, fileName: string) => {
  const arg = luaFilterArg(fileName);
  const current = args?.trim() ?? '';
  if (!current) {
    return arg;
  }
  return current.includes(arg) ? current : `${current} ${arg}`;
};

/**
 * The filter that writes transcluded notes into the document. Named here because where it stands among the others is
 * not a matter of taste — see `orderLuaFilters`.
 */
export const EMBEDS_FILTER = 'embeds.lua';

/** A lua filter on the command line, in every spelling pandoc takes for one. */
const LUA_FILTER_FLAG = /(?:--lua-filter|-L)[= ]("[^"]*"|[^\s"]+)/g;

/** Whether a matched flag is the embeds filter, whatever folder it was found in. */
const namesEmbeds = (value: string) => {
  const file = value.replace(/"/g, '');
  return file === EMBEDS_FILTER || file.endsWith(`/${EMBEDS_FILTER}`) || file.endsWith(`\\${EMBEDS_FILTER}`);
};

/**
 * `command` with the embeds filter ahead of every other lua filter.
 *
 * Pandoc runs filters in the order they are written, and this one is not one among equals: it reads the transcluded
 * notes and parses them into the document, so every filter after it sees that writing and every filter before it
 * sees a broken image where a page should be. The order it ends up in otherwise is an accident — the presets put it
 * first, but a row toggled off and on again appends it, and the preset's own filters are on the line before the
 * rows' are. The one rule is applied where the command is assembled, so what the preview shows is what runs.
 */
export const orderLuaFilters = (command: string) => {
  const flags = [...command.matchAll(LUA_FILTER_FLAG)];
  const first = flags[0];
  const embeds = flags.find(flag => namesEmbeds(flag[1]));
  if (!first || !embeds || first.index === embeds.index) {
    return command;
  }
  // Cut where it stands, taking one space with it, then put it back in front of the first filter — which is earlier
  // in the line, so the cut leaves its offset where it was.
  const before = command.slice(0, embeds.index);
  const after = command.slice(embeds.index + embeds[0].length);
  const cut = after.startsWith(' ') ? before + after.slice(1) : before.replace(/ $/, '') + after;
  return `${cut.slice(0, first.index)}${embeds[0]} ${cut.slice(first.index)}`;
};

/** `args` with the filter taken out, and the gap it left closed up. */
export const removeLuaFilterArg = (args: string | undefined, fileName: string) => {
  if (!args) {
    return args ?? '';
  }
  return args
    .replace(new RegExp(`\\s*${escapeRegExp(luaFilterArg(fileName))}`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ── Manager ───────────────────────────────────────────────────────────────────

/** Fetches the catalogue and owns the files in `lua/`. */
export class LuaFilterManager {
  /** `bundled` is the list of filters the plugin ships with. */
  constructor(
    private plugin: PandocGuiPlugin,
    private bundled: readonly string[] = []
  ) {}

  /** Base URL of the catalogue, always ending in "/". */
  private baseUrl(): string {
    const raw = (this.plugin.settings.luaFilterRepoUrl || '').trim() || DEFAULT_LUA_FILTER_REPO_URL;
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  /** Where a filter is written, vault-relative. */
  private filePath(fileName: string): string {
    return `${this.plugin.manifest.dir}/lua/${fileName}`;
  }

  /** The filters this plugin ships with, which a download must never replace. */
  isBundled(fileName: string): boolean {
    return this.bundled.includes(fileName);
  }

  /** What a catalogue entry is called on disk. */
  fileNameOf(entry: LuaFilterEntry): string {
    return entry.fileName ?? `${entry.id.substring(entry.id.indexOf(':') + 1)}.lua`;
  }

  // ── Catalogue ───────────────────────────────────────────────────────────────

  /** The catalogue, as entries. */
  async fetchCatalogue(): Promise<LuaFilterEntry[]> {
    const res = await requestUrl({ url: `${this.baseUrl()}index.json` });
    const data = res.json as { filters?: unknown };
    if (!data || !Array.isArray(data.filters)) {
      throw new Error('Malformed catalogue (missing "filters" array)');
    }

    const entries: LuaFilterEntry[] = [];
    const taken = new Set<string>(this.bundled);

    // What the cards are read in. A card says nothing the plugin wrote — every word of it comes from the catalogue —
    // so this is the one place the language is chosen.
    const locale = moment.locale();

    for (const f of data.filters as Partial<RawLuaFilterEntry>[]) {
      // A row with nothing to fetch, or nothing to call it, is not a row — and one malformed row does not take the
      // catalogue down with it.
      if (typeof f?.id !== 'string' || (typeof f.path !== 'string' && typeof f.url !== 'string')) {
        continue;
      }
      // Translated field by field, and English wherever a translation stops: half a card in the reader's language
      // beats a card that says nothing.
      const text = translation(f as RawLuaFilterEntry, locale);
      const entry: LuaFilterEntry = {
        id: f.id,
        storeName: text.storeName ?? f.storeName ?? f.id,
        description: text.description ?? f.description ?? '',
        author: f.author ?? '',
        license: f.license,
        category: shelfOf(f.category),
        formats: Array.isArray(f.formats) ? f.formats.filter(v => typeof v === 'string') : undefined,
        requires: text.requires ?? f.requires,
        updated: f.updated,
        fileName: f.fileName,
        path: f.path,
        url: f.url,
        homepage: f.homepage,
      };
      const fileName = this.fileNameOf(entry);
      if (taken.has(fileName)) {
        continue;
      }
      taken.add(fileName);
      entries.push(entry);
    }
    return entries;
  }

  // ── Install / uninstall ─────────────────────────────────────────────────────

  /** Download an entry and write it into `lua/`, returning the record to store. */
  async install(entry: LuaFilterEntry, installed: readonly InstalledLuaFilter[]): Promise<InstalledLuaFilter> {
    const fileName = this.fileNameOf(entry);
    if (!/^[\w.@+-]+\.lua$/.test(fileName)) {
      throw new Error(`"${fileName}" is not a usable file name`);
    }
    if (this.isBundled(fileName)) {
      throw new Error(`"${fileName}" is one of the filters this plugin ships with`);
    }
    const clash = installed.find(f => f.fileName === fileName && f.id !== entry.id);
    if (clash) {
      throw new Error(`"${fileName}" is already taken by "${clash.storeName}"`);
    }

    const url = entry.url ?? this.baseUrl() + entry.path;
    const res = await requestUrl({ url });
    const text = res.text;
    if (!text?.trim()) {
      throw new Error('The downloaded filter is empty');
    }

    await this.plugin.app.vault.adapter.write(this.filePath(fileName), text);
    return {
      id: entry.id,
      fileName,
      storeName: entry.storeName,
      updated: entry.updated,
      category: entry.category,
      formats: entry.formats,
    };
  }

  /** `<base>.lua`, or the first number after it that nothing on disk has taken. */
  private freeFileName(base: string, installed: readonly InstalledLuaFilter[]): string {
    const taken = (file: string) => this.isBundled(file) || installed.some(f => f.fileName === file);
    for (let n = 1; n <= 99; n += 1) {
      const candidate = n === 1 ? `${base}.lua` : `${base}-${n}.lua`;
      if (!taken(candidate)) {
        return candidate;
      }
    }
    throw new Error(`There are already too many filters called "${base}"`);
  }

  /** What a draft says, checked and tidied: the same reading whether the filter is being written or rewritten. */
  private draftOf(draft: LuaFilterDraft) {
    const storeName = draft.name.trim();
    if (!storeName) {
      throw new Error('The filter needs a name');
    }
    // Written with the line endings a lua interpreter reads, and ending in the newline a text file ends in.
    const code = draft.code.replace(/\r\n?/g, '\n').trimEnd();
    if (!code) {
      throw new Error('The filter is empty');
    }
    return { storeName, description: draft.description?.trim() || undefined, code };
  }

  private async writeFilter(fileName: string, code: string): Promise<void> {
    await this.plugin.app.vault.adapter.write(this.filePath(fileName), `${code}\n`);
  }

  /**
   * Write a filter of the user's own into `lua/`, and answer the record to store. From there on it stands among the
   * installed ones: the template editor lists it, and removing it deletes the file as it does for any other. It is
   * given no formats, which is what says it runs in all of them — a filter the user wrote is theirs to point wherever
   * they like.
   */
  async create(draft: LuaFilterDraft, installed: readonly InstalledLuaFilter[]): Promise<InstalledLuaFilter> {
    const { storeName, description, code } = this.draftOf(draft);
    const fileName = this.freeFileName(luaFileSlug(storeName), installed);
    await this.writeFilter(fileName, code);
    return {
      id: LOCAL_FILTER_PREFIX + fileName.slice(0, -'.lua'.length),
      fileName,
      storeName,
      description,
      category: DEFAULT_LUA_FILTER_CATEGORY,
    };
  }

  /**
   * Rewrite one that is already on disk. The file keeps the name it was given, whatever the filter is renamed to: a
   * template runs a filter by naming its file, and a rename would leave every one of them pointing at nothing.
   */
  async update(filter: InstalledLuaFilter, draft: LuaFilterDraft): Promise<InstalledLuaFilter> {
    const { storeName, description, code } = this.draftOf(draft);
    await this.writeFilter(filter.fileName, code);
    return { ...filter, storeName, description };
  }

  /** What a filter holds, read back into the field it was written in. */
  async readFilter(filter: InstalledLuaFilter): Promise<string> {
    return await this.plugin.app.vault.adapter.read(this.filePath(filter.fileName));
  }

  /** Delete a filter's file. A file already gone is the state that was wanted. */
  async uninstall(filter: InstalledLuaFilter): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    const filePath = this.filePath(filter.fileName);
    if (await adapter.exists(filePath)) {
      await adapter.remove(filePath);
    }
  }
}
