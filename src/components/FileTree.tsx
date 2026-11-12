import { useEffect, useRef, useState } from "react";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import {
  createFile,
  createFolder,
  deletePath,
  renamePath,
} from "../lib/ipc";
import { errorMessage } from "../lib/errors";
import { basename, dirname, joinPath, samePath } from "../lib/paths";
import type { FileNode } from "../lib/types";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import {
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconFilePlus,
  IconFolder,
  IconFolderPlus,
  IconRefresh,
} from "./Icons";

const OPENABLE = /\.(md|markdown|mdx|txt)$/i;

interface MenuState {
  x: number;
  y: number;
  node: FileNode | null;
}

function ensureMarkdown(name: string): string {
  if (!name) return name;
  if (/\.[A-Za-z0-9]+$/.test(name)) return name;
  return `${name}.md`;
}

export function FileTree() {
  const root = useWorkspace((state) => state.root);
  const tree = useWorkspace((state) => state.tree);
  const expanded = useWorkspace((state) => state.expanded);
  const loading = useWorkspace((state) => state.loading);
  const toggleExpanded = useWorkspace((state) => state.toggleExpanded);
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

  if (!root) {
    return (
      <div className="panel-empty">
        <p>尚未打开文件夹</p>
        <span>从“文件”菜单选择“打开文件夹”，或直接将文件夹拖入窗口。</span>
      </div>
    );
  }

  const createEntry = async (targetDir: string, isDir: boolean) => {
    const prompt = useUi.getState().prompt;
    const name = await prompt(isDir ? "新建文件夹名称" : "新建文件名称", "");
    if (!name?.trim()) return;
    const finalName = isDir ? name.trim() : ensureMarkdown(name.trim());
    const path = joinPath(targetDir, finalName);
    try {
      if (isDir) {
        await createFolder(path);
      } else {
        await createFile(path);
      }
      await refresh();
      useWorkspace.getState().expand(targetDir);
      if (!isDir) await useTabs.getState().openPath(path);
    } catch (error) {
      await message(errorMessage(error), {
        title: isDir ? "新建文件夹失败" : "新建文件失败",
        kind: "error",
      });
    }
  };

  const renameEntry = async (node: FileNode) => {
    const prompt = useUi.getState().prompt;
    const name = await prompt("重命名", node.name);
    if (!name?.trim() || name.trim() === node.name) return;
    const target = joinPath(dirname(node.path), name.trim());
    try {
      await renamePath(node.path, target);
      useTabs.getState().renamePathInTabs(node.path, target);
      await refresh();
    } catch (error) {
      await message(errorMessage(error), {
        title: "重命名失败",
        kind: "error",
      });
    }
  };

  const removeEntry = async (node: FileNode) => {
    const ok = await confirm(
      `确定要将“${node.name}”移到废纸篓吗？`,
      { title: "删除", kind: "warning" },
    );
    if (!ok) return;
    try {
      await deletePath(node.path);
      useTabs.getState().closeByPath(node.path);
      await refresh();
    } catch (error) {
      await message(errorMessage(error), {
        title: "删除失败",
        kind: "error",
      });
    }
  };

  const renderNode = (node: FileNode, depth: number) => {
    const isOpen = expanded[node.path] ?? false;
    const isActive = !!activePath && samePath(activePath, node.path);
    const openable = node.isDir || OPENABLE.test(node.name);

    return (
      <div key={node.path}>
        <div
          className={`tree-row${isActive ? " active" : ""}${
            openable ? "" : " muted"
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => {
            if (node.isDir) toggleExpanded(node.path);
            else if (openable) void useTabs.getState().openPath(node.path);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, node });
          }}
          title={node.path}
        >
          <span className="tree-caret">
            {node.isDir ? (
              isOpen ? (
                <IconChevronDown size={12} />
              ) : (
                <IconChevronRight size={12} />
              )
            ) : null}
          </span>
          <span className="tree-icon">
            {node.isDir ? (
              <IconFolder size={15} />
            ) : (
              <IconFile size={15} />
            )}
          </span>
          <span className="tree-name">{node.name}</span>
        </div>
        {node.isDir && isOpen && node.children?.length
          ? node.children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  return (
    <div className="file-tree">
      <div className="panel-toolbar">
        <button
          className="icon-button small"
          title="新建文件"
          onClick={() => void createEntry(root, false)}
        >
          <IconFilePlus size={15} />
        </button>
        <button
          className="icon-button small"
          title="新建文件夹"
          onClick={() => void createEntry(root, true)}
        >
          <IconFolderPlus size={15} />
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
      <div className="tree-scroll">
        <div
          className="tree-root"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, node: null });
          }}
        >
          <div
            className="tree-row root-row"
            onClick={() => toggleExpanded(root)}
            title={root}
          >
            <span className="tree-caret">
              {expanded[root] !== false ? (
                <IconChevronDown size={12} />
              ) : (
                <IconChevronRight size={12} />
              )}
            </span>
            <span className="tree-icon">
              <IconFolder size={15} />
            </span>
            <span className="tree-name">{basename(root)}</span>
          </div>
          {tree.map((node) => renderNode(node, 1))}
          {!tree.length && !loading && (
            <div className="tree-empty">文件夹为空</div>
          )}
          {loading && <div className="tree-empty">正在读取…</div>}
        </div>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 200),
          }}
        >
          {menu.node?.isDir !== false && (
            <>
              <button
                onClick={() => {
                  const dir = menu.node?.path ?? root;
                  setMenu(null);
                  void createEntry(dir, false);
                }}
              >
                新建文件
              </button>
              <button
                onClick={() => {
                  const dir = menu.node?.path ?? root;
                  setMenu(null);
                  void createEntry(dir, true);
                }}
              >
                新建文件夹
              </button>
              <div className="context-separator" />
            </>
          )}
          {menu.node && (
            <>
              {!menu.node.isDir && OPENABLE.test(menu.node.name) && (
                <button
                  onClick={() => {
                    const node = menu.node;
                    setMenu(null);
                    if (node) void useTabs.getState().openPath(node.path);
                  }}
                >
                  打开
                </button>
              )}
              <button
                onClick={() => {
                  const node = menu.node;
                  setMenu(null);
                  if (node) void renameEntry(node);
                }}
              >
                重命名
              </button>
              <button
                className="danger"
                onClick={() => {
                  const node = menu.node;
                  setMenu(null);
                  if (node) void removeEntry(node);
                }}
              >
                移到废纸篓
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
