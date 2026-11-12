import { create } from "zustand";
import type { OutlineItem, SelectionInfo } from "../lib/types";

export type SidebarTab = "files" | "outline" | "search";

export type UnsavedChoice = "save" | "discard" | "cancel";

interface PromptState {
  title: string;
  value: string;
  resolve: (value: string | null) => void;
}

interface UnsavedState {
  title: string;
  message: string;
  resolve: (choice: UnsavedChoice) => void;
}

interface UiState {
  sidebarVisible: boolean;
  sidebarTab: SidebarTab;
  dark: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  findOpen: boolean;
  settingsOpen: boolean;
  outline: OutlineItem[];
  selection: SelectionInfo;
  status: string | null;
  statusTimer: number | undefined;
  promptState: PromptState | null;
  unsavedState: UnsavedState | null;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setDark: (dark: boolean) => void;
  setFocusMode: (value: boolean) => void;
  setTypewriterMode: (value: boolean) => void;
  setFindOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setSelection: (selection: SelectionInfo) => void;
  flash: (message: string) => void;
  prompt: (title: string, value?: string) => Promise<string | null>;
  resolvePrompt: (value: string | null) => void;
  askUnsaved: (title: string, message: string) => Promise<UnsavedChoice>;
  resolveUnsaved: (choice: UnsavedChoice) => void;
}

export const useUi = create<UiState>((set, get) => ({
  sidebarVisible: true,
  sidebarTab: "files",
  dark: false,
  focusMode: false,
  typewriterMode: false,
  findOpen: false,
  settingsOpen: false,
  outline: [],
  selection: { line: 1, column: 1, empty: true },
  status: null,
  statusTimer: undefined,
  promptState: null,
  unsavedState: null,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  toggleSidebar: () => set({ sidebarVisible: !get().sidebarVisible }),
  setSidebarTab: (tab) => set({ sidebarTab: tab, sidebarVisible: true }),
  setDark: (dark) => set({ dark }),
  setFocusMode: (value) => set({ focusMode: value }),
  setTypewriterMode: (value) => set({ typewriterMode: value }),
  setFindOpen: (value) => set({ findOpen: value }),
  setSettingsOpen: (value) => set({ settingsOpen: value }),
  setOutline: (outline) => set({ outline }),
  setSelection: (selection) => set({ selection }),
  flash: (message) => {
    const previous = get().statusTimer;
    if (previous) window.clearTimeout(previous);
    const timer = window.setTimeout(() => set({ status: null }), 2200);
    set({ status: message, statusTimer: timer });
  },
  prompt: (title, value = "") =>
    new Promise<string | null>((resolve) => {
      set({ promptState: { title, value, resolve } });
    }),
  resolvePrompt: (value) => {
    const current = get().promptState;
    if (!current) return;
    set({ promptState: null });
    current.resolve(value);
  },
  askUnsaved: (title, message) =>
    new Promise<UnsavedChoice>((resolve) => {
      set({ unsavedState: { title, message, resolve } });
    }),
  resolveUnsaved: (choice) => {
    const current = get().unsavedState;
    if (!current) return;
    set({ unsavedState: null });
    current.resolve(choice);
  },
}));
