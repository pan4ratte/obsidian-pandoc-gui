import { Notice, Platform, type App } from 'obsidian';
import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { t } from '../../lang/helpers';
import { chooseFile, isDesktop, openExternal, vaultRoot } from '../../system/platform';
import { FileStore } from '../../system/file_store';
import { stem } from '../../system/paths';
import {
  DEFAULT_LUA_FILTER_CATEGORY,
  LOCAL_FILTER_PREFIX,
  LUA_FILTER_CATEGORIES,
  LuaFilterManager,
  isLocalFilter,
  shelfOf,
  type InstalledLuaFilter,
  type LuaFilterCategory,
  type LuaFilterEntry,
} from '../../filters/lua_filters';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import Collapsible from '../components/Collapsible';
import CodeEditor from '../components/CodeEditor';
import { tooltip } from '../components/tooltip';

/** The chips above the list: how a filter stands, then the shelf it sits on. */
type Chip = LuaFilterCategory | 'all' | 'installed' | 'updatable';

const CATEGORY_ICON: Record<LuaFilterCategory, string> = {
  structure: 'layers',
  citations: 'quote',
  figures: 'image',
  prose: 'type',
  other: 'wrench',
};

/** What the file dialog offers, ending in everything: a filter is as often kept under a name of the user's own. */
const LUA_FILES = [
  { name: 'Lua filter', extensions: ['lua'] },
  { name: 'All files', extensions: ['*'] },
];

/**
 * The card a new filter is written in, which is not one of the catalogue's — it stands for that card wherever an
 * entry's id would. A filter's slug is never empty, so nothing on disk can be known by the bare prefix.
 */
const DRAFT = LOCAL_FILTER_PREFIX;

/** What went wrong, in the words of whatever threw — an object gets its shape, not `[object Object]`. */
const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));

/**
 * The lua-filter store. Installing puts a filter on disk; which templates run it is settled
 * in the template editor. The records live in the settings, so changes go out through a
 * callback and come back in as a prop.
 */
export default (props: {
  app: App;
  manager: LuaFilterManager;
  installed: InstalledLuaFilter[];
  onInstalled: (filter: InstalledLuaFilter) => void;
  onUninstalled: (filter: InstalledLuaFilter) => void;
  onClose: () => void;
}) => {
  const [search, setSearch] = createSignal('');
  const [chip, setChip] = createSignal<Chip>('all');
  // Ids with a request in flight, so only that card's buttons go quiet.
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set());

  const [catalogue, { refetch }] = createResource(() => props.manager.fetchCatalogue());

  const withBusy = async (id: string, run: () => Promise<void>) => {
    setBusy(prev => new Set(prev).add(id));
    try {
      await run();
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const installedOf = (id: string) => props.installed.find(f => f.id === id);

  /** Installed filters the catalogue no longer offers. Still on disk, so still listed. */
  const orphans = createMemo<LuaFilterEntry[]>(() => {
    const known = new Set((catalogue() ?? []).map(e => e.id));
    return props.installed
      .filter(f => !known.has(f.id))
      .map(f => ({
        id: f.id,
        storeName: f.storeName,
        // Only a filter of the user's own carries one of these; a catalogue's orphan has nothing left to say.
        description: f.description ?? '',
        // Whose work a filter of the user's own is. A catalogue's orphan credits nobody: what it knew went with it.
        author: isLocalFilter(f.id) ? t.STORE_AUTHOR_YOU : '',
        category: shelfOf(f.category),
        updated: f.updated,
        fileName: f.fileName,
      }));
  });

  const allEntries = createMemo(() => [...(catalogue() ?? []), ...orphans()]);

  /** Whether an entry matches what has been typed. */
  const matchesSearch = (e: LuaFilterEntry) => {
    const f = search();
    if (!f) {
      return true;
    }
    const hit = (s?: string) => !!s && s.toLowerCase().includes(f);
    return hit(e.storeName) || hit(e.description) || hit(e.author) || hit(e.id);
  };

  const matched = createMemo(() => allEntries().filter(matchesSearch));

  /** Whether the catalogue has moved on from the copy on disk; ISO dates compare as strings. */
  const isUpdatable = (e: LuaFilterEntry) => {
    const mine = installedOf(e.id);
    return !!mine && !!e.updated && !!mine.updated && e.updated > mine.updated;
  };

  const inChip = (e: LuaFilterEntry, value: Chip) =>
    value === 'all' ? true : value === 'installed' ? !!installedOf(e.id) : value === 'updatable' ? isUpdatable(e) : e.category === value;

  /** Anything on disk that the catalogue has a newer copy of, whatever is being shown. */
  const updatableCount = createMemo(() => allEntries().filter(isUpdatable).length);

  /** Each chip counts what it would show for the current search, whichever chip is on. */
  const chips = createMemo(() => {
    const counted = (value: Chip) => matched().filter(e => inChip(e, value)).length;
    const shelves = LUA_FILTER_CATEGORIES.filter(c => c !== DEFAULT_LUA_FILTER_CATEGORY || allEntries().some(e => e.category === c));
    return [
      ['all', t.STORE_CHIP_ALL],
      ['installed', t.STORE_CHIP_INSTALLED],
      // Offered only when there is something to update, whatever is being shown.
      ...(updatableCount() > 0 ? ([['updatable', t.STORE_CHIP_UPDATABLE]] as const) : []),
      ...shelves.map(c => [c, t.STORE_CATEGORY_LABELS[c]] as const),
    ].map(([value, label]: [Chip, string]) => ({ value, label, count: counted(value) }));
  });

  // ── The chip row's overflow ─────────────────────────────────────────────────

  // `Modal` inserts children from an effect, so the row does not exist at mount.
  let row: HTMLDivElement | undefined;
  let observer: ResizeObserver | undefined;
  const [overflow, setOverflow] = createSignal({ left: false, right: false });

  /** Which edges are cut off. A pixel of slack absorbs sub-pixel rounding. */
  const syncOverflow = () => {
    if (!row) {
      return;
    }
    setOverflow({
      left: row.scrollLeft > 1,
      right: row.scrollWidth - row.clientWidth - row.scrollLeft > 1,
    });
  };

  /** Starts from the ref rather than `onMount`: the row's width follows the modal's. */
  const attachRow = (el: HTMLDivElement) => {
    row = el;
    observer = new ResizeObserver(syncOverflow);
    observer.observe(el);
    syncOverflow();
  };

  onCleanup(() => observer?.disconnect());

  /** A vertical wheel would scroll the modal, not this row, so turn it sideways. */
  const wheelToHorizontal = (e: WheelEvent) => {
    if (!row || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || row.scrollWidth <= row.clientWidth) {
      return;
    }
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  };

  // A chip appearing or disappearing changes what overflows just as a resize does.
  createEffect(() => {
    chips();
    syncOverflow();
  });

  const rows = createMemo(() =>
    matched()
      .filter(e => inChip(e, chip()))
      // Installed first, then by name.
      .sort((a, b) => {
        const mine = Number(!!installedOf(b.id)) - Number(!!installedOf(a.id));
        return mine || a.storeName.localeCompare(b.storeName);
      })
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const install = (entry: LuaFilterEntry) =>
    withBusy(entry.id, async () => {
      try {
        const filter = await props.manager.install(entry, props.installed);
        props.onInstalled(filter);
        new Notice(t.STORE_INSTALLED_NOTICE(filter.storeName));
      } catch (e) {
        new Notice(t.STORE_INSTALL_FAILED(message(e)));
      }
    });

  const uninstall = (entry: LuaFilterEntry) =>
    withBusy(entry.id, async () => {
      const filter = installedOf(entry.id);
      if (!filter) {
        return;
      }
      try {
        await props.manager.uninstall(filter);
        // Also takes it out of the templates that run it — nothing may point at a gone file.
        props.onUninstalled(filter);
        new Notice(t.STORE_UNINSTALLED_NOTICE(filter.storeName));
      } catch (e) {
        new Notice(t.STORE_UNINSTALL_FAILED(message(e)));
      }
    });

  // ── The filter being written ────────────────────────────────────────────────

  /** Which card stands open as a form: `DRAFT` for the one that adds a filter, or the id of one being rewritten. */
  const [drafting, setDrafting] = createSignal<string>();
  const [draftName, setDraftName] = createSignal('');
  const [draftDescription, setDraftDescription] = createSignal('');
  const [draftCode, setDraftCode] = createSignal('');

  const canSave = () => !!draftName().trim() && !!draftCode().trim() && !busy().has(drafting() ?? '');

  const closeDraft = () => setDrafting(undefined);

  /** The card opened on an empty filter. What was typed into it before is not kept: closing it is giving it up. */
  const openNewDraft = () => {
    setDraftName('');
    setDraftDescription('');
    setDraftCode('');
    setDrafting(DRAFT);
  };

  /** An installed filter of the user's own, opened in its own card with what is on disk in the field. */
  const openEdit = async (filter?: InstalledLuaFilter) => {
    if (!filter) {
      return;
    }
    let code: string;
    try {
      code = await props.manager.readFilter(filter);
    } catch {
      new Notice(t.STORE_ADD_READ_FAILED(filter.fileName));
      return;
    }
    setDraftName(filter.storeName);
    setDraftDescription(filter.description ?? '');
    setDraftCode(code);
    setDrafting(filter.id);
  };

  /** A filter kept as a file elsewhere on the device: read into the field, to be looked over and then saved. */
  const pickFile = async () => {
    const path = await chooseFile({ filters: LUA_FILES });
    if (!path) {
      return;
    }
    const bytes = await new FileStore(props.app.vault, vaultRoot(props.app.vault.adapter)).read(path);
    if (!bytes) {
      new Notice(t.STORE_ADD_READ_FAILED(path));
      return;
    }
    setDraftCode(new TextDecoder().decode(bytes));
    // The file's own name, unless the card has been given one already.
    if (!draftName().trim()) {
      setDraftName(stem(path));
    }
  };

  const saveDraft = () => {
    const target = drafting();
    if (!target) {
      return;
    }
    const editing = target === DRAFT ? undefined : installedOf(target);
    return withBusy(target, async () => {
      try {
        const draft = { name: draftName(), description: draftDescription(), code: draftCode() };
        const filter = editing ? await props.manager.update(editing, draft) : await props.manager.create(draft, props.installed);
        props.onInstalled(filter);
        new Notice(t.STORE_SAVED_NOTICE(filter.storeName));
        closeDraft();
      } catch (e) {
        new Notice(t.STORE_SAVE_FAILED(message(e)));
      }
    });
  };

  // ── The form, and the buttons that stand under it ───────────────────────────

  /** The fields, wherever they are being shown: the card that adds a filter, or the card of one being rewritten. */
  const DraftForm = () => (
    <div class="ex-lua-draft">
      <input
        type="text"
        class="ex-lua-draft-name"
        placeholder={t.STORE_ADD_NAME}
        spellcheck={false}
        value={draftName()}
        onInput={e => setDraftName(e.currentTarget.value)}
      />
      <input
        type="text"
        class="ex-lua-draft-description"
        placeholder={t.STORE_ADD_DESCRIPTION}
        value={draftDescription()}
        onInput={e => setDraftDescription(e.currentTarget.value)}
      />
      <CodeEditor value={draftCode()} placeholder={t.STORE_ADD_CODE} onInput={setDraftCode} />
    </div>
  );

  /** What the row along the foot of a card being written in holds. */
  const DraftActions = () => (
    <>
      {/* The way out of the card, in the row every other way out of a card is in. */}
      <button class="ex-lua-cancel" ref={el => tooltip(el, () => t.STORE_CANCEL)} onClick={closeDraft}>
        <Icon name="x" />
      </button>
      {/* There is no dialog to open where there is no file system to open it on. */}
      <Show when={isDesktop()}>
        <button class="ex-lua-pick" ref={el => tooltip(el, () => t.STORE_ADD_PICK_FILE)} onClick={() => void pickFile()}>
          <Icon name="folder-open" />
        </button>
      </Show>
      <button class="ex-lua-save" ref={el => tooltip(el, () => t.STORE_ADD_SAVE)} disabled={!canSave()} onClick={() => void saveDraft()}>
        <Icon name="save" />
      </button>
    </>
  );

  // ── Card ────────────────────────────────────────────────────────────────────

  const Card = (cardProps: { entry: LuaFilterEntry }) => {
    const entry = () => cardProps.entry;
    const filter = () => installedOf(entry().id);
    const updatable = () => isUpdatable(entry());
    const isBusy = () => busy().has(entry().id);
    // An orphan has nothing left to fetch, so it can only be removed.
    const installable = () => !!entry().url || !!entry().path;
    // Whose work this is, in the short form the card has room for; the whole of it is the tooltip, since a credit
    // that fits in a footer is not one that says what it is for.
    const credit = () =>
      entry().license ? t.STORE_ATTRIBUTION_LICENSE(entry().author, entry().license) : t.STORE_ATTRIBUTION(entry().author);
    const creditInFull = () => (entry().license ? t.STORE_ATTRIBUTION_FULL(entry().author, entry().license) : undefined);
    /** What the row along the foot of the card holds, which decides whether there is a row at all. */
    const credited = () => !!entry().author;
    const canInstall = () => installable() && (!filter() || updatable());
    /** A filter of the user's own is the only one there is anything to rewrite in. */
    const editable = () => !!filter() && isLocalFilter(entry().id);
    const editing = () => drafting() === entry().id;
    const hasActions = () => !!entry().homepage || canInstall() || !!filter();
    /** What the filter needs, a bullet each. The catalogue writes them as one field, so the ways a list is written
        into it are what they are split on. */
    const requirements = () =>
      (entry().requires ?? '')
        .split(/[\n;]+/)
        .map(item => item.trim())
        .filter(item => item);

    /** The row as it stands when the card is not being written in. */
    const CatalogueActions = () => (
      <>
        <Show when={editable()}>
          <button class="ex-lua-edit" ref={el => tooltip(el, () => t.STORE_EDIT)} onClick={() => void openEdit(filter())}>
            <Icon name="pencil" />
          </button>
        </Show>
        <Show when={entry().homepage}>
          <button class="ex-lua-readme" ref={el => tooltip(el, () => t.STORE_README)} onClick={() => openExternal(entry().homepage)}>
            <Icon name="book-open" />
          </button>
        </Show>
        <Show when={canInstall()}>
          <button
            class="ex-lua-install"
            ref={el => tooltip(el, () => (isBusy() ? t.STORE_INSTALLING : updatable() ? t.STORE_UPDATE : t.STORE_INSTALL))}
            disabled={isBusy()}
            onClick={() => void install(entry())}
          >
            <Icon name={updatable() ? 'refresh-cw' : 'download'} />
          </button>
        </Show>
        <Show when={filter()}>
          <button
            class="ex-lua-uninstall"
            ref={el => tooltip(el, () => t.STORE_UNINSTALL)}
            disabled={isBusy()}
            onClick={() => void uninstall(entry())}
          >
            <Icon name="trash-2" />
          </button>
        </Show>
      </>
    );

    return (
      <div class="ex-lua-card" classList={{ 'is-installed': !!filter() }}>
        <div class="ex-lua-card-main">
          <div class="ex-lua-card-head">
            <span class="ex-lua-name">{entry().storeName}</span>
            <Icon class="ex-lua-category-icon" name={CATEGORY_ICON[entry().category]} tooltip={t.STORE_CATEGORY_LABELS[entry().category]} />
          </div>
          {/* What the card says gives way to the fields it is being rewritten in. */}
          <Show when={!editing()}>
            <Show when={entry().description}>
              <p class="ex-lua-desc">{entry().description}</p>
            </Show>

            {/* Said before installing, not discovered in a failed export. */}
            <Show when={entry().requires}>
              <div class="ex-lua-requires">
                <span class="ex-lua-requires-label">{t.STORE_REQUIREMENTS}</span>
                <ul class="ex-lua-requires-list">
                  <For each={requirements()}>{item => <li>{item}</li>}</For>
                </ul>
              </div>
            </Show>
          </Show>
          <Collapsible when={editing()}>
            <DraftForm />
          </Collapsible>
        </div>

        {/* A card with neither a credit nor anything to do has no row along its foot, and no line over one. */}
        <Show when={credited() || hasActions() || editable()}>
          <div class="ex-lua-actions" classList={{ 'is-credited': credited() && !editing() }}>
            {/* The credit stands in the same row as the buttons, at the end the row is read from. Not while the card
                is being written in: those buttons are the whole row. */}
            <Show when={credited() && !editing()}>
              <span class="ex-lua-author" ref={el => tooltip(el, creditInFull)}>
                {credit()}
              </span>
            </Show>
            <Show when={editing()} fallback={<CatalogueActions />}>
              <DraftActions />
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <Modal app={props.app} title={t.STORE_TITLE} classList={{ 'ex-lua-modal': true }} onClose={props.onClose}>
      <input
        type="text"
        class="ex-lua-search"
        placeholder={t.STORE_SEARCH_PLACEHOLDER}
        spellcheck={false}
        onInput={e => setSearch(e.currentTarget.value.trim().toLowerCase())}
      />

      {/* Scrolls sideways rather than wrapping, so a chip never costs a line of height. */}
      <div class="ex-lua-filters-wrap">
        <div ref={attachRow} class="ex-lua-filters" onScroll={syncOverflow} onWheel={wheelToHorizontal}>
          <For each={chips()}>
            {c => (
              <button class="ex-lua-filter" classList={{ 'is-active': chip() === c.value }} onClick={() => setChip(c.value)}>
                {c.label}
                <Show when={!catalogue.loading}>
                  <span class="ex-lua-filter-count">({c.count})</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* The scrollbar is hidden, so a cut-off edge needs a chevron. Touch needs neither. */}
        <Show when={Platform.isDesktop}>
          <button
            class="ex-lua-filters-less"
            classList={{ 'is-visible': overflow().left }}
            ref={el => tooltip(el, () => t.STORE_MORE_FILTERS)}
            onClick={() => row?.scrollTo({ left: 0, behavior: 'smooth' })}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            class="ex-lua-filters-more"
            classList={{ 'is-visible': overflow().right }}
            ref={el => tooltip(el, () => t.STORE_MORE_FILTERS)}
            onClick={() => row?.scrollTo({ left: row.scrollWidth, behavior: 'smooth' })}
          >
            <Icon name="chevron-right" />
          </button>
        </Show>
      </div>

      <div class="ex-lua-list">
        {/* Standing above the catalogue rather than in it: a filter of the user's own is theirs to add whether the
            catalogue loaded or not. */}
        <div class="ex-lua-card ex-lua-add" classList={{ 'is-open': drafting() === DRAFT }}>
          <div class="ex-lua-card-main">
            {/* Open, the head is a card head like any other — the title, and nothing to press: the way out of the
                card is in the row along its foot. Closed, the card is only that head, so the head is the button
                that opens it, which is a button so that a key can reach it too. */}
            <Show
              when={drafting() === DRAFT}
              fallback={
                <button class="ex-lua-card-head ex-lua-add-head" onClick={openNewDraft}>
                  <Icon name="plus" />
                  <span class="ex-lua-name">{t.STORE_ADD_OWN}</span>
                </button>
              }
            >
              <div class="ex-lua-card-head">
                <span class="ex-lua-name">{t.STORE_ADD_OWN}</span>
              </div>
            </Show>
            <Collapsible when={drafting() === DRAFT}>
              <DraftForm />
            </Collapsible>
          </div>
          <Show when={drafting() === DRAFT}>
            <div class="ex-lua-actions">
              <DraftActions />
            </div>
          </Show>
        </div>

        <Switch>
          <Match when={catalogue.loading}>
            <p class="ex-lua-status">{t.STORE_LOADING}</p>
          </Match>
          <Match when={Boolean(catalogue.error)}>
            <p class="ex-lua-status">{t.STORE_LOAD_ERROR}</p>
            <button class="mod-cta ex-lua-retry" onClick={() => void refetch()}>
              {t.STORE_RETRY}
            </button>
          </Match>
          <Match when={rows().length === 0}>
            <p class="ex-lua-status">
              {allEntries().length === 0
                ? t.STORE_EMPTY
                : chip() === 'installed' && !search()
                  ? t.STORE_NONE_INSTALLED
                  : t.STORE_NO_RESULTS}
            </p>
          </Match>
          <Match when={rows().length > 0}>
            <For each={rows()}>{entry => <Card entry={entry} />}</For>
          </Match>
        </Switch>
      </div>
    </Modal>
  );
};
