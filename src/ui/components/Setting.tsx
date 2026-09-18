import { Index, JSX, createContext, createEffect, on, onCleanup, onMount, useContext } from 'solid-js';
import * as Ob from 'obsidian';
import { tooltip } from './tooltip';

type SettingContext = {
  settingEl: HTMLDivElement;
};

const Context = createContext<SettingContext>();

const useSetting = () => useContext(Context);

export default (props: {
  name?: string;
  description?: string;
  class?: string;
  heading?: boolean;
  disabled?: boolean;
  noInfo?: boolean;
  children?: JSX.Element;
}) => {
  const context: SettingContext = {
    settingEl: null,
  };
  return (
    <>
      <Context.Provider value={context}>
        <div
          ref={el => (context.settingEl = el)}
          /* The heading class is written into `class` rather than toggled beside it: `class` is set by assigning the
             whole attribute, `classList` toggles one name and remembers it as set, and a run that does both can
             leave the name remembered but no longer on the element. A heading that has lost it is drawn as a row —
             the box every row in a modal wears, on the one thing in the card that is not a row. */
          class={['setting-item', props.heading ? 'setting-item-heading' : '', props.class ?? ''].filter(Boolean).join(' ')}
          classList={{
            'is-disable': props.disabled,
          }}
        >
          <div class="setting-item-info">
            <div class="setting-item-name">{props.name}</div>
            <div class="setting-item-description">{props.description}</div>
          </div>
          <div class="setting-item-control">{props.children}</div>
        </div>
      </Context.Provider>
    </>
  );
};

export const Toggle = (props: { checked?: boolean; onChange?: (checked: boolean) => void }) => {
  const setting = useSetting();
  onMount(() => {
    setting.settingEl.addClass('mod-toggle');
  });
  onCleanup(() => {
    setting.settingEl.removeClass('mod-toggle');
  });
  return (
    <>
      <div
        class="checkbox-container"
        classList={{ 'is-enabled': props.checked }}
        onClick={() => props.onChange && props.onChange(!props.checked)}
      >
        <input type="checkbox" />
      </div>
    </>
  );
};

export const ExtraButton = (props: { icon?: string; onClick?: () => void; tooltip?: string }) => {
  return (
    <div
      ref={el => {
        if (props.icon) {
          Ob.setIcon(el, props.icon);
        }
        tooltip(el, () => props.tooltip);
      }}
      class="setting-editor-extra-setting-button"
      classList={{ 'clickable-icon': props.icon && !!props.onClick }}
      onClick={props.onClick}
    />
  );
};

export const Text = (props: {
  placeholder?: string;
  tooltip?: string;
  value?: string;
  style?: string;
  disabled?: boolean;
  readOnly?: boolean;
  spellcheck?: boolean;
  /** The field itself, for a caller that has to put back what was typed — see `FileInput`. */
  ref?: (el: HTMLInputElement) => void;
  onChange?: (value: string) => void;
}) => {
  return (
    <input
      ref={el => {
        tooltip(el, () => props.tooltip);
        props.ref?.(el);
      }}
      type="text"
      readOnly={props.readOnly}
      placeholder={props.placeholder}
      spellcheck={props.spellcheck ?? false}
      style={props.style}
      value={props.value}
      onChange={e => props.onChange?.(e.target.value)}
      disabled={props.disabled}
    />
  );
};

export const TextArea = (props: {
  placeholder?: string;
  value?: string;
  style?: string;
  class?: string;
  /** Height follows the lines it holds, rather than a fixed number of them. */
  autoSize?: boolean;
  /** Turn this over when the field is shown: what is not rendered cannot be measured. */
  visible?: boolean;
  disabled?: boolean;
  /** Shown to be read and selected from, rather than typed into. */
  readOnly?: boolean;
  spellcheck?: boolean;
  onChange?: (value: string) => void;
}) => {
  let el!: HTMLTextAreaElement;

  // The height is measured, not chosen: it is however tall the text currently is.
  const resize = () => {
    if (!props.autoSize) {
      return;
    }
    // Nothing rendered has a height to read.
    if (el.getClientRects().length === 0) {
      el.setCssStyles({ height: '' });
      return;
    }
    // Measured with nothing of its own in the way. `scrollHeight` is content and padding, so a border-box height has
    // to carry whatever else stands between the two — the borders, and a horizontal scrollbar where the field scrolls
    // rather than wraps, which would otherwise take the last line's worth of room from under it.
    el.setCssStyles({ height: 'auto' });
    el.setCssStyles({ height: `${el.scrollHeight + el.offsetHeight - el.clientHeight}px` });
  };

  // Every way it can change: typed into, written from the settings, or brought on screen where it can finally be
  // measured.
  createEffect(on([() => props.value, () => props.visible], resize));

  return (
    <textarea
      ref={el}
      class={props.class}
      placeholder={props.placeholder}
      // A line per line, so a field that has never been on screen is still about the right height for whatever
      // reveals it.
      rows={props.autoSize ? Math.max(1, props.value?.split('\n').length ?? 1) : undefined}
      readOnly={props.readOnly}
      spellcheck={props.spellcheck ?? false}
      style={props.style}
      value={props.value}
      onInput={resize}
      onChange={e => props.onChange?.(e.target.value)}
      disabled={props.disabled}
    />
  );
};

export const DropDown = (props: {
  options: { name?: string; value: string }[];
  selected?: string;
  /** Said where the row's own label asks for something else. */
  tooltip?: string;
  /** A dropdown claims the focus by default — it is the one control a dialog opened for it is about. */
  autofocus?: boolean;
  onChange?: (value: string, index: number) => void;
}) => {
  let el!: HTMLSelectElement;

  // Which option is standing, said to the element rather than left to the `selected` attributes below.
  createEffect(() => {
    // The options are read along with the value: which of them the value lands on is half of what decides whether the
    // element is showing the right answer.
    const index = props.options.findIndex(o => o.value === (props.selected ?? ''));
    if (el.selectedIndex !== index) {
      el.selectedIndex = index;
    }
  });

  return (
    <>
      <select
        ref={e => {
          el = e;
          tooltip(e, () => props.tooltip);
        }}
        class="dropdown"
        onChange={e => props.onChange?.(e.target.value, e.target.selectedIndex)}
        autofocus={props.autofocus ?? true}
      >
        {/* `Index`, not `For`. The lists handed in here are worked out afresh
            whenever the template's arguments change — every option a new object,
            though almost always the same words in the same order — and `For`
            keys on identity, so it would throw away every `<option>` and build
            it again. The select visibly flinched each time: touching a lua
            filter rewrites the arguments, and the dropdowns beside it blinked.
            `Index` keys on position and writes the new value into the option
            already there. */}
        <Index each={props.options}>
          {item => (
            <option value={item().value} selected={item().value === props.selected}>
              {item().name ?? item().value}
            </option>
          )}
        </Index>
      </select>
    </>
  );
};
