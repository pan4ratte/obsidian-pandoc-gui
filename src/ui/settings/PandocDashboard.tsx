import { Show, createEffect, createMemo, createResource, onCleanup } from 'solid-js';
import type { SemVer } from 'semver';
import { t } from '../../lang/helpers';
import pandoc, { type PandocRelease } from '../../pandoc/pandoc';
import Button from '../components/Button';
import Icon from '../components/Icon';
import PandocLogo from '../components/PandocLogo';
import { CardBadge } from './DashboardCard';
import type { PanelNotice } from './PandocNotices';
import { openExternal } from '../../system/platform';

/** Green / yellow / grey status line under the version. */
type Status = 'ok' | 'outdated' | 'checking' | 'absent';

/** A lookup that could not be made is the same as "no newer release known". */
const fetchLatestRelease = async (): Promise<PandocRelease | undefined> => {
  try {
    return await pandoc.getLatestRelease();
  } catch {
    return undefined;
  }
};

/** Installed Pandoc at a glance: which version is there, and whether it is the newest release. */
export default (props: {
  /** Nothing while the binary has not answered yet, `null` once it has answered that there is no pandoc. */
  version?: SemVer | null;
  /** Whether the vault writes Markdown links rather than wikilinks. */
  markdownLinks?: boolean;
  /** What this half has to say at length, which the card says under both of them. */
  onNotices: (notices: PanelNotice[]) => void;
}) => {
  const [latest] = createResource(fetchLatestRelease);

  const updateAvailable = createMemo(() => {
    const installed = props.version;
    const release = latest();
    return !!installed && !!release && release.version.compare(installed) === 1;
  });

  const status = createMemo<Status>(() => {
    // Not a fault, and not read as one: exporting with the wasm build alone is an answer someone can have chosen,
    // and the installed program is then simply not there to report on.
    if (props.version === null) {
      return 'absent';
    }
    if (!props.version || latest.loading) {
      return 'checking';
    }
    return updateAvailable() ? 'outdated' : 'ok';
  });

  const title = createMemo(() => (props.version ? t.PANDOC_VERSION(props.version.version) : t.PANDOC_TITLE));

  /** The short of it, under the version. What is longer than a line goes below the cards instead. */
  const statusText = createMemo(() => {
    switch (status()) {
      case 'absent':
        return t.PANDOC_NOT_INSTALLED;
      case 'checking':
        return t.PANDOC_CHECKING;
      case 'outdated':
        return t.PANDOC_UPDATE_AVAILABLE(latest().version.version);
      default:
        return latest() ? t.PANDOC_UP_TO_DATE : t.PANDOC_UPDATE_CHECK_FAILED;
    }
  });

  // Pandoc below the required version cannot resolve this vault's link style.
  const upgradeRequired = createMemo(
    () => !!props.version && !!props.markdownLinks && props.version.compare(pandoc.requiredVersion) === -1
  );

  const notices = createMemo<PanelNotice[]>(() => {
    const said: PanelNotice[] = [];
    if (status() === 'absent') {
      said.push({ key: 'pandoc-not-found', kind: 'info', title: t.PANDOC_NOT_FOUND_TITLE, text: t.PANDOC_NOT_FOUND });
    }
    if (upgradeRequired()) {
      said.push({
        key: 'pandoc-upgrade-required',
        kind: 'warning',
        title: t.PANDOC_UPGRADE_REQUIRED_TITLE(pandoc.requiredVersion),
        text: t.PANDOC_UPGRADE_REQUIRED(props.version.version),
      });
    }
    return said;
  });

  createEffect(() => props.onNotices(notices()));
  // A card that is no longer shown has nothing left to say — the wasm build is the one running.
  onCleanup(() => props.onNotices([]));

  return (
    <div class="ex-dashboard-card">
      <CardBadge>
        <PandocLogo />
      </CardBadge>
      <div class="ex-dashboard-text">
        <div class="ex-dashboard-title">{title()}</div>
        <div class="ex-dashboard-status" classList={{ [`is-${status()}`]: true }}>
          <span>{statusText()}</span>

          {/* What to do about what the line just said, beside it. */}
          <Show when={updateAvailable()}>
            <Button class="ex-dashboard-inline" tooltip={t.PANDOC_UPDATE} onClick={() => openExternal(latest().url)}>
              <Icon name="download" />
            </Button>
          </Show>
        </div>
      </div>
    </div>
  );
};
