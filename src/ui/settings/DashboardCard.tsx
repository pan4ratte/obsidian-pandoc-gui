import { Show, type JSX, type ParentProps } from 'solid-js';

/** The icon of a dashboard card, in a badge tinted in the accent. */
export const CardBadge = (props: ParentProps) => <span class="ex-dashboard-badge">{props.children}</span>;

/** A dashboard card pressed as a button: the badge, and beside it a title over a line where there is one. */
export const ActionCard = (props: {
  icon: JSX.Element;
  title: string;
  description?: string;
  /** Lets a title too long for one line break onto a second. */
  wrap?: boolean;
  onClick: () => void;
}) => (
  <button class="ex-dashboard-card ex-dashboard-action" onClick={() => props.onClick()}>
    <CardBadge>{props.icon}</CardBadge>
    <span class="ex-dashboard-text">
      <span class="ex-dashboard-title" classList={{ 'is-wrapping': props.wrap }}>
        {props.title}
      </span>
      <Show when={props.description}>
        <span class="ex-dashboard-description">{props.description}</span>
      </Show>
    </span>
  </button>
);
