import { stem } from '../../system/paths';
import { Notice } from 'obsidian';
import { JSX, Show, createMemo, createRoot, createSignal, onCleanup, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import { insert } from 'solid-js/web';
import type PandocGuiPlugin from '../../main';
import { t } from '../../lang/helpers';
import { importFile } from '../../convert/import';
import { isMobileUi, vaultRoot } from '../../system/platform';
import {
  DEFAULT_MARKDOWN_FLAVOUR,
  IMPORT_EXTENSIONS,
  MARKDOWN_FLAVOURS,
  readerFor,
  supportsExtractMedia,
  supportsMetadata,
  supportsStripComments,
  supportsTabStop,
  supportsTrackChanges,
  type MarkdownFlavour,
} from '../../pandoc/import_format';
import { TRACK_CHANGES, type ImportOptions } from '../../args/import_args';
import { SHIFT_HEADING_LEVELS, WRAP_MODES } from '../../args/writer_args';
import { supportsMarkdownHeadings, supportsReferenceLinks, supportsWrap } from '../../pandoc/pandoc_format';
import Modal from '../components/Modal';
import Button from '../components/Button';
import FileInput from '../components/FileInput';
import VaultFileInput from '../components/VaultFileInput';
import FolderInput from '../components/FolderInput';
import Group from '../components/Group';
import Setting, { DropDown, Text, Toggle } from '../components/Setting';

const SOURCE_FILES = [
  { name: t.IMPORT_DIALOG_FILE_FILTER, extensions: IMPORT_EXTENSIONS },
  { name: 'All files', extensions: ['*'] },
];

/** The folder the images of a document land in, where none was asked for by name. */
const defaultMediaFolder = (folder: string): string => (folder ? `${folder}/media` : 'media');

/**
 * A row for a path: the label, the field under it at the width of the row, and the line that answers the field under
 * that — where the note will be written, what it will be called.
 *
 * Written out rather than asked of `Setting`, whose description belongs to the label block: what a path row wants is
 * the description after the field, and a box cannot hold a thing that stands outside it.
 */
const PathSetting = (props: { name: string; description?: string; children?: JSX.Element }) => (
  <div class="setting-item ex-import-modal-path">
    <div class="setting-item-info">
      <div class="setting-item-name">{props.name}</div>
    </div>
    <div class="setting-item-control">{props.children}</div>
    {/* A row asked nothing gets no empty block under its field. */}
    <Show when={props.description}>
      <div class="setting-item-description">{props.description}</div>
    </Show>
  </div>
);

const Dialog = (props: { plugin: PandocGuiPlugin; onClose?: () => void }) => {
  const {
    plugin: { app, settings: globalSetting },
  } = props;

  const [hidden, setHidden] = createSignal(false);
  const [source, setSource] = createSignal('');
  // Where the last import went, or where the reader is standing — either beats the root of a vault of any size.
  const [folder, setFolder] = createSignal(globalSetting.lastImportFolder ?? app.workspace.getActiveFile()?.parent?.path ?? '');
  const [extractMedia, setExtractMedia] = createSignal(false);
  const [mediaFolder, setMediaFolder] = createSignal('');

  // The last flavour is remembered by name, and a release that stopped offering one would leave this naming nothing.
  const lastFlavour = MARKDOWN_FLAVOURS.find(flavour => flavour === globalSetting.lastImportFlavour);

  const [options, setOptions] = createStore<ImportOptions>({
    flavour: lastFlavour ?? DEFAULT_MARKDOWN_FLAVOUR,
    trackChanges: 'accept',
    standalone: true,
  });

  const reader = createMemo(() => readerFor(source()));
  // What the vault calls the chosen file, for the field that names one of its own.
  const vaultFile = createMemo(() => {
    const root = `${vaultRoot(app.vault.adapter)}/`;
    return source().startsWith(root) ? source().substring(root.length) : source();
  });
  const noteName = createMemo(() => (source() ? `${stem(source())}.md` : ''));

  const sourceDescription = () => {
    if (!source()) {
      return t.IMPORT_DIALOG_SOURCE_NONE;
    }
    return reader() ? t.IMPORT_DIALOG_SOURCE_FORMAT(reader()) : t.IMPORT_DIALOG_SOURCE_UNKNOWN;
  };

  const flavourOptions = MARKDOWN_FLAVOURS.map(flavour => ({ name: t.MARKDOWN_FLAVOUR_LABELS[flavour], value: flavour }));

  const trackChangesOptions = TRACK_CHANGES.map(change => ({ name: t.IMPORT_TRACK_CHANGES_LABELS[change], value: change }));

  // Named by what they do, not the number they write: `-1` is a promotion.
  const shiftHeadingOptions = [
    { name: t.SHIFT_HEADINGS_NONE, value: '' },
    ...SHIFT_HEADING_LEVELS.map(shift => ({
      name: shift < 0 ? t.SHIFT_HEADINGS_UP(-shift) : t.SHIFT_HEADINGS_DOWN(shift),
      value: String(shift),
    })),
  ];

  const wrapOptions = [{ name: t.WRAP_DEFAULT, value: '' }, ...WRAP_MODES.map(mode => ({ name: t.WRAP_MODE_LABELS[mode], value: mode }))];

  const headingStyleOptions = [
    { name: t.MARKDOWN_HEADINGS_DEFAULT, value: '' },
    { name: t.MARKDOWN_HEADINGS_SETEXT, value: 'setext' },
  ];

  const doImport = async () => {
    const plugin = props.plugin;
    if (!untrack(reader)) {
      new Notice(untrack(source) ? t.IMPORT_DIALOG_SOURCE_UNKNOWN : t.IMPORT_DIALOG_SOURCE_NONE, 2000);
      return;
    }
    setHidden(true);
    const imported = await importFile(plugin, {
      source: untrack(source),
      folder: untrack(folder),
      mediaFolder: untrack(extractMedia) ? untrack(mediaFolder) || defaultMediaFolder(untrack(folder)) : undefined,
      options: { ...options },
    });
    if (!imported) {
      setHidden(false);
      return;
    }
    globalSetting.lastImportFlavour = options.flavour;
    globalSetting.lastImportFolder = untrack(folder);
    await plugin.saveSettings();
    props.onClose?.();
  };

  return (
    <Modal app={app} title={t.IMPORT_DIALOG_TITLE} hidden={hidden()} classList={{ 'ex-import-modal': true }} onClose={props.onClose}>
      {/* What is imported, into what, and where: one card. */}
      <div class="ex-card">
        <Setting name={t.IMPORT_DIALOG_FLAVOUR} description={t.IMPORT_DIALOG_FLAVOUR_DESC}>
          <DropDown
            options={flavourOptions}
            selected={options.flavour}
            onChange={flavour => setOptions('flavour', flavour as MarkdownFlavour)}
          />
        </Setting>

        <PathSetting name={t.IMPORT_DIALOG_SOURCE} description={sourceDescription()}>
          {/* A file from anywhere on a desktop; on a phone, one that is already in the vault — there is no other
              document it could reach. */}
          <Show
            when={isMobileUi()}
            fallback={<FileInput value={source()} filters={SOURCE_FILES} tooltip={t.CHOOSE_FILE} onChange={setSource} />}
          >
            <VaultFileInput
              app={app}
              value={vaultFile()}
              extensions={IMPORT_EXTENSIONS}
              placeholder={t.IMPORT_DIALOG_SOURCE_NONE}
              onChange={path => setSource(path ? `${vaultRoot(app.vault.adapter)}/${path}` : '')}
            />
          </Show>
        </PathSetting>

        <PathSetting
          name={t.IMPORT_DIALOG_FOLDER}
          description={noteName() ? t.IMPORT_DIALOG_FOLDER_DESC(noteName()) : t.IMPORT_DIALOG_FOLDER_NONE}
        >
          <FolderInput app={app} value={folder()} placeholder={t.IMPORT_DIALOG_FOLDER_PLACEHOLDER} onChange={setFolder} />
        </PathSetting>
      </div>

      {/* Only what the chosen file's reader answers to — until one is chosen there is nothing to ask about. */}
      <Show when={reader()}>
        <Group name={t.IMPORT_READING} description={t.IMPORT_READING_DESC}>
          <Show when={supportsTrackChanges(reader())}>
            <Setting name={t.IMPORT_TRACK_CHANGES}>
              <DropDown
                options={trackChangesOptions}
                selected={options.trackChanges}
                autofocus={false}
                onChange={value => setOptions('trackChanges', value)}
              />
            </Setting>
          </Show>

          <Show when={supportsExtractMedia(reader())}>
            <Setting name={t.IMPORT_MEDIA} description={t.IMPORT_MEDIA_DESC} class="mod-toggle">
              <Toggle checked={extractMedia()} onChange={setExtractMedia} />
            </Setting>
            <Show when={extractMedia()}>
              <PathSetting name={t.IMPORT_MEDIA_FOLDER}>
                <FolderInput app={app} value={mediaFolder()} placeholder={defaultMediaFolder(folder())} onChange={setMediaFolder} />
              </PathSetting>
            </Show>
          </Show>

          <Show when={supportsMetadata(reader())}>
            <Setting name={t.IMPORT_METADATA} description={t.IMPORT_METADATA_DESC} class="mod-toggle">
              <Toggle checked={options.standalone} onChange={on => setOptions('standalone', on)} />
            </Setting>
          </Show>

          <Setting name={t.SHIFT_HEADINGS}>
            <DropDown
              options={shiftHeadingOptions}
              selected={options.shiftHeadingLevelBy ?? ''}
              autofocus={false}
              onChange={value => setOptions('shiftHeadingLevelBy', value)}
            />
          </Setting>

          <Show when={supportsTabStop(reader())}>
            <Setting name={t.TAB_STOP} description={t.IMPORT_TAB_STOP_DESC}>
              <Text value={options.tabStop ?? ''} placeholder="4" onChange={value => setOptions('tabStop', value)} />
            </Setting>
          </Show>

          <Show when={supportsStripComments(reader())}>
            <Setting name={t.STRIP_COMMENTS} description={t.IMPORT_STRIP_COMMENTS_DESC} class="mod-toggle">
              <Toggle checked={options.stripComments} onChange={on => setOptions('stripComments', on)} />
            </Setting>
          </Show>
        </Group>

        <Group name={t.IMPORT_WRITING} description={t.IMPORT_WRITING_DESC}>
          <Show when={supportsWrap(options.flavour)}>
            <Setting name={t.WRAP}>
              <DropDown
                options={wrapOptions}
                selected={options.wrap ?? ''}
                autofocus={false}
                onChange={value => setOptions('wrap', value)}
              />
            </Setting>
            {/* Nothing is wrapped at a column once the wrapping is off. */}
            <Show when={options.wrap !== 'none'}>
              <Setting name={t.COLUMNS}>
                <Text value={options.columns ?? ''} placeholder="72" onChange={value => setOptions('columns', value)} />
              </Setting>
            </Show>
          </Show>

          <Show when={supportsMarkdownHeadings(options.flavour)}>
            <Setting name={t.MARKDOWN_HEADINGS}>
              <DropDown
                options={headingStyleOptions}
                selected={options.markdownHeadings ?? ''}
                autofocus={false}
                onChange={value => setOptions('markdownHeadings', value)}
              />
            </Setting>
          </Show>

          <Show when={supportsReferenceLinks(options.flavour)}>
            <Setting name={t.REFERENCE_LINKS} description={t.IMPORT_REFERENCE_LINKS_DESC} class="mod-toggle">
              <Toggle checked={options.referenceLinks} onChange={on => setOptions('referenceLinks', on)} />
            </Setting>
          </Show>
        </Group>
      </Show>

      <div class="modal-button-container">
        <Button cta={true} onClick={() => void doImport()}>
          {t.IMPORT_DIALOG_SUBMIT}
        </Button>
      </div>
    </Modal>
  );
};

const show = (plugin: PandocGuiPlugin) =>
  createRoot(dispose => {
    let disposed = false;
    const cleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    };
    // `insert` returns anything solid can render; the guard below establishes it is a node.
    const el = insert(document.body, () => <Dialog onClose={cleanup} plugin={plugin} />) as Node;
    onCleanup(() => {
      if (el?.instanceOf(Node) && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    });
    return cleanup;
  });

export default {
  show,
};
