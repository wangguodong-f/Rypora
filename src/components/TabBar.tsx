import { useTabs } from "../stores/tabs";
import { closeTabWithConfirm, newTab } from "../lib/fileActions";
import { IconClose, IconPlus } from "./Icons";

export function TabBar() {
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activate = useTabs((state) => state.activate);

  if (!tabs.length) return null;

  return (
    <div className="tabbar">
      <div className="tabbar-scroll">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab${tab.id === activeId ? " active" : ""}`}
            onMouseDown={(event) => {
              if (event.button === 0) activate(tab.id);
              if (event.button === 1) {
                event.preventDefault();
                void closeTabWithConfirm(tab.id);
              }
            }}
            title={tab.path ?? tab.title}
          >
            <span className={`tab-dot${tab.dirty ? " visible" : ""}`} />
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              title="关闭 (⌘W)"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                void closeTabWithConfirm(tab.id);
              }}
            >
              <IconClose size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new" title="新建文件 (⌘N)" onClick={() => newTab()}>
        <IconPlus size={15} />
      </button>
    </div>
  );
}
