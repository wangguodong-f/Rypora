import { useUi } from "../stores/ui";
import { useTabs } from "../stores/tabs";
import { toggleTheme } from "../lib/fileActions";
import {
  IconFocus,
  IconMoon,
  IconSettings,
  IconSidebar,
  IconSun,
} from "./Icons";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function TitleBar() {
  const dark = useUi((state) => state.dark);
  const focusMode = useUi((state) => state.focusMode);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const toggleSidebar = useUi((state) => state.toggleSidebar);
  const setFocusMode = useUi((state) => state.setFocusMode);
  const setSettingsOpen = useUi((state) => state.setSettingsOpen);
  const tab = useTabs((state) =>
    state.tabs.find((item) => item.id === state.activeId),
  );

  const title = tab ? tab.title : "Rypora";
  const dirty = tab?.dirty ?? false;

  return (
    <header className={`titlebar${isMac ? " mac" : ""}`} data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <div className="titlebar-title" data-tauri-drag-region>
          <span className="titlebar-doc" data-tauri-drag-region>
            {title}
          </span>
          {dirty && <span className="titlebar-dot" title="未保存" />}
        </div>
      </div>
      <div className="titlebar-actions">
        <button
          className={`icon-button${sidebarVisible ? " active" : ""}`}
          title="切换侧边栏 (⌘⇧L)"
          onClick={toggleSidebar}
        >
          <IconSidebar size={16} />
        </button>
        <button
          className={`icon-button${focusMode ? " active" : ""}`}
          title="专注模式 (⌘⇧F)"
          onClick={() => setFocusMode(!focusMode)}
        >
          <IconFocus size={16} />
        </button>
        <button
          className="icon-button"
          title="切换深色模式 (⌘⇧D)"
          onClick={toggleTheme}
        >
          {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button
          className="icon-button"
          title="设置 (⌘,)"
          onClick={() => setSettingsOpen(true)}
        >
          <IconSettings size={16} />
        </button>
      </div>
    </header>
  );
}
