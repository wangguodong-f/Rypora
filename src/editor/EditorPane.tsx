import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
  remarkStringifyOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm, remarkGFMPlugin } from "@milkdown/kit/preset/gfm";
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
import {
  attachSourceModes,
  type SourceModesHandle,
} from "./sourceModes";
import {
  alertSchema,
  commentSchema,
  highlightSchema,
  htmlBreakSchema,
  htmlInlineSchema,
  linkDefinitionSchema,
  linkRefRemark,
  linkRefSchema,
  normalizeEmptyFootnoteDefinitions,
  richImageSchema,
  richRemark,
  subscriptSchema,
  superscriptSchema,
  underlineSchema,
} from "./extensions";
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
  onBaseline: (markdown: string) => void;
  onSelection: (info: SelectionInfo) => void;
  onOutline: (outline: OutlineItem[]) => void;
}

function EditorHost({
  tab,
  onChange,
  onBaseline,
  onSelection,
  onOutline,
}: EditorHostProps) {
  const onChangeRef = useRef(onChange);
  const onBaselineRef = useRef(onBaseline);
  const onSelectionRef = useRef(onSelection);
  const onOutlineRef = useRef(onOutline);
  onChangeRef.current = onChange;
  onBaselineRef.current = onBaseline;
  onSelectionRef.current = onSelection;
  onOutlineRef.current = onOutline;

  // The trailing plugin appends a paragraph right after the editor is created,
  // which makes the listener report the canonical Markdown of a document the
  // user has not touched yet. That first report becomes the baseline instead of
  // an edit, so opening a file never marks it dirty or rewrites it.
  const baselinePendingRef = useRef(true);
  const mountedAtRef = useRef(Date.now());

  const spellcheck = useSettings((state) => state.spellcheck);

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, tab.content);
        ctx.set(prismConfig.key, {
          configureRefractor: () => getRefractor(),
        });
        // Typora uses `~x~` for subscript, so a single tilde must not start
        // GFM strikethrough. `~~x~~` still works.
        ctx.set(remarkGFMPlugin.options.key, { singleTilde: false });
        // Typora writes `-` bullets and `---` rules; remark-stringify defaults
        // to `*` and `***`, which would rewrite files the moment they open.
        ctx.set(remarkStringifyOptionsCtx, {
          ...ctx.get(remarkStringifyOptionsCtx),
          bullet: "-",
          rule: "-",
        });
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            const next = normalizeEmptyFootnoteDefinitions(markdown);
            if (baselinePendingRef.current) {
              baselinePendingRef.current = false;
              if (Date.now() - mountedAtRef.current < 2000) {
                onBaselineRef.current(next);
                return;
              }
            }
            onChangeRef.current(next);
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
      .use(linkRefRemark)
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
      .use(richRemark)
      .use(underlineSchema)
      .use(htmlInlineSchema)
      .use(htmlBreakSchema)
      .use(highlightSchema)
      .use(superscriptSchema)
      .use(subscriptSchema)
      .use(commentSchema)
      .use(alertSchema)
      .use(linkRefSchema)
      .use(linkDefinitionSchema)
      .use(richImageSchema)
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
  onBaseline: (markdown: string) => void;
  onSelection: (info: SelectionInfo) => void;
  onOutline: (outline: OutlineItem[]) => void;
}

function fitSourceTextarea(
  textarea: HTMLTextAreaElement,
  pane: HTMLElement,
): void {
  const scrollTop = pane.scrollTop;
  // Measuring with height:auto briefly collapses the pane's scroll height, so
  // restore the scroll offset afterwards to keep the viewport in place.
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
  pane.scrollTop = scrollTop;
}

function SourceEditor({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (markdown: string) => void;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modesRef = useRef<SourceModesHandle | null>(null);

  const fit = useCallback(() => {
    const textarea = textareaRef.current;
    const pane = paneRef.current;
    if (!textarea || !pane) return;
    fitSourceTextarea(textarea, pane);
    modesRef.current?.sync();
  }, []);

  // Grow the textarea to fit the document so that the pane itself scrolls, the
  // same way the rich-text editor does. A fixed-height textarea would scroll
  // internally and confine the document to the top of the pane.
  useLayoutEffect(() => {
    fit();
  }, [tab.content, fit]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const pane = paneRef.current;
    if (!textarea || !pane) return;
    const modes = attachSourceModes(textarea, pane);
    modesRef.current = modes;
    modes.sync();

    // Re-measure the document height when the pane width changes (window
    // resize, sidebar toggle), which changes line wrapping.
    const observer = new ResizeObserver(fit);
    observer.observe(pane);

    // Font size, line width and font family are CSS variables on the root
    // element; re-measure after they change so the textarea height and the
    // mode masks stay in sync.
    const typography = new MutationObserver(fit);
    typography.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-theme", "data-dark"],
    });

    return () => {
      observer.disconnect();
      typography.disconnect();
      modes.detach();
      modesRef.current = null;
    };
  }, [fit]);

  return (
    <div className="source-editor" ref={paneRef}>
      <div className="source-sheet">
        <textarea
          ref={textareaRef}
          className="source-textarea"
          value={tab.content}
          spellCheck={false}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function EditorPane(props: EditorPaneProps) {
  const sourceMode = useUi((state) => state.sourceMode);
  if (sourceMode) {
    return <SourceEditor tab={props.tab} onChange={props.onChange} />;
  }
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
