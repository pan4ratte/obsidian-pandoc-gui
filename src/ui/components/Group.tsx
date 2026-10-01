import type { JSX } from 'solid-js';
import Setting from './Setting';

/** Rows boxed together, with their heading and its description above the box, as in a stock settings group. */
export default (props: { name?: string; description?: string; class?: string; children?: JSX.Element }) => (
  <div class={['ex-group', props.class ?? ''].filter(Boolean).join(' ')}>
    <Setting name={props.name} description={props.description} heading={true} />
    <div class="ex-card">{props.children}</div>
  </div>
);
