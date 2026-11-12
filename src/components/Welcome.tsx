import { basename, dirname } from "../lib/paths";
import {
  newTab,
  openFileDialog,
  openFolderDialog,
} from "../lib/fileActions";
import { useSettings } from "../stores/settings";
import { useTabs } from "../stores/tabs";
import { IconFile, IconFolder, IconLogo, IconPlus } from "./Icons";

export function Welcome() {
  const recent = useSettings((state) => state.recentFiles);
  const openPath = useTabs((state) => state.openPath);

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-brand">
          <IconLogo size={68} />
          <div>
            <h1>Rypora</h1>
            <p>专注写作的所见即所得 Markdown 编辑器</p>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-card" onClick={() => newTab()}>
            <IconPlus size={20} />
            <span>新建文件</span>
            <kbd>⌘N</kbd>
          </button>
          <button
            className="welcome-card"
            onClick={() => void openFileDialog()}
          >
            <IconFile size={20} />
            <span>打开文件</span>
            <kbd>⌘O</kbd>
          </button>
          <button
            className="welcome-card"
            onClick={() => void openFolderDialog()}
          >
            <IconFolder size={20} />
            <span>打开文件夹</span>
            <kbd>⌘⇧O</kbd>
          </button>
        </div>

        {recent.length > 0 && (
          <div className="welcome-recent">
            <h2>最近打开</h2>
            <ul>
              {recent.slice(0, 8).map((path) => (
                <li key={path}>
                  <button onClick={() => void openPath(path)} title={path}>
                    <span className="recent-name">{basename(path)}</span>
                    <span className="recent-dir">{dirname(path)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="welcome-tips">
          <span>提示：输入 # 创建标题，``` 创建代码块，$公式$ 插入数学公式。</span>
        </div>
      </div>
    </div>
  );
}
