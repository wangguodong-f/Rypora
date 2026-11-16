import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyMatch } from "../lib/fuzzy";
import { basename, dirname, relativePath } from "../lib/paths";
import { useSettings } from "../stores/settings";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import type { FileNode } from "../lib/types";
import { IconClose, IconFile } from "./Icons";

interface Entry {
  path: string;
  name: string;
  detail: string;
  /** Text the fuzzy query runs against; includes the file name. */
  search: string;
}

function flatten(nodes: FileNode[], out: Entry[], root: string): void {
  for (const node of nodes) {
    if (node.isDir) {
      if (node.children) flatten(node.children, out, root);
      continue;
    }
    const detail = relativePath(root, node.path);
    out.push({
      path: node.path,
      name: node.name,
      detail,
      search: detail,
    });
  }
}

export function QuickOpen() {
  const open = useUi((state) => state.quickOpen);
  const setOpen = useUi((state) => state.setQuickOpen);
  const root = useWorkspace((state) => state.root);
  const tree = useWorkspace((state) => state.tree);
  const recent = useSettings((state) => state.recentFiles);
  const tabs = useTabs((state) => state.tabs);
  const openPath = useTabs((state) => state.openPath);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  const entries = useMemo(() => {
    if (!open) return [];
    const seen = new Set<string>();
    const list: Entry[] = [];
    const push = (entry: Entry) => {
      if (seen.has(entry.path)) return;
      seen.add(entry.path);
      list.push(entry);
    };

    // Open tabs first: jumping to what is already open is common.
    for (const tab of tabs) {
      if (!tab.path) continue;
      push({
        path: tab.path,
        name: tab.title,
        detail: dirname(tab.path),
        search: tab.path,
      });
    }
    for (const path of recent) {
      push({
        path,
        name: basename(path),
        detail: dirname(path),
        search: path,
      });
    }
    if (root) {
      const files: Entry[] = [];
      flatten(tree, files, root);
      files.sort((a, b) => a.path.localeCompare(b.path));
      for (const file of files) push(file);
    }
    return list;
  }, [open, root, tree, recent, tabs]);

  const results = useMemo(() => {
    const scored = entries
      .map((entry) => {
        const match = fuzzyMatch(query, entry.search);
        if (!match) return null;
        // A hit in the file name should outrank one buried in the directory.
        const nameMatch = query ? fuzzyMatch(query, entry.name) : null;
        const score = match.score + (nameMatch ? 30 + nameMatch.score : 0);
        return { entry, score };
      })
      .filter((item): item is { entry: Entry; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 60).map((item) => item.entry);
  }, [entries, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const choose = (index: number) => {
    const entry = results[index];
    if (!entry) return;
    setOpen(false);
    void openPath(entry.path);
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <div
        className="quick-open"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="quick-open-input">
          <input
            ref={inputRef}
            value={query}
            placeholder="输入文件名或路径，回车打开"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) =>
                  results.length ? (current + 1) % results.length : 0,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) =>
                  results.length
                    ? (current - 1 + results.length) % results.length
                    : 0,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(active);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <button
            className="icon-button small"
            title="关闭"
            onClick={() => setOpen(false)}
          >
            <IconClose size={14} />
          </button>
        </div>

        <ul className="quick-open-list">
          {results.map((entry, index) => (
            <li key={entry.path}>
              <button
                className={index === active ? "active" : ""}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                title={entry.path}
              >
                <IconFile size={14} />
                <span className="quick-open-name">{entry.name}</span>
                <span className="quick-open-path">{entry.detail}</span>
              </button>
            </li>
          ))}
          {!results.length && (
            <li className="quick-open-empty">
              {entries.length
                ? "没有匹配的文件"
                : "先打开文件夹或文件，再使用快速打开"}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
