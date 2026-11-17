import { useEffect, useRef } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { TitleBar } from "./components/TitleBar";
import { TabBar } from "./components/TabBar";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Welcome } from "./components/Welcome";
import { FindBar } from "./components/FindBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { PromptDialog } from "./components/PromptDialog";
import { QuickOpen } from "./components/QuickOpen";
import { UnsavedDialog } from "./components/UnsavedDialog";
import { EditorPane, ExternalChangeBanner } from "./editor/EditorPane";
import { runCommand } from "./editor/editorBus";
import { exportHtml, exportPdf } from "./lib/export";
import {
  absoluteImagePath,
  chooseImageRoot,
  closeTabWithConfirm,
  copyActiveImage,
  copyAllImages,
  deleteActiveFile,
  deleteActiveImageFile,
  importFile,
  insertImageDialog,
  moveActiveImage,
  moveAllImages,
  newTab,
  newWindow,
  openFileDialog,
  openFolderDialog,
  reloadImages,
  reloadTab,
  requestQuit,
  saveActive,
  saveAll,
} from "./lib/fileActions";
import {
  isTauri,
  onFsChanged,
  onMenuAction,
  onOpenFiles,
  openFile,
  setRecentFiles,
  syncViewChecks,
  takePendingFiles,
  focusAllWindows,
} from "./lib/ipc";
import { basename, dirname, joinPath, samePath } from "./lib/paths";
import { isSameMarkdown } from "./lib/markdownCompare";
import {
  openUrl,
  readClipboardText,
  revealPath,
  writeClipboard,
} from "./lib/clipboard";
import { resolveTheme, isDarkTheme, useSettings } from "./stores/settings";
import { useTabs } from "./stores/tabs";
import { useUi } from "./stores/ui";
import { useWorkspace } from "./stores/workspace";
import type { OutlineItem, SelectionInfo, ThemeMode } from "./lib/types";

const SHORTCUTS = `文件
  ⌘N          新建
  ⌘T          新建标签页
  ⌘O          打开
  ⌘S          保存
  ⌘⇧S         另存为
  ⌥⌘S         保存全部打开的文件
  ⌘W          关闭
  ⌘P          打印 / 导出 PDF

编辑
  ⌘Z / ⌘⇧Z    撤消 / 重做
  ⌘X / ⌘C / ⌘V  剪切 / 复制 / 粘贴
  ⌘A          全选
  ⌘F          查找
  ⌥⌘F         查找和替换

段落
  ⌘1 … ⌘6     一至六级标题
  ⌘0          段落
  ⌥⌘O         有序列表
  ⌥⌘U         无序列表
  ⌥⌘X         任务列表
  ⌥⌘Q         引用
  ⌥⌘C         代码块
  ⌥⌘T         插入表格
  ⌥⌘-         水平分割线

格式
  ⌘B          加粗
  ⌘I          斜体
  ⌃\`          代码
  ⌃⇧\`         删除线
  ⌘K          超链接
  ⌃⌘I         插入图片

显示
  F8          专注模式
  F9          打字机模式
  ⌘⇧L         显示／隐藏侧边栏
  ⌃⌘1 / ⌃⌘2 / ⌃⌘3  大纲 / 文档列表 / 文件树
  ⌘⇧F         搜索`;

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const DEFAULT_ZOOM = 4;

let zoomLevel = 1;
let alwaysOnTop = false;

function applyZoom(next: number): void {
  zoomLevel = Math.min(3, Math.max(0.5, Math.round(next * 100) / 100));
  if (!isTauri()) {
    document.documentElement.style.zoom = String(zoomLevel);
    return;
  }
  void getCurrentWebview()
    .setZoom(zoomLevel)
    .catch(() => undefined);
}

function stepZoom(direction: -1 | 1): void {
  const current = ZOOM_STEPS.reduce(
    (best, step, index) =>
      Math.abs(step - zoomLevel) < Math.abs(ZOOM_STEPS[best] - zoomLevel)
        ? index
        : best,
    DEFAULT_ZOOM,
  );
  const target = Math.min(
    ZOOM_STEPS.length - 1,
    Math.max(0, current + direction),
  );
  applyZoom(ZOOM_STEPS[target]);
}

function toggleAlwaysOnTop(): void {
  alwaysOnTop = !alwaysOnTop;
  const ui = useUi.getState();
  ui.flash(alwaysOnTop ? "窗口已置顶" : "已取消置顶");
  if (!isTauri()) return;
  void getCurrentWindow()
    .setAlwaysOnTop(alwaysOnTop)
    .catch(() => ui.flash("无法设置窗口置顶"));
}

function copyFromEditor(text: string | null | undefined, label: string): void {
  if (!text) {
    useUi.getState().flash("没有可复制的内容");
    return;
  }
  void writeClipboard(text).then((ok) => {
    useUi.getState().flash(ok ? `已复制${label}` : "复制失败");
  });
}

function pastePlainText(): void {
  void readClipboardText().then((text) => {
    if (text === null) {
      useUi.getState().flash("无法读取剪贴板");
      return;
    }
    if (!text) {
      useUi.getState().flash("剪贴板为空");
      return;
    }
    if (runCommand("pasteText", text) === false) {
      useUi.getState().flash("请在编辑器中放置光标后粘贴");
    }
  });
}

/** Absolute file system path for an image source in the active document. */

function activeTabInfo() {
  const tabs = useTabs.getState();
  return tabs.tabs.find((item) => item.id === tabs.activeId);
}

/** Expand the file tree down to the active document and scroll it into view. */
function revealInTree(): void {
  const ui = useUi.getState();
  const workspace = useWorkspace.getState();
  const tab = activeTabInfo();
  if (!tab?.path) {
    ui.flash("该文件尚未保存到磁盘");
    return;
  }
  const root = workspace.root;
  if (!root) {
    ui.setSidebarTab("files");
    ui.flash("请先打开一个文件夹");
    return;
  }
  const normalized = tab.path.replace(/\\/g, "/");
  let base = root.replace(/\\/g, "/");
  // macOS may report /private/var for a root that was opened as /var.
  if (!normalized.startsWith(`${base}/`) && !normalized.startsWith(base)) {
    if (base.startsWith("/private")) base = base.slice("/private".length);
    else base = `/private${base}`;
  }
  if (!normalized.startsWith(`${base}/`) && normalized !== base) {
    ui.setSidebarTab("files");
    ui.flash("当前文件不在已打开的文件夹中");
    return;
  }
  const parts = normalized.slice(base.length).split("/").filter(Boolean);
  let current = base;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = `${current}/${parts[i]}`;
    workspace.expand(current);
  }
  ui.setSidebarTab("files");
  window.setTimeout(() => {
    const row = document.querySelector(
      `[data-path="${CSS.escape(tab.path!)}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, 80);
}

function findInEditor(backwards: boolean): void {
  const ui = useUi.getState();
  const query = ui.findQuery;
  if (!query) {
    ui.setFindOpen(true);
    return;
  }
  const found = runCommand("find", query, backwards);
  if (found) ui.setFindResult(found);
}

function showWordCount(): void {
  const counts = runCommand("wordCount") ?? {
    characters: 0,
    words: 0,
    lines: 0,
  };
  const selection = useUi.getState().selection;
  void message(
    `字数 ${counts.words}\n字符 ${counts.characters}\n行数 ${counts.lines}\n\n光标位于第 ${selection.line} 行第 ${selection.column} 列`,
    { title: "字数统计" },
  );
}

function showOutlinePopover(): void {
  const outline = useUi.getState().outline;
  if (!outline.length) {
    void message("当前文档没有标题。", { title: "大纲" });
    return;
  }
  const text = outline
    .map((item) => `${"  ".repeat(Math.max(0, item.level - 1))}${item.text}`)
    .join("\n");
  void message(text, { title: "大纲" });
}

function showFileInfo(): void {
  const tab = activeTabInfo();
  if (!tab) {
    void message("没有打开的文件。", { title: "显示简介" });
    return;
  }
  const modified = tab.mtime
    ? new Date(tab.mtime).toLocaleString()
    : "未保存";
  void message(
    `标题：${tab.title}\n位置：${tab.path ?? "尚未保存到磁盘"}\n修改时间：${modified}\n状态：${tab.dirty ? "有未保存的修改" : "已保存"}`,
    { title: "显示简介" },
  );
}

/** Text inputs and textareas (Quick Open, find bar, dialogs) keep native select-all. */
function focusedTextControl(): HTMLInputElement | HTMLTextAreaElement | null {
  const element = document.activeElement;
  if (element instanceof HTMLInputElement) return element;
  if (element instanceof HTMLTextAreaElement) return element;
  return null;
}

/**
 * Undo/redo inside a focused text input. The native menu owns Cmd+Z, so without
 * this the accelerator would fall through to the rich-text editor and do
 * nothing while typing in source mode or a dialog field.
 */
function textControlHistory(direction: "undo" | "redo"): boolean {
  const control = focusedTextControl();
  if (!control) return false;
  return document.execCommand(direction);
}

function applyMenuAction(action: string): void {
  const ui = useUi.getState();
  const tabs = useTabs.getState();
  const activeId = tabs.activeId;

  const heading = /^para\.heading\.([1-6])$/.exec(action);
  if (heading) {
    runCommand("setHeading", Number(heading[1]));
    return;
  }

  const theme = /^theme\.(auto|light|dark|github|gothic|newsprint|night|pixyll|whitey)$/.exec(
    action,
  );
  if (theme) {
    useSettings.getState().update({ theme: theme[1] as ThemeMode });
    return;
  }

  const recent = /^file\.recent\.open\.(\d+)$/.exec(action);
  if (recent) {
    const path = useSettings.getState().recentFiles[Number(recent[1])];
    if (path) void useTabs.getState().openPath(path);
    return;
  }

  const zoomImage = /^fmt\.image\.zoom\.(\d+)$/.exec(action);
  if (zoomImage) {
    if (runCommand("setImageZoom", Number(zoomImage[1])) === false) {
      useUi.getState().flash("光标不在图片上");
    }
    return;
  }

  const imageSyntax = /^fmt\.image\.syntax\.(markdown|html)$/.exec(action);
  if (imageSyntax) {
    const applied = runCommand(
      "setImageSyntax",
      imageSyntax[1] as "markdown" | "html",
    );
    if (!applied) useUi.getState().flash("光标不在图片上");
    return;
  }

  switch (action) {
    case "file.new":
    case "file.new-tab":
      newTab();
      return;
    case "file.new-window": {
      void newWindow(null);
      return;
    }
    case "file.quick-open":
      ui.setQuickOpen(true);
      return;
    case "file.import":
      void importFile();
      return;
    case "file.delete":
      void deleteActiveFile();
      return;
    case "file.recent.reopen":
      void tabs.reopenClosed();
      return;
    case "file.recent.clear":
      useSettings.getState().update({ recentFiles: [] });
      ui.flash("已清除最近文件");
      return;
    case "file.open":
      void openFileDialog();
      return;
    case "file.open-folder":
      void openFolderDialog();
      return;
    case "file.close":
      if (activeId) void closeTabWithConfirm(activeId);
      return;
    case "file.save":
      void saveActive();
      return;
    case "file.save-as":
      void saveActive({ saveAs: true });
      return;
    case "file.save-all":
      void saveAll();
      return;
    case "file.revert":
      if (activeId) void reloadTab(activeId);
      return;
    case "file.info":
      showFileInfo();
      return;
    case "file.reveal-tree":
      revealInTree();
      return;
    case "file.reveal-finder": {
      const tab = activeTabInfo();
      if (!tab?.path) {
        ui.flash("该文件尚未保存到磁盘");
        return;
      }
      void revealPath(tab.path).catch(() => ui.flash("无法在访达中显示该文件"));
      return;
    }
    case "file.export.html":
      void exportHtml();
      return;
    case "file.export.pdf":
    case "file.print":
      void exportPdf();
      return;

    case "edit.undo":
      if (!textControlHistory("undo")) runCommand("undo");
      return;
    case "edit.redo":
      if (!textControlHistory("redo")) runCommand("redo");
      return;
    case "edit.select.all": {
      const control = focusedTextControl();
      if (control) {
        control.select();
        return;
      }
      runCommand("selectAll");
      return;
    }
    case "edit.math.refresh":
      runCommand("refresh");
      return;
    case "edit.find.find":
      ui.setFindOpen(true);
      return;
    case "edit.find.replace":
      ui.setFindOpen(true);
      return;
    case "edit.find.next":
      findInEditor(false);
      return;
    case "edit.find.previous":
      findInEditor(true);
      return;
    case "edit.find.replace-next": {
      const replaced = runCommand("replaceCurrent", ui.findQuery, ui.findReplacement);
      if (replaced) ui.setFindResult(replaced);
      return;
    }
    case "edit.find.jump-selection":
      runCommand("jump", "selection");
      return;
    case "edit.copy.plain":
      copyFromEditor(runCommand("selectionText"), "为纯文本");
      return;
    case "edit.copy.simplified":
      copyFromEditor(runCommand("selectionHtml"), "为简化格式");
      return;
    case "edit.copy.markdown":
      copyFromEditor(runCommand("selectionMarkdown"), "为 Markdown");
      return;
    case "edit.copy.html":
      copyFromEditor(runCommand("selectionHtml"), "为 HTML");
      return;
    case "edit.paste.plain":
    case "edit.paste.match-style":
      pastePlainText();
      return;
    case "edit.select.block":
      runCommand("select", "block");
      return;
    case "edit.select.line":
      runCommand("select", "line");
      return;
    case "edit.select.scope":
      runCommand("select", "scope");
      return;
    case "edit.select.word":
      runCommand("select", "word");
      return;
    case "edit.select.jump-top":
      runCommand("jump", "top");
      return;
    case "edit.select.jump-bottom":
      runCommand("jump", "bottom");
      return;
    case "edit.select.jump-selection":
      runCommand("jump", "selection");
      return;
    case "edit.select.jump-line-start":
      runCommand("jump", "line-start");
      return;
    case "edit.select.jump-line-end":
      runCommand("jump", "line-end");
      return;
    case "edit.move-row-up":
      runCommand("moveBlock", -1);
      return;
    case "edit.move-row-down":
      runCommand("moveBlock", 1);
      return;
    case "edit.delete":
    case "edit.delete.word":
    case "edit.delete.scope":
    case "edit.delete.line":
    case "edit.delete.block": {
      const mode =
        action === "edit.delete.word"
          ? "word"
          : action === "edit.delete.scope"
            ? "scope"
            : action === "edit.delete.line"
              ? "line"
              : action === "edit.delete.block"
                ? "block"
                : null;
      if (mode) {
        runCommand("deleteRange", mode);
      } else {
        runCommand("deleteSelection");
      }
      return;
    }

    case "para.paragraph":
      runCommand("setParagraph");
      return;
    case "para.heading.increase":
      runCommand("changeHeading", -1);
      return;
    case "para.heading.decrease":
      runCommand("changeHeading", 1);
      return;
    case "para.quote":
      runCommand("toggleQuote");
      return;
    case "para.code-block":
      runCommand("insertCodeBlock");
      return;
    case "para.code.copy":
      copyFromEditor(runCommand("codeBlockText"), "代码块内容");
      return;
    case "para.list.ordered":
      runCommand("toggleOrderedList");
      return;
    case "para.list.unordered":
      runCommand("toggleBulletList");
      return;
    case "para.list.task":
      runCommand("toggleTaskList");
      return;
    case "para.list.indent":
      runCommand("indentList");
      return;
    case "para.list.outdent":
      runCommand("outdentList");
      return;
    case "para.task.complete":
      runCommand("setTaskChecked", true);
      return;
    case "para.task.incomplete":
      runCommand("setTaskChecked", false);
      return;
    case "para.task.toggle":
      runCommand("toggleTaskChecked");
      return;
    case "para.insert-before":
      runCommand("insertParagraph", "before");
      return;
    case "para.insert-after":
      runCommand("insertParagraph", "after");
      return;
    case "para.table.insert":
      runCommand("insertTable");
      return;
    case "para.table.row-above":
      runCommand("tableAddRow", "before");
      return;
    case "para.table.row-below":
      runCommand("tableAddRow", "after");
      return;
    case "para.table.col-before":
      runCommand("tableAddColumn", "before");
      return;
    case "para.table.col-after":
      runCommand("tableAddColumn", "after");
      return;
    case "para.table.row-up":
      runCommand("tableMoveRow", -1);
      return;
    case "para.table.row-down":
      runCommand("tableMoveRow", 1);
      return;
    case "para.table.col-left":
      runCommand("tableMoveColumn", -1);
      return;
    case "para.table.col-right":
      runCommand("tableMoveColumn", 1);
      return;
    case "para.table.delete-row":
      runCommand("tableDelete", "row");
      return;
    case "para.table.delete-column":
      runCommand("tableDelete", "column");
      return;
    case "para.table.delete":
      runCommand("tableDelete", "table");
      return;
    case "para.table.copy":
      copyFromEditor(runCommand("tableMarkdown"), "表格");
      return;
    case "para.alert.note":
    case "para.alert.tip":
    case "para.alert.important":
    case "para.alert.warning":
    case "para.alert.caution": {
      const kind = action.split(".").pop() ?? "note";
      runCommand("insertAlert", kind);
      return;
    }
    case "para.link-reference": {
      const selected = (runCommand("selectionText") ?? "").trim();
      if (!selected) {
        ui.flash("请先选中要作为链接的文字");
        return;
      }
      const suggested = selected.replace(/\s+/g, "-").slice(0, 40);
      void ui.prompt("引用名称", suggested).then((label) => {
        if (!label) return;
        const existing = runCommand("definitionUrl", label) ?? "";
        void ui
          .prompt(
            existing
              ? `链接地址（已有定义 ${existing}）`
              : "链接地址（留空表示稍后添加定义）",
            existing || "https://",
          )
          .then((url) => {
            const target = url && url !== "https://" ? url : null;
            const ok = runCommand("insertLinkReference", label, target);
            if (!ok) useUi.getState().flash("插入链接引用失败");
          });
      });
      return;
    }
    case "para.footnote":
      if (runCommand("insertFootnote") === false) {
        ui.flash("插入脚注失败");
      }
      return;
    case "para.math-block":
      void ui.prompt("公式块").then((value) => {
        if (value === null) return;
        runCommand("insertMathBlock", value);
      });
      return;
    case "para.hr":
      runCommand("insertHr");
      return;

    case "fmt.strong":
      runCommand("toggleBold");
      return;
    case "fmt.emphasis":
      runCommand("toggleItalic");
      return;
    case "fmt.code":
      runCommand("toggleInlineCode");
      return;
    case "fmt.strike":
      runCommand("toggleStrike");
      return;
    case "fmt.hyperlink":
      void ui.prompt("链接地址", "https://").then((href) => {
        if (href) runCommand("toggleLink", href);
      });
      return;
    case "fmt.math-inline":
      void ui.prompt("内联公式").then((value) => {
        if (value) runCommand("insertMathInline", value);
      });
      return;
    case "fmt.link.open": {
      const href = runCommand("linkHref");
      if (!href) {
        ui.flash("光标不在链接上");
        return;
      }
      void openUrl(href).catch(() => ui.flash("无法打开该链接"));
      return;
    }
    case "fmt.link.copy": {
      const href = runCommand("linkHref");
      if (!href) {
        ui.flash("光标不在链接上");
        return;
      }
      copyFromEditor(href, "链接地址");
      return;
    }
    case "fmt.image.reveal": {
      const path = absoluteImagePath(runCommand("imageSource"));
      if (!path) {
        ui.flash("光标不在本地图片上");
        return;
      }
      void revealPath(path).catch(() => ui.flash("无法在访达中显示该图片"));
      return;
    }
    case "fmt.clear":
      runCommand("clearFormat");
      return;
    case "fmt.underline":
      runCommand("toggleUnderline");
      return;
    case "fmt.highlight":
      runCommand("toggleHighlight");
      return;
    case "fmt.superscript":
      runCommand("toggleSuperscript");
      return;
    case "fmt.subscript":
      runCommand("toggleSubscript");
      return;
    case "fmt.comment":
      void ui.prompt("注释内容").then((value) => {
        if (value === null) return;
        runCommand("insertComment", value);
      });
      return;
    case "fmt.image.insert":
    case "fmt.image.insert-local":
      void insertImageDialog();
      return;
    case "fmt.image.delete-file":
      void deleteActiveImageFile();
      return;
    case "fmt.image.copy-to":
      void copyActiveImage();
      return;
    case "fmt.image.rename":
      void moveActiveImage();
      return;
    case "fmt.image.copy-all":
      void copyAllImages();
      return;
    case "fmt.image.move-all":
      void moveAllImages();
      return;
    case "fmt.image.reload-all":
      reloadImages();
      return;
    case "fmt.image.root-path":
      void chooseImageRoot();
      return;
    case "fmt.image.global-settings":
      ui.setSettingsOpen(true);
      return;

    case "window.bring-all-to-front":
      void focusAllWindows();
      return;

    case "view.source-mode": {
      const next = !ui.sourceMode;
      ui.setSourceMode(next);
      ui.flash(next ? "已切换到源代码模式" : "已返回所见即所得");
      return;
    }
    case "view.focus-mode":
      ui.setFocusMode(!ui.focusMode);
      return;
    case "view.typewriter-mode":
      ui.setTypewriterMode(!ui.typewriterMode);
      return;
    case "view.sidebar":
      ui.toggleSidebar();
      return;
    case "view.panel.outline":
      ui.setSidebarTab("outline");
      return;
    case "view.panel.articles":
    case "view.panel.files":
      ui.setSidebarTab("files");
      return;
    case "view.panel.search":
      ui.setSidebarTab("search");
      return;
    case "view.word-count":
      showWordCount();
      return;
    case "view.outline-popover":
      showOutlinePopover();
      return;
    case "view.actual-size":
      applyZoom(1);
      return;
    case "view.zoom-in":
      stepZoom(1);
      return;
    case "view.zoom-out":
      stepZoom(-1);
      return;
    case "view.always-on-top":
      toggleAlwaysOnTop();
      return;

    case "app.preferences":
      ui.setSettingsOpen(true);
      return;
    case "app.quit":
      void requestQuit();
      return;
    case "app.about":
    case "help.about":
      void message(
        "Rypora 0.2.0\n\n使用 Tauri、React 与 Milkdown 构建的所见即所得 Markdown 编辑器。",
        { title: "关于 Rypora" },
      );
      return;
    case "help.shortcuts":
      void message(SHORTCUTS, { title: "键盘快捷键" });
      return;
    default:
      return;
  }
}

export default function App() {
  const theme = useSettings((state) => state.theme);
  const recentFiles = useSettings((state) => state.recentFiles);
  const fontSize = useSettings((state) => state.fontSize);
  const lineWidth = useSettings((state) => state.lineWidth);
  const fontFamily = useSettings((state) => state.fontFamily);
  const autosave = useSettings((state) => state.autosave);
  const autosaveDelay = useSettings((state) => state.autosaveDelay);
  const imageRoot = useSettings((state) => state.imageRoot);
  const setDark = useUi((state) => state.setDark);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const focusMode = useUi((state) => state.focusMode);
  const sourceMode = useUi((state) => state.sourceMode);
  const typewriterMode = useUi((state) => state.typewriterMode);
  const setFindOpen = useUi((state) => state.setFindOpen);
  const setOutline = useUi((state) => state.setOutline);
  const setSelection = useUi((state) => state.setSelection);

  const activeTab = useTabs((state) =>
    state.tabs.find((tab) => tab.id === state.activeId),
  );

  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    void useSettings.getState().load();
  }, []);

  // Development-only demo document, enabled with ?demo=1.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return;
    if (useTabs.getState().tabs.length) return;
    const demo = `# Rypora 演示

这是一段 **粗体**、*斜体*、~~删除线~~ 与 \`行内代码\`。

> 引用：所见即所得。

## 列表

- 无序项目
- 第二项
  1. 有序子项
  2. 另一个

- [ ] 待办事项
- [x] 已完成

## 表格

| 名称 | 说明 |
| --- | --- |
| Milkdown | 编辑器内核 |
| Tauri | 桌面外壳 |

## 代码

\`\`\`rust
fn main() {
    println!("Hello, Rypora");
}
\`\`\`

## 数学

行内公式 $E = mc^2$，以及块级公式：

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## 图表

\`\`\`mermaid
graph TD
  A[开始] --> B[编辑]
  B --> C[导出]
\`\`\`
`;
    const id = useTabs.getState().newTab();
    useTabs.getState().updateContent(id, demo);
  }, []);

  // Theme resolution, including live system changes in auto mode.
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      const dark = isDarkTheme(theme);
      document.documentElement.dataset.theme = resolved;
      // Dark token overrides (syntax highlighting, highlights) follow `dark`
      // rather than the theme name, so Night shares them with Dark.
      document.documentElement.dataset.dark = String(dark);
      setDark(dark);
    };
    apply();
    if (theme !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, setDark]);

  // Keep the native **Open Recent** menu in sync with saved settings.
  useEffect(() => {
    if (!isTauri()) return;
    void setRecentFiles(recentFiles).catch(() => undefined);
  }, [recentFiles]);

  // The View menu is shared by every window, so the focused window owns the
  // check marks. Sync on toggle, and again whenever a window is refocused.
  useEffect(() => {
    if (!isTauri()) return;
    void syncViewChecks({
      source: sourceMode,
      focus: focusMode,
      typewriter: typewriterMode,
    }).catch(() => undefined);
  }, [sourceMode, focusMode, typewriterMode]);

  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        const state = useUi.getState();
        void syncViewChecks({
          source: state.sourceMode,
          focus: state.focusMode,
          typewriter: state.typewriterMode,
        }).catch(() => undefined);
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, []);

  // Root-relative image paths change meaning when the image root changes.
  useEffect(() => {
    reloadImages();
  }, [imageRoot]);

  // Typography custom properties.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--editor-font-size", `${fontSize}px`);
    root.setProperty("--editor-width", `${lineWidth}px`);
    root.setProperty("--editor-font-family", fontFamily);
  }, [fontSize, lineWidth, fontFamily]);

  // Native menu events.
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void onMenuAction(applyMenuAction).then((unlisten) => {
      dispose = unlisten;
    });
    return () => dispose?.();
  }, []);

  // Guard the window close button: ask before dropping unsaved changes.
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault();
        await requestQuit();
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, []);

  // Workspace file watching: refresh tree and flag external changes.
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void onFsChanged((paths) => {
      const workspace = useWorkspace.getState();
      if (workspace.root) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => {
          void workspace.refresh();
        }, 300);
      }

      const tabs = useTabs.getState();
      for (const tab of tabs.tabs) {
        if (!tab.path) continue;
        if (!paths.some((path) => samePath(path, tab.path!))) continue;
        if (tabs.wasRecentlySaved(tab.path)) continue;
        void openFile(tab.path)
          .then((file) => {
            if (file.hash !== tab.hash) {
              useTabs.getState().setExternalChanged(tab.id, true);
            }
          })
          .catch(() => {
            useUi.getState().flash("文件已在磁盘上被删除或移动");
          });
      }
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
      window.clearTimeout(refreshTimer.current);
    };
  }, []);

  // Files opened from Finder, `open -a Rypora file.md`, or the command line.
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const label = getCurrentWindow().label;
    const openPaths = () => {
      void takePendingFiles(label)
        .then((paths) => {
          if (disposed) return;
          for (const path of paths) void useTabs.getState().openPath(path);
        })
        .catch(() => undefined);
    };
    let unlisten: (() => void) | undefined;
    void onOpenFiles(openPaths).then((dispose) => {
      unlisten = dispose;
      // Drain anything that arrived before the listener was ready.
      openPaths();
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // Drag and drop files / folders onto the window.
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        for (const path of event.payload.paths) {
          if (/\.(md|markdown|mdx|txt)$/i.test(path)) {
            void useTabs.getState().openPath(path);
          } else if (!path.includes(".")) {
            void useWorkspace.getState().openFolder(path);
          }
        }
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, []);

  // Window title follows the active tab.
  useEffect(() => {
    if (!isTauri()) return;
    const title = activeTab
      ? `${activeTab.dirty ? "● " : ""}${activeTab.title} — Rypora`
      : "Rypora";
    void getCurrentWindow().setTitle(title).catch(() => undefined);
  }, [activeTab?.title, activeTab?.dirty]);

  // Autosave for files that already live on disk.
  useEffect(() => {
    if (!autosave || !activeTab?.dirty || !activeTab.path) return;
    if (activeTab.externalChanged) return;
    const tabId = activeTab.id;
    const timer = window.setTimeout(() => {
      const current = useTabs
        .getState()
        .tabs.find((tab) => tab.id === tabId);
      if (!current?.dirty || !current.path) return;
      void saveActive({ silent: true });
    }, autosaveDelay);
    return () => window.clearTimeout(timer);
  }, [
    autosave,
    autosaveDelay,
    activeTab?.id,
    activeTab?.content,
    activeTab?.dirty,
    activeTab?.path,
    activeTab?.externalChanged,
  ]);

  // Escape closes transient UI.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const ui = useUi.getState();
        if (ui.findOpen) setFindOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFindOpen]);

  const handleChange = (markdown: string) => {
    const state = useTabs.getState();
    const tab = state.tabs.find((item) => item.id === state.activeId);
    if (!tab || markdown === tab.content) return;
    state.updateContent(tab.id, markdown);
  };

  // The editor reports its canonical Markdown once on mount (trailing
  // paragraph). Adopt that as the baseline unless it really contains edits.
  const handleBaseline = (markdown: string) => {
    const state = useTabs.getState();
    const tab = state.tabs.find((item) => item.id === state.activeId);
    if (!tab) return;
    if (tab.dirty || !isSameMarkdown(tab.savedContent, markdown)) {
      handleChange(markdown);
      return;
    }
    state.setBaseline(tab.id, markdown);
  };

  const handleSelection = (info: SelectionInfo) => {
    setSelection(info);
  };

  const handleOutline = (outline: OutlineItem[]) => {
    setOutline(outline);
  };

  return (
    <div
      className={`app${focusMode ? " focus-mode" : ""}${
        sidebarVisible ? "" : " sidebar-hidden"
      }`}
    >
      <TitleBar />
      <TabBar />
      <div className="main">
        {sidebarVisible && !focusMode && <Sidebar />}
        <div className="editor-area">
          <FindBar />
          {activeTab ? (
            <>
              <ExternalChangeBanner tab={activeTab} />
              <EditorPane
                tab={activeTab}
                onChange={handleChange}
                onBaseline={handleBaseline}
                onSelection={handleSelection}
                onOutline={handleOutline}
              />
            </>
          ) : (
            <Welcome />
          )}
        </div>
      </div>
      <StatusBar />
      <SettingsDialog />
      <PromptDialog />
      <QuickOpen />
      <UnsavedDialog />
    </div>
  );
}
