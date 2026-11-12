import { create } from "zustand";
import { openFile } from "../lib/ipc";
import { basename, samePath, stripMarkdownExtension } from "../lib/paths";
import { useSettings } from "./settings";
import { useUi } from "./ui";
import type { FileContent, SaveResult, Tab } from "../lib/types";

let counter = 0;
let untitledCounter = 0;

const recentSaves = new Map<string, number>();

function uid(): string {
  counter += 1;
  return `tab-${counter}`;
}

function makeUntitled(): Tab {
  untitledCounter += 1;
  return {
    id: uid(),
    path: null,
    title: `未命名-${untitledCounter}.md`,
    content: "",
    savedContent: "",
    mtime: null,
    hash: null,
    dirty: false,
    externalChanged: false,
    revision: 0,
  };
}

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  openPath: (path: string) => Promise<void>;
  openContent: (file: FileContent) => void;
  newTab: () => string;
  activate: (id: string) => void;
  close: (id: string) => void;
  closeOthers: (id: string) => void;
  closeByPath: (path: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, result: SaveResult, savedContent?: string) => void;
  setPath: (id: string, path: string) => void;
  applyDiskContent: (id: string, file: FileContent) => void;
  setExternalChanged: (id: string, value: boolean) => void;
  renamePathInTabs: (from: string, to: string) => void;
  getActive: () => Tab | undefined;
  wasRecentlySaved: (path: string) => boolean;
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  openPath: async (path) => {
    const existing = get().tabs.find(
      (tab) => tab.path && samePath(tab.path, path),
    );
    if (existing) {
      set({ activeId: existing.id });
      return;
    }
    try {
      const file = await openFile(path);
      get().openContent(file);
      useSettings.getState().addRecentFile(path);
    } catch (error) {
      useUi.getState().flash(`打开文件失败：${String(error)}`);
    }
  },
  openContent: (file) => {
    const existing = get().tabs.find(
      (tab) => tab.path && samePath(tab.path, file.path),
    );
    if (existing) {
      set({ activeId: existing.id });
      return;
    }
    const tab: Tab = {
      id: uid(),
      path: file.path,
      title: basename(file.path),
      content: file.content,
      savedContent: file.content,
      mtime: file.mtime,
      hash: file.hash,
      dirty: false,
      externalChanged: false,
      revision: 0,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
  },
  newTab: () => {
    const tab = makeUntitled();
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    return tab.id;
  },
  activate: (id) => set({ activeId: id }),
  close: (id) => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return;
    const next = tabs.filter((tab) => tab.id !== id);
    let nextActive = activeId;
    if (activeId === id) {
      nextActive = next[Math.min(index, next.length - 1)]?.id ?? null;
    }
    set({ tabs: next, activeId: nextActive });
  },
  closeOthers: (id) => {
    set((state) => ({
      tabs: state.tabs.filter((tab) => tab.id === id),
      activeId: id,
    }));
  },
  closeByPath: (path) => {
    const tab = get().tabs.find((item) => item.path && samePath(item.path, path));
    if (tab) get().close(tab.id);
  },
  updateContent: (id, content) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              content,
              dirty: content !== tab.savedContent,
              title:
                tab.path === null
                  ? tab.title
                  : tab.title || stripMarkdownExtension(basename(tab.path)),
            }
          : tab,
      ),
    }));
  },
  markSaved: (id, result, savedContent) => {
    const tab = get().tabs.find((item) => item.id === id);
    if (tab?.path) recentSaves.set(tab.path, Date.now());
    set((state) => ({
      tabs: state.tabs.map((item) =>
        item.id === id
          ? {
              ...item,
              savedContent: savedContent ?? item.content,
              dirty:
                savedContent != null ? item.content !== savedContent : false,
              externalChanged: false,
              mtime: result.mtime,
              hash: result.hash,
            }
          : item,
      ),
    }));
  },
  setPath: (id, path) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? { ...tab, path, title: basename(path) }
          : tab,
      ),
    }));
    useSettings.getState().addRecentFile(path);
  },
  applyDiskContent: (id, file) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              content: file.content,
              savedContent: file.content,
              dirty: false,
              externalChanged: false,
              mtime: file.mtime,
              hash: file.hash,
              revision: tab.revision + 1,
            }
          : tab,
      ),
    }));
  },
  setExternalChanged: (id, value) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, externalChanged: value } : tab,
      ),
    }));
  },
  renamePathInTabs: (from, to) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path && samePath(tab.path, from)
          ? { ...tab, path: to, title: basename(to) }
          : tab,
      ),
    }));
  },
  getActive: () => {
    const { tabs, activeId } = get();
    return tabs.find((tab) => tab.id === activeId);
  },
  wasRecentlySaved: (path) => {
    const at = recentSaves.get(path);
    return at !== undefined && Date.now() - at < 2000;
  },
}));
