import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import { isTauri } from "../lib/ipc";
import type { AppSettings, ThemeMode } from "../lib/types";

export const defaultSettings: AppSettings = {
  theme: "auto",
  fontSize: 16,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  lineWidth: 760,
  autosave: true,
  autosaveDelay: 800,
  spellcheck: true,
  sidebarVisible: true,
  sidebarWidth: 250,
  recentFiles: [],
  lastFolder: null,
};

const STORE_KEY = "settings";
const store = new LazyStore("settings.json");

interface SettingsState extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => void;
  addRecentFile: (path: string) => void;
}

let persistTimer: number | undefined;

function schedulePersist(state: AppSettings) {
  if (!isTauri()) return;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const payload: AppSettings = {
      theme: state.theme,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      lineWidth: state.lineWidth,
      autosave: state.autosave,
      autosaveDelay: state.autosaveDelay,
      spellcheck: state.spellcheck,
      sidebarVisible: state.sidebarVisible,
      sidebarWidth: state.sidebarWidth,
      recentFiles: state.recentFiles,
      lastFolder: state.lastFolder,
    };
    void store
      .set(STORE_KEY, payload)
      .then(() => store.save())
      .catch((error) => console.warn("failed to persist settings", error));
  }, 250);
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  loaded: false,
  load: async () => {
    if (!isTauri()) {
      set({ loaded: true });
      return;
    }
    try {
      const saved = await store.get<Partial<AppSettings>>(STORE_KEY);
      set({ ...defaultSettings, ...(saved ?? {}), loaded: true });
    } catch (error) {
      console.warn("failed to load settings", error);
      set({ loaded: true });
    }
  },
  update: (patch) => {
    set(patch);
    const state = get();
    schedulePersist(state);
  },
  addRecentFile: (path) => {
    const current = get().recentFiles.filter((item) => item !== path);
    get().update({ recentFiles: [path, ...current].slice(0, 24) });
  },
}));

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
