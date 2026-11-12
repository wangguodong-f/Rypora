import katex from "katex";
import { $node, $remark, $view } from "@milkdown/kit/utils";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";
import remarkMath from "remark-math";

function renderTex(tex: string, displayMode: boolean): HTMLElement {
  const element = document.createElement(displayMode ? "div" : "span");
  element.className = displayMode ? "math-block" : "math-inline";
  element.dataset.value = tex;
  if (displayMode) element.dataset.mathBlock = "";
  else element.dataset.mathInline = "";
  try {
    element.innerHTML = katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      output: "html",
    });
  } catch {
    element.textContent = tex;
  }
  return element;
}

function createMathView(displayMode: boolean): NodeViewConstructor {
  return (node, view, getPos) => {
    let current = node;
    const dom = renderTex(String(node.attrs.value ?? ""), displayMode);
    dom.contentEditable = "false";

    const edit = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const next = window.prompt(
        displayMode ? "编辑公式块 (LaTeX)" : "编辑行内公式 (LaTeX)",
        String(current.attrs.value ?? ""),
      );
      if (next == null) return;
      const pos = getPos();
      if (pos == null) return;
      view.dispatch(
        view.state.tr.setNodeMarkup(pos, undefined, { value: next }),
      );
      view.focus();
    };

    dom.addEventListener("dblclick", edit);

    return {
      dom,
      update: (updated) => {
        if (updated.type !== current.type) return false;
        current = updated;
        const rendered = renderTex(String(updated.attrs.value ?? ""), displayMode);
        dom.innerHTML = rendered.innerHTML;
        dom.dataset.value = String(updated.attrs.value ?? "");
        return true;
      },
      stopEvent: (event) => event.type === "dblclick",
      ignoreMutation: () => true,
      destroy: () => dom.removeEventListener("dblclick", edit),
    };
  };
}

export const mathRemark = $remark("rypora-math", () => remarkMath);

export const mathInlineSchema = $node("math_inline", () => ({
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  attrs: {
    value: { default: "" },
  },
  parseDOM: [
    {
      tag: "span[data-math-inline]",
      getAttrs: (dom: HTMLElement) => ({ value: dom.dataset.value ?? "" }),
    },
  ],
  toDOM: (node) => renderTex(String(node.attrs.value ?? ""), false),
  parseMarkdown: {
    match: ({ type }) => type === "inlineMath",
    runner: (state, node, type) => {
      state.addNode(type, { value: String(node.value ?? "") });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "math_inline",
    runner: (state, node) => {
      state.addNode("inlineMath", undefined, String(node.attrs.value ?? ""));
    },
  },
}));

export const mathBlockSchema = $node("math_block", () => ({
  group: "block",
  atom: true,
  selectable: true,
  attrs: {
    value: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-math-block]",
      getAttrs: (dom: HTMLElement) => ({ value: dom.dataset.value ?? "" }),
    },
  ],
  toDOM: (node) => renderTex(String(node.attrs.value ?? ""), true),
  parseMarkdown: {
    match: ({ type }) => type === "math",
    runner: (state, node, type) => {
      state.addNode(type, { value: String(node.value ?? "") });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "math_block",
    runner: (state, node) => {
      state.addNode("math", undefined, String(node.attrs.value ?? ""));
    },
  },
}));

export const mathInlineView = $view(mathInlineSchema, () =>
  createMathView(false),
);

export const mathBlockView = $view(mathBlockSchema, () =>
  createMathView(true),
);
