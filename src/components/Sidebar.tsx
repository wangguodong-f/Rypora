import { useUi, type SidebarTab } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { ArticleList } from "./ArticleList";
import { FileTree } from "./FileTree";
import { OutlinePanel } from "./OutlinePanel";
import { SearchPanel } from "./SearchPanel";
import { IconFile, IconFolder, IconList, IconSearch } from "./Icons";

const TABS: {
  id: SidebarTab;
  label: string;
  title: string;
  icon: typeof IconFile;
}[] = [
  { id: "files", label: "文件树", title: "文件树", icon: IconFolder },
  { id: "articles", label: "列表", title: "文件列表", icon: IconFile },
  { id: "outline", label: "大纲", title: "大纲", icon: IconList },
  { id: "search", label: "搜索", title: "搜索", icon: IconSearch },
];

export function Sidebar() {
  const tab = useUi((state) => state.sidebarTab);
  const setTab = useUi((state) => state.setSidebarTab);
  const root = useWorkspace((state) => state.root);
  const closeFolder = useWorkspace((state) => state.closeFolder);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {TABS.map(({ id, label, title, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-tab${tab === id ? " active" : ""}`}
            title={title}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-body">
        {tab === "files" && <FileTree />}
        {tab === "articles" && <ArticleList />}
        {tab === "outline" && <OutlinePanel />}
        {tab === "search" && <SearchPanel />}
      </div>
      {(tab === "files" || tab === "articles") && root && (
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
