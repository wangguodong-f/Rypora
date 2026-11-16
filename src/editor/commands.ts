import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { DOMSerializer, Fragment } from "@milkdown/kit/prose/model";
import { callCommand, getHTML, getMarkdown, outline } from "@milkdown/kit/utils";
import {
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  insertTableCommand,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import {
  deleteSelection,
  selectAll,
  setBlockType,
} from "@milkdown/kit/prose/commands";
import { redo, undo } from "@milkdown/kit/prose/history";
import { liftListItem, sinkListItem } from "@milkdown/kit/prose/schema-list";
import {
  NodeSelection,
  Selection,
  TextSelection,
} from "@milkdown/kit/prose/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  moveTableColumn,
  moveTableRow,
  selectedRect,
} from "@milkdown/kit/prose/tables";
import type { FindResult } from "../lib/types";

interface AnyCommand {
  key: unknown;
}

interface Match {
  from: number;
  to: number;
}

interface Range {
  from: number;
  to: number;
}

type SelectionMode = "block" | "line" | "scope" | "word";

let findState: { query: string; index: number } = { query: "", index: -1 };

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export interface EditorCommands {
  toggleBold: () => boolean;
  toggleItalic: () => boolean;
  toggleStrike: () => boolean;
  toggleInlineCode: () => boolean;
  toggleLink: (href: string) => boolean;
  setHeading: (level: number) => boolean;
  changeHeading: (step: -1 | 1) => boolean;
  setParagraph: () => boolean;
  toggleQuote: () => boolean;
  toggleBulletList: () => boolean;
  toggleOrderedList: () => boolean;
  toggleTaskList: () => boolean;
  insertCodeBlock: () => boolean;
  insertTable: () => boolean;
  insertHr: () => boolean;
  insertImage: (src: string, alt?: string) => boolean;
  insertMathInline: (value: string) => boolean;
  insertMathBlock: (value: string) => boolean;
  insertText: (text: string) => boolean;
  pasteText: (text: string) => boolean;
  linkHref: () => string | null;
  imageSource: () => string | null;
  undo: () => boolean;
  redo: () => boolean;
  selectAll: () => boolean;
  select: (mode: SelectionMode) => boolean;
  deleteRange: (mode: SelectionMode) => boolean;
  deleteSelection: () => boolean;
  jump: (where: "top" | "bottom" | "line-start" | "line-end" | "selection") => boolean;
  moveBlock: (direction: -1 | 1) => boolean;
  indentList: () => boolean;
  outdentList: () => boolean;
  insertParagraph: (where: "before" | "after") => boolean;
  setTaskChecked: (value: boolean | null) => boolean;
  toggleTaskChecked: () => boolean;
  tableAddRow: (where: "before" | "after") => boolean;
  tableAddColumn: (where: "before" | "after") => boolean;
  tableMoveRow: (direction: -1 | 1) => boolean;
  tableMoveColumn: (direction: -1 | 1) => boolean;
  tableDelete: (what: "row" | "column" | "table") => boolean;
  tableMarkdown: () => string | null;
  codeBlockText: () => string | null;
  selectionText: () => string;
  selectionMarkdown: () => string;
  selectionHtml: () => string;
  clearFormat: () => boolean;
  wordCount: () => { characters: number; words: number; lines: number };
  find: (query: string, backwards?: boolean) => FindResult;
  replaceCurrent: (query: string, replacement: string) => FindResult;
  replaceAll: (query: string, replacement: string) => number;
  focusHeading: (index: number) => void;
  focusLine: (line: number) => void;
  getHtml: () => string;
  getMarkdown: () => string;
  refresh: () => void;
}

function collectMatches(doc: ProseNode, query: string): Match[] {
  const matches: Match[] = [];
  if (!query) return matches;
  const needle = query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let index = 0;
    while (index <= text.length) {
      const found = text.indexOf(needle, index);
      if (found === -1) break;
      matches.push({ from: pos + found, to: pos + found + needle.length });
      index = found + Math.max(1, needle.length);
    }
  });
  return matches;
}

export function createCommands(editor: Editor): EditorCommands {
  const viewOf = (ctx: Ctx): EditorView => ctx.get(editorViewCtx);

  const call = (command: AnyCommand, payload?: unknown): boolean => {
    try {
      return editor.action(
        callCommand(
          command.key as never,
          payload as never,
        ) as unknown as (ctx: Ctx) => boolean,
      );
    } catch (error) {
      console.warn("editor command failed", error);
      return false;
    }
  };

  const withView = <T>(fn: (view: EditorView) => T): T | undefined => {
    try {
      return editor.action((ctx) => fn(viewOf(ctx)));
    } catch (error) {
      console.warn("editor action failed", error);
      return undefined;
    }
  };

  const replaceMatches = (matches: Match[], replacement: string): number => {
    withView((view) => {
      const schema = view.state.schema;
      let tr = view.state.tr;
      for (const match of [...matches].reverse()) {
        tr = tr.replaceWith(match.from, match.to, schema.text(replacement));
      }
      if (matches.length) view.dispatch(tr.scrollIntoView());
    });
    return matches.length;
  };

  /** The range of the current text block, extended over quoting and list wrappers. */
  const blockRange = (view: EditorView): Range | null => {
    const { $from } = view.state.selection;
    const depth = $from.depth;
    if (depth < 1) return null;
    let current = depth;
    while (current > 1) {
      const parent = $from.node(current - 1);
      if (parent.type.name === "list_item" || parent.type.name === "blockquote") {
        current -= 1;
      } else {
        break;
      }
    }
    return { from: $from.before(current), to: $from.after(current) };
  };

  /** The range covered by the marks at the cursor. */
  const scopeRange = (view: EditorView): Range | null => {
    const { $from, from, to } = view.state.selection;
    const marks = $from.marks();
    if (!marks.length) return null;
    const sameMark = (node: ProseNode) =>
      node.isText && marks.every((mark) => node.marks.some((it) => it.eq(mark)));
    const start = $from.start();
    let runStart: number | null = null;
    let found: Range | null = null;
    $from.parent.forEach((child, offset) => {
      const childFrom = start + offset;
      const childTo = childFrom + child.nodeSize;
      if (sameMark(child)) {
        if (runStart === null) runStart = childFrom;
        if (childTo >= from && childFrom <= to) {
          found = { from: runStart, to: childTo };
        }
      } else {
        runStart = null;
      }
    });
    return found;
  };

  const wordRange = (view: EditorView): Range | null => {
    const { $from } = view.state.selection;
    const text = $from.parent.textBetween(0, $from.parent.content.size, "\n");
    const offset = $from.parentOffset;
    const base = $from.start();
    let start = offset;
    let end = offset;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
    while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
    if (start === end) {
      while (end < text.length && !WORD_CHAR.test(text[end])) end += 1;
      start = end;
      while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
    }
    if (start === end) return null;
    return { from: base + start, to: base + end };
  };

  const rangeFor = (view: EditorView, mode: SelectionMode): Range | null => {
    switch (mode) {
      case "block":
        return blockRange(view);
      case "line": {
        const { $from } = view.state.selection;
        if ($from.depth < 1) return null;
        return { from: $from.start(), to: $from.end() };
      }
      case "scope":
        return scopeRange(view);
      case "word":
        return wordRange(view);
      default:
        return null;
    }
  };

  const applyRange = (
    view: EditorView,
    range: Range,
    action: "select" | "delete",
  ): boolean => {
    if (range.from === range.to) return false;
    if (action === "delete") {
      view.dispatch(view.state.tr.delete(range.from, range.to).scrollIntoView());
      view.focus();
      return true;
    }
    const selection = TextSelection.create(
      view.state.doc,
      range.from,
      range.to,
    );
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    view.focus();
    return true;
  };

  return {
    toggleBold: () => call(toggleStrongCommand),
    toggleItalic: () => call(toggleEmphasisCommand),
    toggleStrike: () => call(toggleStrikethroughCommand),
    toggleInlineCode: () => call(toggleInlineCodeCommand),
    toggleLink: (href) => call(toggleLinkCommand, { href }),
    setHeading: (level) => call(wrapInHeadingCommand, level),
    changeHeading: (step) =>
      withView((view) => {
        const { $from } = view.state.selection;
        const node = $from.parent;
        if (node.type.name !== "heading") return false;
        const level = Number(node.attrs.level ?? 1) + step;
        if (level < 1 || level > 6) return false;
        const heading = view.state.schema.nodes.heading;
        return setBlockType(heading, { level })(view.state, view.dispatch);
      }) ?? false,
    setParagraph: () =>
      withView((view) => {
        const paragraph = view.state.schema.nodes.paragraph;
        return setBlockType(paragraph)(view.state, view.dispatch);
      }) ?? false,
    toggleQuote: () => call(wrapInBlockquoteCommand),
    toggleBulletList: () => call(wrapInBulletListCommand),
    toggleOrderedList: () => call(wrapInOrderedListCommand),
    toggleTaskList: () => {
      const wrapped = call(wrapInBulletListCommand);
      const changed =
        withView((view) => {
          const { state } = view;
          const { from, to } = state.selection;
          let tr = state.tr;
          let touched = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "list_item") {
              const checked = node.attrs.checked;
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                checked: checked == null ? false : null,
              });
              touched = true;
            }
          });
          if (touched) view.dispatch(tr);
          return touched;
        }) ?? false;
      return wrapped || changed;
    },
    insertCodeBlock: () => call(createCodeBlockCommand),
    insertTable: () => call(insertTableCommand, { row: 3, col: 3 }),
    insertHr: () => call(insertHrCommand),
    insertImage: (src, alt = "") => call(insertImageCommand, { src, alt }),
    insertMathInline: (value) =>
      withView((view) => {
        const type = view.state.schema.nodes.math_inline;
        if (!type) return false;
        view.dispatch(
          view.state.tr.replaceSelectionWith(type.create({ value })).scrollIntoView(),
        );
        view.focus();
        return true;
      }) ?? false,
    insertMathBlock: (value) =>
      withView((view) => {
        const type = view.state.schema.nodes.math_block;
        if (!type) return false;
        const { $from } = view.state.selection;
        const pos = $from.depth >= 1 ? $from.after(1) : $from.pos;
        view.dispatch(
          view.state.tr.insert(pos, type.create({ value })).scrollIntoView(),
        );
        view.focus();
        return true;
      }) ?? false,
    insertText: (text) =>
      withView((view) => {
        if (!text) return false;
        const { state } = view;
        view.dispatch(
          state.tr
            .replaceSelectionWith(state.schema.text(text))
            .scrollIntoView(),
        );
        view.focus();
        return true;
      }) ?? false,
    pasteText: (text) =>
      withView((view) => {
        if (!text) return false;
        view.focus();
        return view.pasteText(text);
      }) ?? false,
    linkHref: () =>
      withView((view) => {
        const { $from, from, to } = view.state.selection;
        const direct = $from
          .marks()
          .find((it) => it.type.name === "link");
        if (direct) return String(direct.attrs.href ?? "");
        let href: string | null = null;
        view.state.doc.nodesBetween(from, to, (node) => {
          if (href) return false;
          const found = node.marks.find((it) => it.type.name === "link");
          if (found) href = String(found.attrs.href ?? "");
          return true;
        });
        return href;
      }) ?? null,
    imageSource: () =>
      withView((view) => {
        const { selection } = view.state;
        if (
          selection instanceof NodeSelection &&
          selection.node.type.name === "image"
        ) {
          return String(selection.node.attrs.src ?? "");
        }
        const { $from } = selection;
        for (const node of [$from.nodeAfter, $from.nodeBefore]) {
          if (node && node.type.name === "image") {
            return String(node.attrs.src ?? "");
          }
        }
        return null;
      }) ?? null,
    undo: () => withView((view) => undo(view.state, view.dispatch)) ?? false,    redo: () => withView((view) => redo(view.state, view.dispatch)) ?? false,
    selectAll: () =>
      withView((view) => selectAll(view.state, view.dispatch)) ?? false,
    select: (mode) =>
      withView((view) => {
        const range = rangeFor(view, mode);
        return range ? applyRange(view, range, "select") : false;
      }) ?? false,
    deleteRange: (mode) =>
      withView((view) => {
        const range = rangeFor(view, mode);
        return range ? applyRange(view, range, "delete") : false;
      }) ?? false,
    deleteSelection: () =>
      withView((view) => deleteSelection(view.state, view.dispatch)) ?? false,
    jump: (where) =>
      withView((view) => {
        const { state } = view;
        const { $from } = state.selection;
        let target: Selection;
        switch (where) {
          case "top":
            target = TextSelection.atStart(state.doc);
            break;
          case "bottom":
            target = TextSelection.atEnd(state.doc);
            break;
          case "line-start":
            target = TextSelection.create(state.doc, $from.start());
            break;
          case "line-end":
            target = TextSelection.create(state.doc, $from.end());
            break;
          default:
            view.dispatch(state.tr.scrollIntoView());
            view.focus();
            return true;
        }
        view.dispatch(state.tr.setSelection(target).scrollIntoView());
        view.focus();
        return true;
      }) ?? false,
    moveBlock: (direction) =>
      withView((view) => {
        const { state } = view;
        const { $from } = state.selection;
        // Move within the deepest container that has a neighbour in the
        // requested direction: paragraph in a list item stays in the list,
        // a list item moves inside its list, and so on.
        for (let depth = $from.depth; depth >= 1; depth -= 1) {
          const parent = $from.node(depth - 1);
          if (parent.childCount < 2) continue;
          const index = $from.index(depth - 1);
          const target = index + direction;
          if (target < 0 || target >= parent.childCount) continue;
          const node = parent.child(index);
          const sibling = parent.child(target);
          if (!node.type.compatibleContent(sibling.type)) continue;
          const first = Math.min(index, target);
          let start = $from.start(depth - 1);
          for (let i = 0; i < first; i += 1) {
            start += parent.child(i).nodeSize;
          }
          const end = start + node.nodeSize + sibling.nodeSize;
          const content = Fragment.fromArray(
            direction === -1 ? [node, sibling] : [sibling, node],
          );
          const tr = state.tr.replaceWith(start, end, content);
          const nodeStart = start + (direction === -1 ? 0 : sibling.nodeSize);
          const selection = TextSelection.near(
            tr.doc.resolve(Math.min(nodeStart + 1, tr.doc.content.size)),
          );
          view.dispatch(tr.setSelection(selection).scrollIntoView());
          view.focus();
          return true;
        }
        return false;
      }) ?? false,
    indentList: () =>
      withView((view) => {
        const item = view.state.schema.nodes.list_item;
        if (!item) return false;
        return sinkListItem(item)(view.state, view.dispatch);
      }) ?? false,
    outdentList: () =>
      withView((view) => {
        const item = view.state.schema.nodes.list_item;
        if (!item) return false;
        return liftListItem(item)(view.state, view.dispatch);
      }) ?? false,
    insertParagraph: (where) =>
      withView((view) => {
        const { state } = view;
        const { $from } = state.selection;
        if ($from.depth < 1) return false;
        const paragraph = state.schema.nodes.paragraph.createAndFill();
        if (!paragraph) return false;
        const pos = $from.before(1);
        const insertPos = where === "before" ? pos : pos + $from.node(1).nodeSize;
        const tr = state.tr.insert(insertPos, paragraph);
        const selection = TextSelection.near(
          tr.doc.resolve(where === "before" ? insertPos + 1 : insertPos + 1),
        );
        view.dispatch(tr.setSelection(selection).scrollIntoView());
        view.focus();
        return true;
      }) ?? false,
    setTaskChecked: (value) =>
      withView((view) => {
        const { state } = view;
        const { $from, from, to } = state.selection;
        let tr = state.tr;
        let touched = false;
        const apply = (node: ProseNode, pos: number, checked: boolean | null) => {
          if (node.type.name !== "list_item") return;
          // Only task items carry a boolean; plain list items are left alone.
          if (node.attrs.checked == null) return;
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked });
          touched = true;
        };
        if (from === to) {
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === "list_item") {
              apply(node, $from.before(depth), value);
              break;
            }
          }
        } else {
          state.doc.nodesBetween(from, to, (node, pos) => {
            apply(node, pos, value);
          });
        }
        if (touched) view.dispatch(tr);
        return touched;
      }) ?? false,
    toggleTaskChecked: () =>
      withView((view) => {
        const { state } = view;
        const { $from, from, to } = state.selection;
        let tr = state.tr;
        let touched = false;
        const flip = (node: ProseNode, pos: number) => {
          if (node.type.name !== "list_item") return;
          const checked = node.attrs.checked;
          if (checked == null) return;
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            checked: !checked,
          });
          touched = true;
        };
        if (from === to) {
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === "list_item") {
              flip(node, $from.before(depth));
              break;
            }
          }
        } else {
          state.doc.nodesBetween(from, to, (node, pos) => {
            flip(node, pos);
          });
        }
        if (touched) view.dispatch(tr);
        return touched;
      }) ?? false,
    tableAddRow: (where) =>
      withView((view) =>
        where === "before"
          ? addRowBefore(view.state, view.dispatch)
          : addRowAfter(view.state, view.dispatch),
      ) ?? false,
    tableAddColumn: (where) =>
      withView((view) =>
        where === "before"
          ? addColumnBefore(view.state, view.dispatch)
          : addColumnAfter(view.state, view.dispatch),
      ) ?? false,
    tableMoveRow: (direction) =>
      withView((view) => {
        const { state } = view;
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        return moveTableRow({ from: rect.top, to: rect.top + direction })(
          state,
          view.dispatch,
        );
      }) ?? false,
    tableMoveColumn: (direction) =>
      withView((view) => {
        const { state } = view;
        if (!isInTable(state)) return false;
        const rect = selectedRect(state);
        return moveTableColumn({ from: rect.left, to: rect.left + direction })(
          state,
          view.dispatch,
        );
      }) ?? false,
    tableDelete: (what) =>
      withView((view) => {
        const command =
          what === "row" ? deleteRow : what === "column" ? deleteColumn : deleteTable;
        return command(view.state, view.dispatch);
      }) ?? false,
    tableMarkdown: () =>
      withView((view) => {
        const { $from } = view.state.selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth);
          if (node.type.name !== "table") continue;
          const rows: string[][] = [];
          node.forEach((row) => {
            const cells: string[] = [];
            row.forEach((cell) => {
              cells.push(cell.textContent.replace(/\|/g, "\\|"));
            });
            rows.push(cells);
          });
          if (!rows.length) return null;
          const header = rows[0];
          return [
            `| ${header.join(" | ")} |`,
            `| ${header.map(() => "---").join(" | ")} |`,
            ...rows.slice(1).map((cells) => `| ${cells.join(" | ")} |`),
          ].join("\n");
        }
        return null;
      }) ?? null,
    codeBlockText: () =>
      withView((view) => {
        const { $from } = view.state.selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth);
          if (node.type.name === "code_block") return node.textContent;
        }
        return null;
      }) ?? null,
    selectionText: () =>
      withView((view) => {
        const { from, to } = view.state.selection;
        return view.state.doc.textBetween(from, to, "\n");
      }) ?? "",
    selectionMarkdown: () => {
      const content = withView(
        (view) => view.state.selection.content().content,
      );
      if (!content) return "";
      try {
        return editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const doc = view.state.schema.topNodeType.create(null, content);
          return ctx.get(serializerCtx)(doc);
        });
      } catch (error) {
        console.warn("markdown serialization failed", error);
        return "";
      }
    },
    selectionHtml: () =>
      withView((view) => {
        const selection = view.state.selection;
        const div = document.createElement("div");
        div.appendChild(
          DOMSerializer.fromSchema(view.state.schema).serializeFragment(
            selection.content().content,
          ),
        );
        return div.innerHTML;
      }) ?? "",
    clearFormat: () =>
      withView((view) => {
        const { state } = view;
        const { from, to, empty } = state.selection;
        if (empty) {
          view.dispatch(state.tr.setStoredMarks([]));
        } else {
          view.dispatch(state.tr.removeMark(from, to));
        }
        const paragraph = view.state.schema.nodes.paragraph;
        return setBlockType(paragraph)(view.state, view.dispatch);
      }) ?? false,
    wordCount: () =>
      withView((view) => {
        const text = view.state.doc.textBetween(
          0,
          view.state.doc.content.size,
          "\n",
        );
        const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
        const latin = text.match(/[A-Za-z0-9_]+/g);
        return {
          characters: [...text].length,
          words: (cjk?.length ?? 0) + (latin?.length ?? 0),
          lines: text.split("\n").length,
        };
      }) ?? { characters: 0, words: 0, lines: 0 },
    find: (query, backwards = false) =>
      withView((view) => {
        const matches = collectMatches(view.state.doc, query);
        if (!matches.length) {
          findState = { query, index: -1 };
          return { index: -1, total: 0 };
        }
        if (findState.query !== query) findState = { query, index: -1 };
        const index = backwards
          ? findState.index <= 0
            ? matches.length - 1
            : findState.index - 1
          : (findState.index + 1) % matches.length;
        findState = { query, index };
        const match = matches[index];
        const selection = TextSelection.create(
          view.state.doc,
          match.from,
          match.to,
        );
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        view.focus();
        return { index, total: matches.length };
      }) ?? { index: -1, total: 0 },
    replaceCurrent: (query, replacement) =>
      withView((view) => {
        const matches = collectMatches(view.state.doc, query);
        if (!matches.length) return { index: -1, total: 0 };
        const selection = view.state.selection;
        let index = matches.findIndex((match) => match.from >= selection.from);
        if (index === -1) index = 0;
        const match = matches[index];
        const tr = view.state.tr.replaceWith(
          match.from,
          match.to,
          view.state.schema.text(replacement),
        );
        view.dispatch(tr.scrollIntoView());
        const remaining = collectMatches(view.state.doc, query);
        return { index, total: remaining.length };
      }) ?? { index: -1, total: 0 },
    replaceAll: (query, replacement) => {
      if (!query) return 0;
      return (
        withView((view) =>
          replaceMatches(collectMatches(view.state.doc, query), replacement),
        ) ?? 0
      );
    },
    focusHeading: (index) => {
      withView((view) => {
        let current = -1;
        let target: number | null = null;
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === "heading") {
            current += 1;
            if (current === index) {
              target = pos;
              return false;
            }
          }
          return true;
        });
        if (target == null) return;
        const selection = TextSelection.near(
          view.state.doc.resolve(target + 1),
        );
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        view.focus();
      });
    },
    focusLine: (line) => {
      withView((view) => {
        const target = Math.max(1, Math.floor(line));
        let lineNo = 1;
        let position: number | null = null;
        view.state.doc.forEach((node, offset) => {
          if (position != null) return;
          const start = lineNo;
          const span = Math.max(1, node.textContent.split("\n").length);
          const end = start + span - 1;
          if (target >= start && target <= end) position = offset + 1;
          lineNo = end + 1;
        });
        if (position == null) return;
        const selection = TextSelection.near(
          view.state.doc.resolve(
            Math.min(position, view.state.doc.content.size),
          ),
        );
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        view.focus();
      });
    },
    getHtml: () => {
      try {
        return editor.action(getHTML());
      } catch {
        return "";
      }
    },
    getMarkdown: () => {
      try {
        return editor.action(getMarkdown());
      } catch {
        return "";
      }
    },
    refresh: () => {
      withView((view) => {
        view.dispatch(view.state.tr);
      });
    },
  };
}

export function computeOutline(editor: Editor) {
  try {
    return editor.action(outline()).map((item, index) => ({
      ...item,
      index,
    }));
  } catch {
    return [];
  }
}
