import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import { For, Show } from 'solid-js';
import { t } from '../../lang/helpers';
import { basename, normalize } from '../../system/paths';
import { acceptedExtensions, chooseFiles, isMobileUi, vaultRoot, type FileFilter } from '../../system/platform';
import Setting, { ExtraButton } from './Setting';
import { tooltip } from './tooltip';

/** The vault's files with one of these extensions, for where there is no system dialog. */
class VaultFileModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly extensions: readonly string[],
    private readonly onPick: (file: TFile) => void
  ) {
    super(app);
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter(file => this.extensions.includes(file.extension.toLowerCase()));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file);
  }
}

/** Files added one by one under a row's label, in the order they are used. */
export default (props: {
  app: App;
  name: string;
  description?: string;
  class?: string;
  value: string[];
  filters: FileFilter[];
  onChange: (value: string[]) => void;
}) => {
  const add = (paths: string[]) => {
    if (paths.length > 0) {
      props.onChange([...props.value, ...paths]);
    }
  };

  /** A file inside the vault is kept as a vault path, so the template works on every device the vault syncs to. */
  const pick = async () => {
    if (isMobileUi()) {
      new VaultFileModal(props.app, acceptedExtensions(props.filters) ?? [], file => add([file.path])).open();
      return;
    }
    const root = `${vaultRoot(props.app.vault.adapter)}/`;
    const chosen = await chooseFiles({ filters: props.filters });
    add(chosen.map(normalize).map(path => (path.startsWith(root) ? path.substring(root.length) : path)));
  };

  const move = (index: number) => {
    const list = [...props.value];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    props.onChange(list);
  };

  return (
    <Setting
      name={props.name}
      description={props.description}
      // Inline: the add button stands beside the label, as it does in the export dialog.
      class={['ex-document-list', 'ex-inline-setting', props.class ?? ''].filter(Boolean).join(' ')}
      extra={
        <Show when={props.value.length > 0}>
          <div class="ex-document-list-items">
            <For each={props.value}>
              {(path, index) => (
                <div class="ex-document-list-item">
                  <span ref={el => tooltip(el, () => path)}>{basename(path)}</span>
                  <Show when={index() > 0}>
                    <ExtraButton icon="arrow-up" tooltip={t.JOIN_MOVE_UP} onClick={() => move(index())} />
                  </Show>
                  <ExtraButton
                    icon="x"
                    tooltip={t.ACTION_REMOVE}
                    onClick={() => props.onChange(props.value.filter((_, i) => i !== index()))}
                  />
                </div>
              )}
            </For>
            <div class="ex-document-list-item ex-document-list-add" onClick={() => void pick()}>
              <ExtraButton icon="plus" />
              <span>{t.JOIN_ADD}</span>
            </div>
          </div>
        </Show>
      }
    >
      {/* Beside the label while the list is empty; once it is not, a row of its own under the last file. */}
      <Show when={props.value.length === 0}>
        <ExtraButton icon="plus" tooltip={t.JOIN_ADD} onClick={() => void pick()} />
      </Show>
    </Setting>
  );
};
