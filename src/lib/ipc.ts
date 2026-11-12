import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  FileContent,
  FileNode,
  SaveResult,
  SearchHit,
} from "./types";

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function openFile(path: string): Promise<FileContent> {
  return invoke<FileContent>("open_file", { path });
}

export function saveFile(
  path: string,
  content: string,
  expectedMtime: number | null,
  expectedHash: string | null,
): Promise<SaveResult> {
  return invoke<SaveResult>("save_file", {
    path,
    content,
    expectedMtime,
    expectedHash,
  });
}

export function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>("write_text_file", { path, content });
}

export function readDirTree(root: string, maxDepth = 12): Promise<FileNode[]> {
  return invoke<FileNode[]>("read_dir_tree", { root, maxDepth });
}

export function createFile(path: string): Promise<FileContent> {
  return invoke<FileContent>("create_file", { path });
}

export function createFolder(path: string): Promise<void> {
  return invoke<void>("create_folder", { path });
}

export function renamePath(from: string, to: string): Promise<void> {
  return invoke<void>("rename_path", { from, to });
}

export function deletePath(path: string): Promise<void> {
  return invoke<void>("delete_path", { path });
}

export function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

export function saveImage(
  docDir: string,
  fileName: string,
  bytes: number[],
): Promise<string> {
  return invoke<string>("save_image", { docDir, fileName, bytes });
}

export function importImage(
  docPath: string | null,
  root: string | null,
  sourcePath: string,
): Promise<string> {
  return invoke<string>("import_image", { docPath, root, sourcePath });
}

export function searchWorkspace(
  root: string,
  query: string,
  caseSensitive: boolean,
  maxResults = 200,
): Promise<SearchHit[]> {
  return invoke<SearchHit[]>("search_workspace", {
    root,
    query,
    caseSensitive,
    maxResults,
  });
}

export function watchWorkspace(root: string): Promise<void> {
  return invoke<void>("watch_workspace", { root });
}

export function unwatchWorkspace(): Promise<void> {
  return invoke<void>("unwatch_workspace");
}

export function onMenuAction(
  handler: (action: string) => void,
): Promise<UnlistenFn> {
  return listen<string>("menu://action", (event) => handler(event.payload));
}

export function onFsChanged(
  handler: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>("fs://changed", (event) => handler(event.payload));
}
