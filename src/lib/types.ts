export interface FileContent {
  path: string;
  content: string;
  mtime: number;
  size: number;
  hash: string;
}

export interface SaveResult {
  mtime: number;
  size: number;
  hash: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[] | null;
}

export interface SearchHit {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchLen: number;
}

export interface OutlineItem {
  text: string;
  level: number;
  id: string;
  index: number;
}

export interface SelectionInfo {
  line: number;
  column: number;
  empty: boolean;
}

export interface FindResult {
  index: number;
  total: number;
}

export type ThemeMode = "light" | "dark" | "auto";

export interface AppSettings {
  theme: ThemeMode;
  fontSize: number;
  fontFamily: string;
  lineWidth: number;
  autosave: boolean;
  autosaveDelay: number;
  spellcheck: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number;
  recentFiles: string[];
  lastFolder: string | null;
}

export interface Tab {
  id: string;
  path: string | null;
  title: string;
  content: string;
  savedContent: string;
  mtime: number | null;
  hash: string | null;
  dirty: boolean;
  externalChanged: boolean;
  revision: number;
}
