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

export const typewriterPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("RYPORA_TYPEWRITER"),
      view: () => ({
        update(view, previous) {
          if (!useUi.getState().typewriterMode) return;
          if (view.state.selection.eq(previous.selection)) return;
          requestAnimationFrame(() => {
            const coordinates = view.coordsAtPos(view.state.selection.head);
            const scroller = view.dom.closest(
              ".editor-scroll",
            ) as HTMLElement | null;
            if (!scroller) return;
            const rect = scroller.getBoundingClientRect();
            const delta = coordinates.top - (rect.top + rect.height / 2);
            if (Math.abs(delta) > 4) scroller.scrollTop += delta;
          });
        },
      }),
    }),
);
