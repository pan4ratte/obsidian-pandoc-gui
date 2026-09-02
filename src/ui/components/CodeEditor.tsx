/** A field for code: mono, unwrapped, with a gutter of line numbers that moves with it. */
export default (props: { value: string; placeholder?: string; onInput: (value: string) => void }) => {
  let input!: HTMLTextAreaElement;
  let gutter!: HTMLDivElement;

  /*
   * One number a line, as one run of text rather than an element each: the gutter is only ever read, and a filter of
   * a few hundred lines would otherwise rebuild that many nodes on every keystroke. The field does not wrap, so a
   * line of code is a line on screen and the two columns stay level.
   */
  const numbers = () => Array.from({ length: props.value.split('\n').length }, (_, i) => i + 1).join('\n');

  /** The gutter scrolls nowhere by itself; it is moved by however far the field has been. */
  const sync = () => {
    gutter.scrollTop = input.scrollTop;
  };

  /**
   * Tab indents rather than leaving the field, which is what a code field is expected to do. Shift+Tab is left alone,
   * so there is still a key that moves focus out.
   */
  const indent = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey) {
      return;
    }
    e.preventDefault();
    const { selectionStart: from, selectionEnd: to, value } = input;
    input.value = `${value.slice(0, from)}\t${value.slice(to)}`;
    input.selectionStart = input.selectionEnd = from + 1;
    props.onInput(input.value);
  };

  return (
    <div class="ex-code">
      <div ref={gutter} class="ex-code-gutter" aria-hidden="true">
        {numbers()}
      </div>
      <textarea
        ref={input}
        class="ex-code-input"
        wrap="off"
        spellcheck={false}
        placeholder={props.placeholder}
        value={props.value}
        onInput={e => props.onInput(e.currentTarget.value)}
        onScroll={sync}
        onKeyDown={indent}
      />
    </div>
  );
};
