import { useEffect, useMemo, useRef, useState } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { createFile } from "../lib/ipc";
import { revealPath } from "../lib/clipboard";
import { errorMessage } from "../lib/errors";
import {
  ensureMarkdownExtension,
  joinPath,
  OPENABLE_FILE,
  samePath,
} from "../lib/paths";
import type { FileNode } from "../lib/types";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { IconFile, IconFilePlus, IconRefresh } from "./Icons";

/**
 * Typora's "file list": a flat list of the documents that live directly in the
 * open folder. Unlike the file tree it does not show subfolders, which keeps
 * folders of flat notes (a blog, a daily-notes directory) free of nesting.
 */
const collator = new Intl.Collator("zh-Hans", {
  numeric: true,
  sensitivity: "base",
});

interface DocumentEntry {
  node: FileNode;
  /** Path relative to the workspace root, used for sorting and display. */
  relative: string;
}

/**
 * Flatten the workspace tree into every document it contains, including the
 * ones inside subfolders. Paths keep the folder prefix so documents with the
 * same name stay distinguishable.
 */
function collectDocuments(nodes: FileNode[]): DocumentEntry[] {
  const entries: DocumentEntry[] = [];
  const walk = (list: FileNode[], prefix: string) => {
    for (const node of list) {
      const relative = prefix ? `${prefix}/${node.name}` : node.name;
      if (node.isDir) {
        if (node.children) walk(node.children, relative);
      } else if (OPENABLE_FILE.test(node.name)) {
        entries.push({ node, relative });
      }
    }
  };
  walk(nodes, "");
  return entries.sort((left, right) =>
    collator.compare(left.relative, right.relative),
  );
}

interface MenuState {
  x: number;
  y: number;
  node: FileNode;
}

export function ArticleList() {
  const root = useWorkspace((state) => state.root);
  const tree = useWorkspace((state) => state.tree);
  const loading = useWorkspace((state) => state.loading);
  const refresh = useWorkspace((state) => state.refresh);
  const activePath = useTabs(
    (state) => state.tabs.find((tab) => tab.id === state.activeId)?.path ?? null,
  );

  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const documents = useMemo(() => collectDocuments(tree), [tree]);

  // Keep the active document visible when it changes from outside the panel
  // (a tab switch, or **File → Show in File List**).
  useEffect(() => {
    if (!activePath) return;
    const rows = document.querySelectorAll<HTMLElement>(".article-row");
    for (const row of rows) {
      if (row.dataset.path === activePath) {
        row.scrollIntoView({ block: "nearest" });
        return;
      }
    }
  }, [activePath, documents]);

  if (!root) {
    return (
      <div className="panel-empty">
        <p>尚未打开文件夹</p>
        <span>从“文件”菜单选择“打开文件夹”，或直接将文件夹拖入窗口。</span>
      </div>
    );
  }

  const createDocument = async () => {
    const prompt = useUi.getState().prompt;
    const name = await prompt("新建文件名称", "");
    if (!name?.trim()) return;
    const path = joinPath(root, ensureMarkdownExtension(name.trim()));
    try {
      await createFile(path);
      await refresh();
      await useTabs.getState().openPath(path);
    } catch (error) {
      await message(errorMessage(error), {
        title: "新建文件失败",
        kind: "error",
      });
    }
  };

  return (
    <div className="article-list">
      <div className="panel-toolbar">
        <button
          className="icon-button small"
          title="新建文件"
          onClick={() => void createDocument()}
        >
          <IconFilePlus size={15} />
        </button>
        <div className="spacer" />
        <button
          className="icon-button small"
          title="刷新"
          onClick={() => void refresh()}
        >
          <IconRefresh size={15} />
        </button>
      </div>
      <div className="article-scroll">
        {documents.map(({ node, relative }) => {
          const isActive = !!activePath && samePath(activePath, node.path);
          const slash = relative.lastIndexOf("/");
          const dir = slash >= 0 ? relative.slice(0, slash + 1) : "";
          const name = slash >= 0 ? relative.slice(slash + 1) : relative;
          return (
            <div
              key={node.path}
              className={`article-row${isActive ? " active" : ""}`}
              data-path={node.path}
              title={node.path}
              onClick={() => void useTabs.getState().openPath(node.path)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, node });
              }}
            >
              <span className="article-icon">
                <IconFile size={15} />
              </span>
              <span className="article-name">
                {dir && <span className="article-dir">{dir}</span>}
                <span className="article-file">{name}</span>
              </span>
            </div>
          );
        })}
        {!documents.length && !loading && (
          <div className="tree-empty">文件夹中没有可打开的文档</div>
        )}
        {loading && <div className="tree-empty">正在读取…</div>}
      </div>
      <div className="article-note">递归列出所有子文件夹中的文档</div>

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 160),
          }}
        >
          <button
            onClick={() => {
              const node = menu.node;
              setMenu(null);
              void useTabs.getState().openPath(node.path);
            }}
          >
            打开
          </button>
          <button
            onClick={() => {
              const node = menu.node;
              setMenu(null);
              void revealPath(node.path).catch(() =>
                useUi.getState().flash("无法在访达中显示该文件"),
              );
            }}
          >
            在访达中显示
          </button>
        </div>
      )}
    </div>
  );
}
