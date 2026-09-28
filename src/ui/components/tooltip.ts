import { setTooltip } from 'obsidian';
import { createEffect } from 'solid-js';

/**
 * Obsidian's own tooltip on an element, rather than the browser's `title`: the app draws it in its own chrome, at the
 * delay the user set, and a modal cannot leave one behind on screen the way a native one can.
 *
 * Called from a `ref`, where the effect it starts belongs to the component and is disposed with it. The text is read
 * through a function so a tooltip that changes with the row — a path, a button that is busy — follows it.
 */
export const tooltip = (el: HTMLElement, text: () => string | undefined) => {
  createEffect(() => {
    const said = text();
    // Removed rather than left empty: Obsidian shows the innermost `aria-label`, so an empty one on an icon hides
    // the tooltip of the button around it.
    if (said) {
      setTooltip(el, said);
    } else {
      el.removeAttribute('aria-label');
    }
  });
};
