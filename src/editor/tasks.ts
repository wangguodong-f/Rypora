import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";

// Width of the rendered checkbox plus its gap, in CSS pixels.
const CHECKBOX_HIT_WIDTH = 24;

/**
 * GFM task items are plain `<li data-checked>` nodes without an <input>.
 * Clicking the checkbox glyph (the left edge of the first paragraph) flips
 * the `checked` attribute.
 */
export const taskListPlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleClick(view, pos, event) {
          const target = event.target as HTMLElement | null;
          const item = target?.closest?.(
            'li[data-item-type="task"]',
          ) as HTMLElement | null;
          if (!item) return false;

          const paragraph = item.querySelector(":scope > p");
          if (!paragraph) return false;
          const rect = paragraph.getBoundingClientRect();
          if (event.clientX - rect.left > CHECKBOX_HIT_WIDTH) return false;

          const $pos = view.state.doc.resolve(pos);
          for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const node = $pos.node(depth);
            if (node.type.name === "list_item" && node.attrs.checked != null) {
              const from = $pos.before(depth);
              view.dispatch(
                view.state.tr.setNodeMarkup(from, undefined, {
                  ...node.attrs,
                  checked: !node.attrs.checked,
                }),
              );
              return true;
            }
          }
          return false;
        },
      },
    }),
);
