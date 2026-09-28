import { Notice, type App } from 'obsidian';
import { Show, createEffect, createMemo, createResource, createSignal, on } from 'solid-js';
import { t } from '../../lang/helpers';
import { isMobileUi } from '../../system/platform';
import { isNewerRelease, type PandocWasmManager, type WasmRelease } from '../../wasm/install';
import { pandocWasmSupport } from '../../wasm/support';
import Button from '../components/Button';
import Icon from '../components/Icon';
import type { PanelNotice } from './PandocNotices';

const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * The wasm build: whether it is here, and how to get it.
 *
 * It is a 56 MB download, so nothing happens until it is asked for — and once it is, the one button does the whole
 * thing: fetch the release, unpack it, put it in place.
 */
export default (props: {
  app: App;
  manager: PandocWasmManager;
  /** The version on disk, as the settings recorded it. */
  version?: string;
  /** The version now on disk, or nothing where it has just been removed. */
  onInstalled: (version?: string) => void;
  /** What this half has to say at length, which the card says under both of them. */
  onNotices: (notices: PanelNotice[]) => void;
  /** Open what the build can be given past itself — typst, and the fonts a document is set in. */
  onExtensions: () => void;
}) => {
  const [supported] = createResource(pandocWasmSupport);
  const [latest] = createResource(async () => {
    try {
      return await props.manager.latest();
    } catch {
      return undefined;
    }
  });
  /** What the panel is doing, while it is doing it — the buttons stand down until it is finished. */
  const [busy, setBusy] = createSignal<string>();
  /** Why the installed binary would not start, in the engine's own words. */
  const [failed, setFailed] = createSignal<string>();

  /**
   * Whether the binary is on disk. The recorded version says which one it is, but a file deleted from outside
   * Obsidian would otherwise leave the panel offering to remove something that is not there — and, worse, nothing to
   * install.
   */
  const [onDisk, { refetch: lookAgain }] = createResource(() => props.manager.isInstalled());
  const installed = () => !!props.version && onDisk() !== false;

  /** What the build is for, and what it costs. */
  const hint = `${t.WASM_HINT} ${t.WASM_SIZE}`;

  const updatable = createMemo(() => {
    const release = latest();
    return installed() && !!release && isNewerRelease(release, props.version);
  });

  const status = createMemo(() => {
    if (supported()?.ok === false || failed()) {
      return 'missing';
    }
    if (!installed()) {
      return 'absent';
    }
    return updatable() ? 'outdated' : 'ok';
  });

  /** The short of it, beside the dot. Why a device will not run it, and what syncing it costs, go below the halves. */
  const statusText = createMemo(() => {
    if (busy()) {
      return busy();
    }
    // One word for both the guess and the binary's own refusal — a dot with nothing beside it is a state nobody can
    // read. Which of the two it was, and why, is the line under the halves.
    if (failed() || supported()?.ok === false) {
      return t.WASM_UNSUPPORTED;
    }
    if (!installed()) {
      return t.WASM_ABSENT;
    }
    if (updatable()) {
      return t.PANDOC_UPDATE_AVAILABLE(latest().version);
    }
    // Installed and nothing newer — as far as a lookup that was made can say.
    return latest() ? t.PANDOC_UP_TO_DATE : t.PANDOC_UPDATE_CHECK_FAILED;
  });

  /** Only what is wrong: a card with nothing the matter with it carries no line under its halves. */
  const notices = createMemo<PanelNotice[]>(() => {
    // What the binary said when it would not start beats what the probe guessed before it was ever downloaded.
    if (failed()) {
      return [{ text: t.WASM_LOAD_FAILED(failed()), tone: 'error' }];
    }
    if (supported()?.ok === false) {
      return [{ text: t.WASM_UNAVAILABLE, tone: 'error' }];
    }
    return [];
  });

  createEffect(() => props.onNotices(notices()));

  const install = async (release: WasmRelease) => {
    const said = { downloading: t.WASM_DOWNLOADING(megabytes(release.size)), extracting: t.WASM_EXTRACTING, writing: t.WASM_WRITING };
    setBusy(said.downloading);
    try {
      const version = await props.manager.install(release, stage => setBusy(said[stage]));
      void lookAgain();
      props.onInstalled(version);

      // The probe only guessed; this is the binary actually starting, which is the answer that counts.
      setBusy(t.WASM_PREPARING);
      await props.manager.load();
      setFailed(undefined);
      new Notice(t.WASM_INSTALLED(release.version));
    } catch (e) {
      console.error(e);
      // Downloaded but unable to start is a different thing from a download that failed, and says so.
      const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      if (await props.manager.isInstalled()) {
        setFailed(reason);
        new Notice(t.WASM_LOAD_FAILED(reason));
      } else {
        new Notice(t.WASM_INSTALL_FAILED);
      }
    } finally {
      setBusy(undefined);
    }
  };

  // Removed from the extensions window: what the old binary said about starting no longer applies.
  createEffect(
    on(
      () => props.version,
      version => {
        if (!version) {
          setFailed(undefined);
          void lookAgain();
        }
      },
      { defer: true }
    )
  );

  return (
    <div class="ex-pandoc-dashboard-half ex-wasm-half">
      <div class="ex-wasm-half-main">
        <div class="ex-pandoc-dashboard-version">
          {installed() ? t.WASM_VERSION(props.version) : t.WASM_TITLE}

          {/* Only while there is nothing installed: what the build is for is a question the answer to it settles.
            Read by hovering, and on a phone — where there is no hovering — by pressing. */}
          <Show when={!installed()}>
            <Icon
              class="ex-pandoc-dashboard-hint"
              name="circle-question-mark"
              tooltip={hint}
              onClick={isMobileUi() ? () => new Notice(hint) : undefined}
            />
          </Show>
        </div>

        <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
          <span class="ex-pandoc-dashboard-indicator" />
          {/* The dot keeps the state even where the words for it are too long to stand here. */}
          <Show when={statusText()}>
            <span>{statusText()}</span>
          </Show>

          {/* What to do about what the line says, beside it. Nothing here yet is the one worth a word of its own;
            a newer build and the copy already installed are what the line has just named.

            Offered whatever the probe thought: it is a guess, and being wrong about it must not be what stops
            someone installing. The binary itself answers on this same line, once it has been asked. */}
          <Show when={latest() && (!installed() || failed())}>
            <Button
              class="ex-pandoc-dashboard-inline is-cta"
              tooltip={`${installed() ? t.WASM_UPDATE : t.WASM_INSTALL}. ${t.WASM_SIZE}`}
              disabled={!!busy()}
              onClick={() => void install(latest())}
            >
              <Icon name="download" />
            </Button>
          </Show>
          <Show when={updatable() && !failed()}>
            <Button class="ex-pandoc-dashboard-inline" tooltip={t.WASM_UPDATE} disabled={!!busy()} onClick={() => void install(latest())}>
              <Icon name="download" />
            </Button>
          </Show>
        </div>
      </div>

      {/* At the end of the half rather than in the line of statuses: what the build can be given past itself is about
          the build, not about how it is doing. Only once there is one — typst and its fonts are of no use beside a
          pandoc that is not here. */}
      <Show when={installed()}>
        <Button class="ex-wasm-extensions" tooltip={t.EXT_TITLE} disabled={!!busy()} onClick={props.onExtensions}>
          <Icon name="cog" />
        </Button>
      </Show>
    </div>
  );
};
