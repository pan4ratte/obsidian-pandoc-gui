import { Show, createSignal, untrack } from 'solid-js';
import { t } from '../../lang/helpers';
import Icon from '../components/Icon';

/** Animate UI's sparkles: the star. */
const SPARKLES_STAR =
  'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z';

/**
 * The plugin's changelog. While this release's is unread, the button is in the accent and its icon is Animate UI's
 * sparkles (`@animate-ui/icons-sparkles`), playing on a loop; once read, a scroll.
 */
export default (props: { read: boolean; onOpen: () => void }) => {
  const [read, setRead] = createSignal(untrack(() => props.read));

  const open = () => {
    props.onOpen();
    setRead(true);
  };

  return (
    <button class="ex-action" classList={{ 'is-unread': !read() }} onClick={open}>
      <Show when={!read()} fallback={<Icon name="scroll-text" />}>
        <div>
          <svg
            class="svg-icon ex-sparkles"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d={SPARKLES_STAR} />
            <path class="ex-sparkles-plus" d="M20 2v4 M22 4h-4" />
            <circle class="ex-sparkles-dot" cx="4" cy="20" r="2" />
          </svg>
        </div>
      </Show>
      {t.CHANGELOG}
    </button>
  );
};
