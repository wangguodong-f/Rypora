import { useEffect, useRef } from "react";
import {
  Milkdown,
  MilkdownProvider,
  useEditor,
  useInstance,
} from "@milkdown/react";
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { cursor } from "@milkdown/kit/plugin/cursor";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { prism, prismConfig } from "@milkdown/plugin-prism";
import { outline } from "@milkdown/kit/utils";
import { computeOutline, createCommands } from "./commands";
import { setEditorCommands } from "./editorBus";
import { focusPlugin, typewriterPlugin } from "./focus";
import { imagePastePlugin, imageView } from "./images";
import {
  mathBlockSchema,
  mathBlockView,
  mathInlineSchema,
  mathInlineView,
  mathRemark,
} from "./math";
import { mermaidPlugin } from "./mermaid";
import { getRefractor } from "./highlight";
import { taskListPlugin } from "./tasks";
import { useSettings } from "../stores/settings";
import { useUi } from "../stores/ui";
import { openFile } from "../lib/ipc";
import { useTabs } from "../stores/tabs";
import type { OutlineItem, SelectionInfo, Tab } from "../lib/types";
import type { Selection } from "@milkdown/kit/prose/state";

function selectionInfo(selection: Selection): SelectionInfo {
  // The listener reports the selection of the *incoming* transaction, which can
  // be ahead of `view.state`. Resolve against the selection's own document.
  const doc = selection.$from.doc;
  const text = doc.textBetween(0, selection.from, "\n", "\n");
  const lines = text.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1] ?? "").length + 1,
    empty: selection.empty,
  };
}

interface EditorHostProps {
  tab: Tab;
  onChange: (markdown: string) => void;
  onSelection: (info: SelectionInfo) => void;
  onOutline: (outline: OutlineItem[]) => void;
}

function EditorHost({
  tab,
  onChange,
  onSelection,
  onOutline,
}: EditorHostProps) {
  const onChangeRef = useRef(onChange);
  const onSelectionRef = useRef(onSelection);
  const onOutlineRef = useRef(onOutline);
  onChangeRef.current = onChange;
  onSelectionRef.current = onSelection;
  onOutlineRef.current = onOutline;

  const spellcheck = useSettings((state) => state.spellcheck);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, tab.content);
        ctx.set(prismConfig.key, {
          configureRefractor: () => getRefractor(),
        });
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            onChangeRef.current(markdown);
          })
          .selectionUpdated((_ctx, selection) => {
            onSelectionRef.current(selectionInfo(selection));
          })
          .updated((ctx) => {
            try {
              onOutlineRef.current(
                outline()(ctx).map((item, index) => ({ ...item, index })),
              );
            } catch {
              // ignore
            }
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(cursor)
      .use(prism)
      .use(taskListPlugin)
      .use(mathRemark)
      .use(mathInlineSchema)
      .use(mathBlockSchema)
      .use(mathInlineView)
      .use(mathBlockView)
      .use(imageView)
      .use(mermaidPlugin)
      .use(imagePastePlugin)
      .use(focusPlugin)
      .use(typewriterPlugin)
      .use(trailing);
  }, []);

  const [loading, getInstance] = useInstance();

  useEffect(() => {
    if (loading) return;
    const editor = getInstance();
    if (!editor) return;
    setEditorCommands(createCommands(editor));
    onOutlineRef.current(computeOutline(editor));
    try {
      editor.ctx.get(editorViewCtx).focus();
    } catch {
      // ignore
    }
    return () => setEditorCommands(null);
  }, [loading, getInstance]);

  useEffect(() => {
    if (loading) return;
    const editor = getInstance();
    if (!editor) return;
    try {
      const dom = editor.ctx.get(editorViewCtx).dom;
      dom.setAttribute("spellcheck", spellcheck ? "true" : "false");
      dom.setAttribute("autocorrect", spellcheck ? "on" : "off");
    } catch {
      // ignore
    }
  }, [spellcheck, loading, getInstance]);

  return <Milkdown />;
}

interface EditorPaneProps {
  tab: Tab;
  onChange: (markdown: string) => void;
  onSelection: (info: SelectionInfo) => void;
  onOutline: (outline: OutlineItem[]) => void;
}

export function EditorPane(props: EditorPaneProps) {
  return (
    <MilkdownProvider key={`${props.tab.id}:${props.tab.revision}`}>
      <EditorHost {...props} />
    </MilkdownProvider>
  );
}

export function ExternalChangeBanner({ tab }: { tab: Tab }) {
  if (!tab.externalChanged) return null;

  const reload = async () => {
    if (!tab.path) return;
    try {
      const file = await openFile(tab.path);
      useTabs.getState().applyDiskContent(tab.id, file);
      useUi.getState().flash("已重新加载磁盘上的文件");
    } catch (error) {
      useUi.getState().flash(`重新加载失败：${String(error)}`);
    }
  };

  return (
    <div className="external-banner">
      <span>此文件已在磁盘上被外部修改。</span>
      <div className="external-actions">
        <button onClick={() => void reload()}>重新加载</button>
        <button
          className="ghost"
          onClick={() => useTabs.getState().setExternalChanged(tab.id, false)}
        >
          保留我的修改
        </button>
      </div>
    </div>
  );
}
