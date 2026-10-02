import { setIcon } from 'obsidian';
import { Index } from 'solid-js';

/** A list typed one item at a time, each kept as a pill — in Obsidian's own classes, so it looks like a list property. */
export default (props: {
  value: string[];
  /** Two authors can share a name; two keywords cannot usefully be the same one. */
  allowDuplicates?: boolean;
  onChange: (value: string[]) => void;
}) => {
  let input!: HTMLDivElement;
  const pills: HTMLDivElement[] = [];

  /** Obsidian's own highlight for a value the list already holds, restarted if it is still running. */
  const flash = (pill?: HTMLDivElement) => {
    if (!pill) {
      return;
    }
    pill.removeClass('multi-select-duplicate');
    void pill.offsetWidth;
    pill.addClass('multi-select-duplicate');
    pill.addEventListener('animationend', () => pill.removeClass('multi-select-duplicate'), { once: true });
  };

  const commit = () => {
    const typed = (input.textContent ?? '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
    input.textContent = '';
    if (!props.allowDuplicates) {
      typed.filter(item => props.value.includes(item)).forEach(item => flash(pills[props.value.indexOf(item)]));
    }
    const added = props.allowDuplicates ? typed : [...new Set(typed)].filter(item => !props.value.includes(item));
    if (added.length > 0) {
      props.onChange([...props.value, ...added]);
    }
  };

  const remove = (index: number) => {
    props.onChange(props.value.filter((_, i) => i !== index));
    input.focus();
  };

  return (
    <div class="multi-select-container" onClick={e => e.target === e.currentTarget && input.focus()}>
      {/* By position, not by value: equal items are still separate pills. */}
      <Index each={props.value}>
        {(item, index) => (
          <div
            ref={el => (pills[index] = el)}
            class="multi-select-pill"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                remove(index);
              }
            }}
          >
            <div class="multi-select-pill-content">
              <span>{item()}</span>
            </div>
            <div class="multi-select-pill-remove-button" ref={el => setIcon(el, 'x')} onClick={() => remove(index)} />
          </div>
        )}
      </Index>
      <div
        ref={input}
        class="multi-select-input"
        contentEditable="plaintext-only"
        spellcheck={false}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !input.textContent) {
            // As in a list property: the first press selects the last pill, the second removes it.
            const last = input.previousElementSibling;
            if (last?.instanceOf(HTMLElement)) {
              e.preventDefault();
              last.focus();
            }
          }
        }}
        onBlur={commit}
      />
    </div>
  );
};
