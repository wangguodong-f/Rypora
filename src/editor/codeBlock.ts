import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import type { EditorState } from "@milkdown/kit/prose/state";
import { NodeSelection, Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose, $view } from "@milkdown/kit/utils";

interface LanguageOption {
  value: string;
  label: string;
}

/** Languages offered by the chip menu, in the order Typora-style editors show them. */
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "", label: "纯文本 / Plain text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "diff", label: "Diff" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "mermaid", label: "Mermaid" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "toml", label: "TOML" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

interface LanguageControl {
  root: HTMLElement;
  close: () => void;
  setLanguage: (language: string) => void;
}

function createLanguageControl(
  initial: string,
  commit: (language: string) => void,
  refocus: () => void,
): LanguageControl {
  let language = initial;
  let open = false;

  const root = document.createElement("div");
  root.className = "md-code-language";
  root.contentEditable = "false";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "md-code-language-button";
  button.title = "点击编辑代码块语言";
  button.setAttribute("aria-label", "编辑代码块语言");
  button.setAttribute("aria-haspopup", "listbox");
  button.textContent = language || "text";

  const menu = document.createElement("div");
  menu.className = "md-code-language-menu";
  menu.hidden = true;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "md-code-language-input";
  input.value = language;
  input.placeholder = "输入语言，如 python";
  input.spellcheck = false;
  input.setAttribute("aria-label", "代码块语言");

  const list = document.createElement("div");
  list.className = "md-code-language-options";
  list.setAttribute("role", "listbox");

  const options = LANGUAGE_OPTIONS.map((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "md-code-language-option";
    item.dataset.value = option.value;
    item.textContent = option.label;
    item.setAttribute("role", "option");
    // Keep the text field focused while the pointer is pressed, so the menu's
    // focusout handler does not close it before click fires.
    item.addEventListener("mousedown", (event) => event.preventDefault());
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      commit(option.value);
    });
    list.appendChild(item);
    return item;
  });

  menu.append(input, list);
  root.append(button, menu);

  const markSelected = () => {
    const query = input.value.trim().toLowerCase();
    for (const item of options) {
      const value = item.dataset.value ?? "";
      item.dataset.selected = String(value === query);
    }
  };

  const doOpen = () => {
    if (open) return;
    open = true;
    menu.hidden = false;
    root.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    input.value = language;
    markSelected();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  const doClose = () => {
    if (!open) return;
    open = false;
    menu.hidden = true;
    root.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) doClose();
    else doOpen();
  });

  input.addEventListener("input", markSelected);
  input.addEventListener("keydown", (event) => {
    // The language field is outside ProseMirror; never let these keys change
    // the editor selection or create a new line.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit(input.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      doClose();
      refocus();
    }
  });

  root.addEventListener("focusout", () => {
    // Defer until the browser has moved focus; clicking an option keeps focus
    // inside `root`, while clicking elsewhere closes the picker.
    window.setTimeout(() => {
      if (open && !root.contains(document.activeElement)) doClose();
    }, 0);
  });

  return {
    root,
    close: doClose,
    setLanguage: (next) => {
      language = next;
      button.textContent = next || "text";
      if (!open) input.value = next;
      markSelected();
    },
  };
}

function createCodeBlockView(): NodeViewConstructor {
  return (node, view, getPos) => {
    const initialLanguage = String(node.attrs.language ?? "");

    const dom = document.createElement("div");
    dom.className = "md-code-block";

    const pre = document.createElement("pre");
    if (initialLanguage) pre.dataset.language = initialLanguage;

    const code = document.createElement("code");
    pre.appendChild(code);

    const applyLanguage = (next: string) => {
      const trimmed = next.trim();
      control.setLanguage(trimmed);
      if (trimmed) pre.dataset.language = trimmed;
      else delete pre.dataset.language;

      const pos = getPos();
      if (pos == null) return;
      view.dispatch(view.state.tr.setNodeAttribute(pos, "language", trimmed));
    };

    const control = createLanguageControl(
      initialLanguage,
      (next) => {
        applyLanguage(next);
        control.close();
        view.focus();
      },
      () => view.focus(),
    );

    dom.append(pre, control.root);

    return {
      dom,
      contentDOM: code,
      update: (updated: ProseNode) => {
        if (updated.type.name !== "code_block") return false;
        const next = String(updated.attrs.language ?? "");
        control.setLanguage(next);
        if (next) pre.dataset.language = next;
        else delete pre.dataset.language;
        return true;
      },
      // The chip and its picker are UI, not document content. Keep every
      // event there away from ProseMirror so the caret stays in the code block.
      stopEvent: (event) => {
        const target = event.target;
        return target instanceof Node && control.root.contains(target);
      },
      ignoreMutation: (mutation) => !code.contains(mutation.target),
      destroy: () => control.close(),
    };
  };
}

export const codeBlockView = $view(
  codeBlockSchema.node,
  () => createCodeBlockView(),
);

const focusKey = new PluginKey<DecorationSet>("RYPORA_CODE_BLOCK_FOCUS");

function activeCodeBlock(state: EditorState): { node: ProseNode; pos: number } | null {
  const { selection } = state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === "code_block"
  ) {
    return { node: selection.node, pos: selection.from };
  }

  const $from = selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "code_block") {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

function focusDecorations(state: EditorState): DecorationSet {
  const active = activeCodeBlock(state);
  if (!active) return DecorationSet.empty;
  return DecorationSet.create(state.doc, [
    Decoration.node(active.pos, active.pos + active.node.nodeSize, {
      class: "md-code-block-focused",
    }),
  ]);
}

/** Highlights the language chip only while the caret is inside that block. */
export const codeBlockFocusPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: focusKey,
      state: {
        init: (_config, state) => focusDecorations(state),
        apply: (transaction, previous, _oldState, state) => {
          if (!transaction.selectionSet && !transaction.docChanged) {
            return previous;
          }
          return focusDecorations(state);
        },
      },
      props: {
        decorations: (state) => focusKey.getState(state) ?? DecorationSet.empty,
      },
    }),
);
