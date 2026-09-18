import { Notice } from 'obsidian';
import { Show } from 'solid-js';
import { acceptedExtensions, acceptsFile, chooseFile, isDesktop, type FileFilter } from '../../system/platform';
import { basename } from '../../system/paths';
import { t } from '../../lang/helpers';
import { Text, ExtraButton } from './Setting';

/** Ask for a path, and answer with it — or with nothing, where the dialog was closed. */
export const choosePath = async (options: { value?: string; folder?: boolean; filters?: FileFilter[] }) =>
  await chooseFile({
    // A path with `${...}` in it names nothing until an export resolves it, so the dialog is left to open wherever it
    // opened last.
    defaultPath: options.value && !options.value.includes('${') ? options.value : undefined,
    folder: options.folder,
    filters: options.filters,
  });

/** A path, typed or chosen — to a file, or to a folder where `folder` says so. */
export default (props: {
  value?: string;
  placeholder?: string;
  /** What the dialog offers to open, most likely kind first. Files only. */
  filters?: FileFilter[];
  /** Ask for a folder rather than a file, and offer to make one. */
  folder?: boolean;
  /** Said on the button, since the field's own label asks for the path. */
  tooltip?: string;
  onChange: (value: string) => void;
}) => {
  let field: HTMLInputElement | undefined;

  /**
   * A row that names the kinds it takes takes nothing else.
   *
   * The dialog offers those kinds and no others, but a path is as often typed as chosen — and on a phone there is no
   * dialog at all. A file of the wrong kind is turned away here rather than at export, where it arrives as whatever
   * pandoc makes of a document it cannot read: a template that is not a template, a bibliography in no format it
   * knows. The row keeps what it had, so nothing is lost by the refusal.
   */
  const set = (value: string) => {
    if (!props.folder && !acceptsFile(value, props.filters)) {
      new Notice(t.WRONG_FILE_TYPE(basename(value.trim()), (acceptedExtensions(props.filters) ?? []).map(e => `.${e}`).join(', ')));
      // The field holds what was typed into it, which is no longer what the row says.
      if (field) {
        field.value = props.value ?? '';
      }
      return;
    }
    props.onChange(value);
  };

  const pick = async () => {
    const chosen = await choosePath(props);
    if (chosen !== undefined) {
      set(chosen);
    }
  };

  return (
    <>
      <Text
        ref={el => (field = el)}
        style="width: 100%"
        value={props.value ?? ''}
        tooltip={props.value}
        placeholder={props.placeholder}
        onChange={set}
      />
      {/* Typed rather than chosen where there is no dialog to open — a phone, and a desktop emulating one. */}
      <Show when={isDesktop()}>
        <ExtraButton icon={props.folder ? 'folder' : 'folder-open'} tooltip={props.tooltip} onClick={() => void pick()} />
      </Show>
    </>
  );
};
