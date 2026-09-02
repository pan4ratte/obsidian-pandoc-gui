import { Notice, type App } from 'obsidian';
import { For, Show, createMemo, createResource, createSignal, type JSX } from 'solid-js';
import { t } from '../../lang/helpers';
import { FONT_PACKS, TYPST_VERSION, type FontPackId, type TypstWasmManager } from '../../wasm/typst';
import { EXTENSIONS, type ExtensionId, type ExtensionManager } from '../../wasm/extensions';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import FolderInput from '../components/FolderInput';
import { tooltip } from '../components/tooltip';

const megabytes = (bytes: number) => (bytes < 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) : String(Math.round(bytes / 1024 / 1024)));

/** What each card is doing, by card — the text the row along its foot shows while it does it. */
type Busy = Record<string, string | undefined>;

const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));

/**
 * What the wasm build can be given past itself.
 *
 * Pandoc's build is one file that does one thing; everything that widens what it can do is a download of its own, and
 * this is where they are. The cards are the filter store's, because it is the same bargain: what it is, what it costs,
 * and one button to have it.
 */
export default (props: {
  app: App;
  manager: TypstWasmManager;
  extensions: ExtensionManager;
  /** The typst version on disk, as the settings recorded it. */
  version?: string;
  fontsDir?: string;
  onInstalled: (version?: string) => void;
  onFontsDir: (folder: string) => void;
  onClose: () => void;
}) => {
  const [busy, setBusy] = createSignal<Busy>({});
  const working = (id: string) => !!busy()[id];
  const say = (id: string, what?: string) => setBusy((prev: Busy): Busy => ({ ...prev, [id]: what }));

  const [onDisk, { refetch: lookAgain }] = createResource(() => props.manager.isInstalled());
  const installed = () => !!props.version && onDisk() !== false;
  /** Older than the version this release was tested against — the pin in `src/wasm/typst.ts`. */
  const outdated = () => installed() && props.version !== TYPST_VERSION;

  const [emoji, { refetch: lookForEmoji }] = createResource(
    () => installed() || undefined,
    () => props.manager.hasFonts('emoji')
  );
  const [fonts, { refetch: countFonts }] = createResource(
    () => installed() || undefined,
    async () => ({ all: await props.manager.fontCount(), vault: await props.manager.vaultFontCount() })
  );

  /** Which of the file extensions are on disk, asked once for all of them and again after any of them changes. */
  const [files, { refetch: lookForFiles }] = createResource(async () => {
    const found: Partial<Record<ExtensionId, boolean>> = {};
    for (const id of Object.keys(EXTENSIONS) as ExtensionId[]) {
      found[id] = await props.extensions.isInstalled(id);
    }
    return found;
  });

  const withBusy = async (id: string, run: (report: (what: string) => void) => Promise<void>): Promise<void> => {
    say(id, '…');
    try {
      await run(what => say(id, what));
    } catch (e) {
      console.error(e);
      new Notice(t.EXT_FAILED(message(e)));
    } finally {
      say(id, undefined);
    }
  };

  const installTypst = (): void =>
    void withBusy('typst', async (report): Promise<void> => {
      const version = await props.manager.install((stage, done, total) =>
        report(stage === 'fonts' ? t.TYPST_FONTS(done ?? 0, total ?? 0) : stage === 'writing' ? t.TYPST_WRITING : t.TYPST_DOWNLOADING)
      );
      void lookAgain();
      void countFonts();
      props.onInstalled(version);
      new Notice(t.TYPST_INSTALLED(version));
    });

  const removeTypst = (): void =>
    void withBusy('typst', async (): Promise<void> => {
      await props.manager.remove();
      void lookAgain();
      void lookForEmoji();
      props.onInstalled(undefined);
    });

  const installPack = (id: FontPackId): void =>
    void withBusy(id, async (report): Promise<void> => {
      await props.manager.installFonts(id, (_stage, done, total) => report(t.EXT_DOWNLOADING(done ?? 0, total ?? 0)));
      void lookForEmoji();
      void countFonts();
    });

  const removePack = (id: FontPackId): void =>
    void withBusy(id, async (): Promise<void> => {
      await props.manager.removeFonts(id);
      void lookForEmoji();
      void countFonts();
    });

  const installFiles = (id: ExtensionId): void =>
    void withBusy(id, async (report): Promise<void> => {
      await props.extensions.install(id, (done, total) => report(t.EXT_DOWNLOADING(done, total)));
      void lookForFiles();
    });

  const removeFiles = (id: ExtensionId): void =>
    void withBusy(id, async (): Promise<void> => {
      await props.extensions.remove(id);
      void lookForFiles();
    });

  /** One card: what it is, what it costs, and what can be done about it. */
  const Card = (card: {
    id: string;
    name: string;
    description: string;
    /** The line along the foot, beside the buttons — what it costs, or where what was installed now is. */
    note?: string;
    installed?: boolean;
    /** Whether the download button is offered as an update rather than a first install. */
    update?: boolean;
    /** Why it cannot be had yet, which is said in place of the note. */
    blocked?: string;
    onInstall?: () => void;
    onRemove?: () => void;
    children?: JSX.Element;
  }) => {
    /** One line, and the three things that can claim it, in the order of what is worth reading. */
    const line = () => busy()[card.id] ?? card.blocked ?? card.note;

    return (
      <div class="ex-lua-card" classList={{ 'is-installed': !!card.installed }}>
        <div class="ex-lua-card-main">
          <div class="ex-lua-card-head">
            <span class="ex-lua-name">{card.name}</span>
          </div>
          <p class="ex-lua-desc">{card.description}</p>
          {card.children}
        </div>

        {/* `is-credited` is what the store marks a row whose buttons are not the whole of it: the line takes the width
            and the buttons keep to the end of it. Marked always, so a card with nothing to say still ends that way. */}
        <div class="ex-lua-actions is-credited">
          <span class="ex-ext-note" classList={{ 'is-blocked': !!card.blocked && !busy()[card.id] }}>
            {line()}
          </span>

          <Show when={card.onInstall && !card.blocked && (!card.installed || card.update)}>
            <button
              class="ex-lua-install"
              ref={el => tooltip(el, () => (card.update ? t.EXT_UPDATE : t.EXT_INSTALL))}
              disabled={working(card.id)}
              onClick={() => card.onInstall()}
            >
              <Icon name={card.update ? 'refresh-cw' : 'download'} />
            </button>
          </Show>
          <Show when={card.installed && card.onRemove}>
            <button
              class="ex-lua-uninstall"
              ref={el => tooltip(el, () => t.EXT_REMOVE)}
              disabled={working(card.id)}
              onClick={() => card.onRemove()}
            >
              <Icon name="trash-2" />
            </button>
          </Show>
        </div>
      </div>
    );
  };

  const typstNote = createMemo(() => {
    if (!installed()) {
      return t.EXT_SIZE(megabytes(36 * 1024 * 1024));
    }
    return outdated() ? t.EXT_OUTDATED(props.version, TYPST_VERSION) : t.TYPST_VERSION(props.version);
  });

  /** The files a card installed, said as the path a template writes to reach them — or what it will cost to have them. */
  const filesNote = (id: ExtensionId) => {
    if (files()?.[id]) {
      return t.EXT_AT(props.extensions.templatePath(id));
    }
    // Nothing to download is not nothing to say: the one pandoc writes itself has no size to give.
    return EXTENSIONS[id].size > 0 ? t.EXT_SIZE(megabytes(EXTENSIONS[id].size)) : t.EXT_MADE;
  };

  /** The cards that are a folder of files and nothing else, which are all the same card. */
  const FILE_CARDS: { id: ExtensionId; name: string; description: string }[] = [
    { id: 'csl', name: t.EXT_CSL_TITLE, description: t.EXT_CSL_DESC },
    { id: 'templates', name: t.EXT_TEMPLATES_TITLE, description: t.EXT_TEMPLATES_DESC },
    { id: 'reference', name: t.EXT_REFERENCE_TITLE, description: t.EXT_REFERENCE_DESC },
    { id: 'mathjax', name: t.EXT_MATHJAX_TITLE, description: t.EXT_MATHJAX_DESC },
  ];

  return (
    <Modal app={props.app} title={t.EXT_TITLE} classList={{ 'ex-lua-modal': true, 'ex-ext-modal': true }} onClose={props.onClose}>
      <p class="ex-ext-intro">{t.EXT_INTRO}</p>

      <div class="ex-lua-list">
        <Card
          id="typst"
          name={t.TYPST_TITLE}
          description={t.TYPST_HINT}
          note={typstNote()}
          installed={installed()}
          update={outdated()}
          onInstall={installTypst}
          onRemove={removeTypst}
        />

        <Card
          id="fonts"
          name={t.EXT_FONTS_TITLE}
          description={t.EXT_FONTS_DESC}
          note={installed() ? t.TYPST_FONTS_FOUND(fonts()?.all ?? 0) : undefined}
          blocked={installed() ? undefined : t.EXT_NEEDS_TYPST}
        >
          {/* The folder itself, because a card about fonts that cannot be pointed at any is half a card. */}
          <Show when={installed()}>
            <div class="ex-ext-field">
              <FolderInput
                app={props.app}
                value={props.fontsDir ?? ''}
                placeholder={t.EXT_FONTS_PLACEHOLDER}
                onChange={folder => {
                  props.onFontsDir(folder);
                  void countFonts();
                }}
              />
              <Show when={props.fontsDir}>
                <span class="ex-ext-field-note">{t.EXT_FONTS_VAULT(fonts()?.vault ?? 0)}</span>
              </Show>
            </div>
          </Show>
        </Card>

        <Card
          id="emoji"
          name={t.EXT_EMOJI_TITLE}
          description={t.EXT_EMOJI_DESC}
          note={t.EXT_SIZE(megabytes(FONT_PACKS.emoji.size))}
          installed={emoji() === true}
          blocked={installed() ? undefined : t.EXT_NEEDS_TYPST}
          onInstall={() => installPack('emoji')}
          onRemove={() => removePack('emoji')}
        />

        <For each={FILE_CARDS}>
          {card => (
            <Card
              id={card.id}
              name={card.name}
              description={card.description}
              note={filesNote(card.id)}
              installed={files()?.[card.id] === true}
              onInstall={() => installFiles(card.id)}
              onRemove={() => removeFiles(card.id)}
            />
          )}
        </For>
      </div>
    </Modal>
  );
};
