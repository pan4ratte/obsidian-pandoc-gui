import { For } from 'solid-js';

/** One answer picked along a track of named steps. */
export default (props: {
  /** One label per step, in order. The first is the value at `min`. */
  labels: string[];
  /** What the first label stands for; each label after it is one more. */
  min?: number;
  value: number;
  onChange: (value: number) => void;
}) => {
  const min = () => props.min ?? 0;
  const max = () => min() + Math.max(props.labels.length - 1, 0);
  // Clamped rather than trusted: the value is read back out of arguments a template may have been given by hand,
  // which can name a step off the track.
  const value = () => Math.min(Math.max(props.value, min()), max());

  /** Where a step's label sits: along the track the thumb can actually reach. */
  const at = (index: number) => {
    const fraction = max() > min() ? index / (max() - min()) : 0;
    return `calc(var(--ex-step-slider-thumb) / 2 + ${fraction} * (100% - var(--ex-step-slider-thumb)))`;
  };

  /** The first label sits flush with the slider's left edge. */
  const labelAt = (index: number) => (index === 0 ? '0' : at(index));

  return (
    // How far along the track the answer stands, for the fill drawn behind the thumb.
    <div class="ex-step-slider" style={{ '--ex-step-slider-fill': at(value() - min()) }}>
      <input
        class="slider"
        type="range"
        min={min()}
        max={max()}
        step={1}
        value={value()}
        onInput={e => props.onChange(Number(e.currentTarget.value))}
      />
      <div class="ex-step-slider-ticks">
        <For each={props.labels}>
          {(label, index) => (
            <span class="ex-step-slider-tick" classList={{ 'is-current': min() + index() === value() }} style={{ left: labelAt(index()) }}>
              {label}
            </span>
          )}
        </For>
      </div>
    </div>
  );
};
