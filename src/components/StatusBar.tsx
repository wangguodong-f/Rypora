import { useMemo } from "react";
import { countChars, countWords } from "../lib/wordcount";
import { useSettings } from "../stores/settings";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

export function StatusBar() {
  const tab = useTabs((state) =>
    state.tabs.find((item) => item.id === state.activeId),
  );
  const selection = useUi((state) => state.selection);
  const status = useUi((state) => state.status);
  const autosave = useSettings((state) => state.autosave);

  const stats = useMemo(() => {
    const content = tab?.content ?? "";
    return {
      words: countWords(content),
      chars: countChars(content),
    };
  }, [tab?.content]);

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        {status ? (
          <span className="status-flash">{status}</span>
        ) : (
          <span className="status-state">
            {tab
              ? tab.dirty
                ? "未保存"
                : "已保存"
              : "就绪"}
          </span>
        )}
      </div>
      <div className="statusbar-right">
        {autosave && tab && <span className="status-hint">自动保存已开启</span>}
        <span>
          行 {selection.line}，列 {selection.column}
        </span>
        <span>{stats.words} 字</span>
        <span>{stats.chars} 字符</span>
      </div>
    </footer>
  );
}
