import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
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
import { selectAll, setBlockType } from "@milkdown/kit/prose/commands";
import { redo, undo } from "@milkdown/kit/prose/history";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { FindResult } from "../lib/types";

interface AnyCommand {
  key: unknown;
}

interface Match {
  from: number;
  to: number;
}

let findState: { query: string; index: number } = { query: "", index: -1 };

export interface EditorCommands {
  toggleBold: () => boolean;
  toggleItalic: () => boolean;
  toggleStrike: () => boolean;
  toggleInlineCode: () => boolean;
  toggleLink: (href: string) => boolean;
  setHeading: (level: number) => boolean;
  setParagraph: () => boolean;
  toggleQuote: () => boolean;
  toggleBulletList: () => boolean;
  toggleOrderedList: () => boolean;
  toggleTaskList: () => boolean;
  insertCodeBlock: () => boolean;
  insertTable: () => boolean;
  insertHr: () => boolean;
  insertImage: (src: string, alt?: string) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  selectAll: () => boolean;
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

  return {
    toggleBold: () => call(toggleStrongCommand),
    toggleItalic: () => call(toggleEmphasisCommand),
    toggleStrike: () => call(toggleStrikethroughCommand),
    toggleInlineCode: () => call(toggleInlineCodeCommand),
    toggleLink: (href) => call(toggleLinkCommand, { href }),
    setHeading: (level) => call(wrapInHeadingCommand, level),
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
    undo: () => withView((view) => undo(view.state, view.dispatch)) ?? false,
    redo: () => withView((view) => redo(view.state, view.dispatch)) ?? false,
    selectAll: () =>
      withView((view) => selectAll(view.state, view.dispatch)) ?? false,
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
