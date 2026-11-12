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
import { EditorPane, ExternalChangeBanner } from "./editor/EditorPane";
import { runCommand } from "./editor/editorBus";
import { exportHtml, exportPdf } from "./lib/export";
import {
  closeTabWithConfirm,
  insertImageDialog,
  newTab,
  openFileDialog,
  openFolderDialog,
  requestQuit,
  saveActive,
  toggleTheme,
} from "./lib/fileActions";
import {
  isTauri,
  onFsChanged,
  onMenuAction,
  openFile,
} from "./lib/ipc";
import { samePath } from "./lib/paths";
import { resolveTheme, useSettings } from "./stores/settings";
import { useTabs } from "./stores/tabs";
import { useUi, type SidebarTab } from "./stores/ui";
import { useWorkspace } from "./stores/workspace";
import type { OutlineItem, SelectionInfo } from "./lib/types";

const SHORTCUTS = `文件
  ⌘N          新建文件
  ⌘O          打开文件
  ⌘⇧O         打开文件夹
  ⌘S          保存
  ⌘⇧S         另存为
  ⌘W          关闭标签页

编辑
  ⌘Z / ⌘⇧Z    撤销 / 重做
  ⌘F          查找
  ⌘⌥F         查找与替换
  ⌘,          设置

格式
  ⌘B          粗体
  ⌘I          斜体
  ⌘⇧X         删除线
  ⌘E          行内代码
  ⌘K          链接
  ⌘1 … ⌘6     标题 1-6
  ⌘0          正文
  ⌘⇧Q         引用
  ⌘⇧K         代码块
  ⌘T          表格

视图
  ⌘⇧L         切换侧边栏
  ⌘⇧D         切换深色模式
  ⌘⇧F         专注模式
  ⌘⇧T         打字机模式`;

function applyMenuAction(action: string): void {
  const ui = useUi.getState();
  const tabs = useTabs.getState();
  const activeId = tabs.activeId;

  switch (action) {
    case "new-file":
      newTab();
      return;
    case "open-file":
      void openFileDialog();
      return;
    case "open-folder":
      void openFolderDialog();
      return;
    case "save":
      void saveActive();
      return;
    case "save-as":
      void saveActive({ saveAs: true });
      return;
    case "close-tab":
      if (activeId) void closeTabWithConfirm(activeId);
      return;
    case "export-html":
      void exportHtml();
      return;
    case "export-pdf":
      void exportPdf();
      return;
    case "quit":
      void requestQuit();
      return;
    case "undo":
      runCommand("undo");
      return;
    case "redo":
      runCommand("redo");
      return;
    case "bold":
      runCommand("toggleBold");
      return;
    case "italic":
      runCommand("toggleItalic");
      return;
    case "strikethrough":
      runCommand("toggleStrike");
      return;
    case "inline-code":
      runCommand("toggleInlineCode");
      return;
    case "link":
      void ui.prompt("链接地址", "https://").then((href) => {
        if (href) runCommand("toggleLink", href);
      });
      return;
    case "heading-1":
    case "heading-2":
    case "heading-3":
    case "heading-4":
    case "heading-5":
    case "heading-6":
      runCommand("setHeading", Number(action.slice(-1)));
      return;
    case "paragraph":
      runCommand("setParagraph");
      return;
    case "quote":
      runCommand("toggleQuote");
      return;
    case "code-block":
      runCommand("insertCodeBlock");
      return;
    case "bullet-list":
      runCommand("toggleBulletList");
      return;
    case "ordered-list":
      runCommand("toggleOrderedList");
      return;
    case "task-list":
      runCommand("toggleTaskList");
      return;
    case "table":
      runCommand("insertTable");
      return;
    case "horizontal-rule":
      runCommand("insertHr");
      return;
    case "image":
      void insertImageDialog();
      return;
    case "toggle-sidebar":
      ui.toggleSidebar();
      return;
    case "panel-files":
    case "panel-outline":
    case "panel-search":
      ui.setSidebarTab(action.replace("panel-", "") as SidebarTab);
      return;
    case "toggle-theme":
      toggleTheme();
      return;
    case "focus-mode":
      ui.setFocusMode(!ui.focusMode);
      return;
    case "typewriter-mode":
      ui.setTypewriterMode(!ui.typewriterMode);
      return;
    case "find":
    case "replace":
      ui.setFindOpen(true);
      return;
    case "preferences":
      ui.setSettingsOpen(true);
      return;
    case "about":
      void message(
        "Rypora 0.1.0\n\n使用 Tauri、React 与 Milkdown 构建的所见即所得 Markdown 编辑器。",
        { title: "关于 Rypora" },
      );
      return;
    case "shortcuts":
      void message(SHORTCUTS, { title: "键盘快捷键" });
      return;
    default:
      return;
  }
}

export default function App() {
  const theme = useSettings((state) => state.theme);
  const fontSize = useSettings((state) => state.fontSize);
  const lineWidth = useSettings((state) => state.lineWidth);
  const fontFamily = useSettings((state) => state.fontFamily);
  const autosave = useSettings((state) => state.autosave);
  const autosaveDelay = useSettings((state) => state.autosaveDelay);
  const setDark = useUi((state) => state.setDark);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const focusMode = useUi((state) => state.focusMode);
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
      document.documentElement.dataset.theme = resolved;
      setDark(resolved === "dark");
    };
    apply();
    if (theme !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, setDark]);

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
    </div>
  );
}
