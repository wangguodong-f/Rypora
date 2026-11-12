import { useUi, type SidebarTab } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { FileTree } from "./FileTree";
import { OutlinePanel } from "./OutlinePanel";
import { SearchPanel } from "./SearchPanel";
import { IconFile, IconList, IconSearch } from "./Icons";

const TABS: { id: SidebarTab; label: string; icon: typeof IconFile }[] = [
  { id: "files", label: "文件", icon: IconFile },
  { id: "outline", label: "大纲", icon: IconList },
  { id: "search", label: "搜索", icon: IconSearch },
];

export function Sidebar() {
  const tab = useUi((state) => state.sidebarTab);
  const setTab = useUi((state) => state.setSidebarTab);
  const root = useWorkspace((state) => state.root);
  const closeFolder = useWorkspace((state) => state.closeFolder);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-body">
        {tab === "files" && <FileTree />}
        {tab === "outline" && <OutlinePanel />}
        {tab === "search" && <SearchPanel />}
      </div>
      {tab === "files" && root && (
        <div className="sidebar-footer" title={root}>
          <span className="sidebar-footer-path">{root}</span>
          <button
            className="link-button"
            onClick={() => void closeFolder()}
            title="关闭文件夹"
          >
            关闭
          </button>
        </div>
      )}
    </aside>
  );
}
