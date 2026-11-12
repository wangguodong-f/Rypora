import { useMemo, useState } from "react";
import { searchWorkspace } from "../lib/ipc";
import { errorMessage } from "../lib/errors";
import { basename, relativePath } from "../lib/paths";
import type { SearchHit } from "../lib/types";
import { runCommand } from "../editor/editorBus";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { IconSearch } from "./Icons";

interface GroupedHits {
  path: string;
  name: string;
  hits: SearchHit[];
}

export function SearchPanel() {
  const root = useWorkspace((state) => state.root);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [ranQuery, setRanQuery] = useState("");

  const grouped = useMemo<GroupedHits[]>(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.path) ?? [];
      list.push(hit);
      map.set(hit.path, list);
    }
    return Array.from(map.entries()).map(([path, list]) => ({
      path,
      name: basename(path),
      hits: list,
    }));
  }, [hits]);

  const runSearch = async () => {
    if (!root || !query.trim()) return;
    setBusy(true);
    try {
      const result = await searchWorkspace(root, query, caseSensitive, 300);
      setHits(result);
      setRanQuery(query);
    } catch (error) {
      useUi.getState().flash(`搜索失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const openHit = async (hit: SearchHit) => {
    await useTabs.getState().openPath(hit.path);
    window.setTimeout(() => {
      runCommand("focusLine", hit.line);
    }, 80);
  };

  if (!root) {
    return (
      <div className="panel-empty">
        <p>请先打开文件夹</p>
        <span>搜索会在当前文件夹中查找匹配内容。</span>
      </div>
    );
  }

  return (
    <div className="search-panel">
      <div className="search-box">
        <IconSearch size={14} />
        <input
          value={query}
          placeholder="在文件夹中搜索…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void runSearch();
          }}
        />
        <button
          className={`case-toggle${caseSensitive ? " active" : ""}`}
          title="区分大小写"
          onClick={() => setCaseSensitive((value) => !value)}
        >
          Aa
        </button>
      </div>
      <div className="search-meta">
        {busy ? (
          <span>正在搜索…</span>
        ) : ranQuery ? (
          <span>
            “{ranQuery}” 找到 {hits.length} 个结果
          </span>
        ) : (
          <span>按 Enter 开始搜索</span>
        )}
      </div>
      <div className="search-results">
        {grouped.map((group) => (
          <div key={group.path} className="search-group">
            <div className="search-group-title" title={group.path}>
              <span>{group.name}</span>
              <span className="search-group-path">
                {relativePath(root, group.path)}
              </span>
            </div>
            {group.hits.map((hit, index) => (
              <button
                key={`${hit.line}-${hit.column}-${index}`}
                className="search-hit"
                onClick={() => void openHit(hit)}
              >
                <span className="search-hit-line">{hit.line}</span>
                <span className="search-hit-preview">{hit.preview}</span>
              </button>
            ))}
          </div>
        ))}
        {!busy && ranQuery && !hits.length && (
          <div className="panel-empty compact">
            <p>没有匹配结果</p>
          </div>
        )}
      </div>
    </div>
  );
}
