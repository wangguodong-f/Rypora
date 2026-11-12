import { create } from "zustand";
import { readDirTree, unwatchWorkspace, watchWorkspace } from "../lib/ipc";
import { errorMessage } from "../lib/errors";
import { basename } from "../lib/paths";
import type { FileNode } from "../lib/types";
import { useSettings } from "./settings";
import { useUi } from "./ui";

interface WorkspaceState {
  root: string | null;
  tree: FileNode[];
  expanded: Record<string, boolean>;
  loading: boolean;
  openFolder: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  closeFolder: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  expand: (path: string) => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  root: null,
  tree: [],
  expanded: {},
  loading: false,
  openFolder: async (path) => {
    set({ loading: true });
    try {
      const tree = await readDirTree(path);
      set({
        root: path,
        tree,
        expanded: { [path]: true },
        loading: false,
      });
      await watchWorkspace(path);
      useSettings.getState().update({ lastFolder: path });
      useUi.getState().flash(`已打开文件夹 ${basename(path)}`);
    } catch (error) {
      set({ loading: false });
      useUi.getState().flash(`打开文件夹失败：${errorMessage(error)}`);
    }
  },
  refresh: async () => {
    const root = get().root;
    if (!root) return;
    try {
      const tree = await readDirTree(root);
      set({ tree });
    } catch (error) {
      console.warn("refresh tree failed", error);
    }
  },
  closeFolder: async () => {
    await unwatchWorkspace();
    set({ root: null, tree: [], expanded: {} });
  },
  toggleExpanded: (path) => {
    set((state) => ({
      expanded: { ...state.expanded, [path]: !state.expanded[path] },
    }));
  },
  expand: (path) => {
    set((state) => ({ expanded: { ...state.expanded, [path]: true } }));
  },
}));
