import { For, createEffect, createSignal, on, onMount, untrack, type Accessor, type Setter } from 'solid-js';
import Icon from '../components/Icon';

/** Info is what is merely so, a warning what wants doing, an error what is wrong. */
export type NoticeKind = 'info' | 'warning' | 'error';

export interface PanelNotice {
  /** Tells a notice already drawn from a new one, so that a notice said again stays standing. */
  key: string;
  kind: NoticeKind;
  title: string;
  text: string;
}

const ICONS: Record<NoticeKind, string> = { info: 'info', warning: 'triangle-alert', error: 'circle-alert' };

const animationsDone = async (el: HTMLElement) => {
  await Promise.all(el.getAnimations().map(animation => animation.finished.catch((): undefined => undefined)));
};

/** styles.css animates the height to or from what it is now, which only the element can say. */
const measure = (el: HTMLElement) => el.setCssProps({ '--ex-callout-height': `${el.offsetHeight}px` });

const expand = (el: HTMLElement) => {
  measure(el);
  el.addClass('is-opening');
  void animationsDone(el).then(() => el.removeClass('is-opening'));
};

const collapse = async (el: HTMLElement) => {
  measure(el);
  el.inert = true;
  el.removeClass('is-opening');
  el.addClass('is-closing');
  await animationsDone(el);
};

interface Entry {
  notice: Accessor<PanelNotice>;
  setNotice: Setter<PanelNotice>;
  /** Drawn after the dashboard was, so it opens rather than simply being there. */
  opens: boolean;
  closing: boolean;
  el?: HTMLDivElement;
}

const Callout = (props: { entry: Entry }) => {
  const notice = () => props.entry.notice();
  onMount(() => {
    if (props.entry.opens && props.entry.el) {
      expand(props.entry.el);
    }
  });
  return (
    <div ref={el => (props.entry.el = el)} class={`ex-callout is-${notice().kind}`}>
      <span class="ex-callout-icon">
        <Icon name={ICONS[notice().kind]} />
      </span>
      <div class="ex-callout-body">
        <div class="ex-callout-title">{notice().title}</div>
        <div>{notice().text}</div>
      </div>
    </div>
  );
};

/**
 * What neither card has the room to say, a card to each across the whole width. A notice no longer wanted collapses,
 * a new one opens, and one still wanted stays as it is.
 */
export default (props: { notices: PanelNotice[] }) => {
  const entry = (notice: PanelNotice, opens: boolean): Entry => {
    const [get, set] = createSignal(notice);
    return { notice: get, setNotice: set, opens, closing: false };
  };
  const [entries, setEntries] = createSignal(untrack(() => props.notices).map(notice => entry(notice, false)));

  const close = async (closing: Entry, el: HTMLElement) => {
    closing.closing = true;
    await collapse(el);
    setEntries(list => list.filter(e => e !== closing));
  };

  createEffect(
    on(
      () => props.notices,
      notices => {
        const current = untrack(entries);
        const live = new Map(current.filter(e => !e.closing).map(e => [e.notice().key, e]));
        const wanted = new Set(notices.map(notice => notice.key));
        const next = notices.map(notice => {
          const standing = live.get(notice.key);
          standing?.setNotice(notice);
          return standing ?? entry(notice, true);
        });
        // A notice on its way out keeps its place while it collapses.
        current.forEach((e, i) => {
          if (e.closing || !wanted.has(e.notice().key)) {
            if (!e.closing) {
              if (!e.el) {
                return;
              }
              void close(e, e.el);
            }
            next.splice(Math.min(i, next.length), 0, e);
          }
        });
        setEntries(next);
      },
      { defer: true }
    )
  );

  return (
    <div class="ex-callouts">
      <For each={entries()}>{e => <Callout entry={e} />}</For>
    </div>
  );
};
