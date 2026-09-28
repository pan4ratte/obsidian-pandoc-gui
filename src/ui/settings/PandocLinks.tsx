import type { App } from 'obsidian';
import { t } from '../../lang/helpers';
import pandoc from '../../pandoc/pandoc';
import { openExternal } from '../../system/platform';
import Icon from '../components/Icon';
import { UserGuideModal } from '../user_guide';
import ChangelogButton from './ChangelogButton';

/** What is read rather than set: Pandoc's manual, and the plugin's changelog and guide. */
export default (props: { app: App; changelogRead: boolean; onChangelog: () => void }) => (
  <div class="ex-pandoc-panel-row ex-pandoc-links">
    <button class="ex-action" onClick={() => openExternal(pandoc.manualUrl)}>
      <Icon name="book-marked" />
      {t.PANDOC_MANUAL}
    </button>

    <ChangelogButton read={props.changelogRead} onOpen={props.onChangelog} />

    <button class="ex-action" onClick={() => new UserGuideModal(props.app).open()}>
      <Icon name="book-open" />
      {t.USER_GUIDE}
    </button>
  </div>
);
