import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { useUi } from "../stores/ui";

export const focusPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("RYPORA_FOCUS"),
      props: {
        decorations(state) {
          if (!useUi.getState().focusMode) return null;
          const { $head } = state.selection;
          if ($head.depth < 1) return null;
          return DecorationSet.create(state.doc, [
            Decoration.node($head.before(1), $head.after(1), {
              class: "has-focus",
            }),
          ]);
        },
      },
    }),
);

/** The element that actually scrolls the editor (`.milkdown` today). */
function scrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

export const typewriterPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("RYPORA_TYPEWRITER"),
      view: (view) => {
        const center = () => {
          requestAnimationFrame(() => {
            const scroller = scrollParent(view.dom);
            if (!scroller) return;
            const coordinates = view.coordsAtPos(view.state.selection.head);
            const rect = scroller.getBoundingClientRect();
            const delta = coordinates.top - (rect.top + rect.height / 2);
            if (Math.abs(delta) > 2) scroller.scrollTop += delta;
          });
        };

        // Turning the mode on should recenter the caret immediately, without
        // waiting for the next keystroke.
        let enabled = useUi.getState().typewriterMode;
        const unsubscribe = useUi.subscribe((state) => {
          if (state.typewriterMode === enabled) return;
          enabled = state.typewriterMode;
          if (enabled) center();
        });
        if (enabled) center();

        return {
          update(current, previous) {
            if (!enabled) return;
            if (current.state.selection.eq(previous.selection)) return;
            center();
          },
          destroy() {
            unsubscribe();
          },
        };
      },
    }),
);
