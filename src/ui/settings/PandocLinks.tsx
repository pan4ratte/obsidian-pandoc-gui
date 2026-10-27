import type { App } from 'obsidian';
import { t } from '../../lang/helpers';
import pandoc from '../../pandoc/pandoc';
import { openExternal } from '../../system/platform';
import Icon from '../components/Icon';
import { UserGuideModal } from '../user_guide';
import ChangelogButton from './ChangelogButton';
import { ActionCard } from './DashboardCard';

/** What is read rather than set: Pandoc's manual, and the plugin's changelog and guide. The caller lays them out. */
export default (props: { app: App; version: string; changelogRead: boolean; onChangelog: () => void }) => (
  <>
    <ActionCard icon={<Icon name="book-marked" />} title={t.PANDOC_MANUAL} onClick={() => openExternal(pandoc.manualUrl)} />
    <ChangelogButton version={props.version} read={props.changelogRead} onOpen={props.onChangelog} />
    <ActionCard icon={<Icon name="book-open" />} title={t.USER_GUIDE} wrap onClick={() => new UserGuideModal(props.app).open()} />
  </>
);
