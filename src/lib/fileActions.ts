import { confirm, message, open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  importImage,
  openFile,
  saveFile,
  saveImage,
} from "./ipc";
import { errorMessage, isConflict } from "./errors";
import { basename, dirname, joinPath } from "./paths";
import { useSettings, resolveTheme } from "../stores/settings";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { runCommand } from "../editor/editorBus";

const MARKDOWN_FILTER = {
  name: "Markdown",
  extensions: ["md", "markdown", "mdx", "txt"],
};

export async function openFileDialog(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [MARKDOWN_FILTER, { name: "All Files", extensions: ["*"] }],
  });
  if (typeof selected === "string") {
    await useTabs.getState().openPath(selected);
  }
}

export async function openFolderDialog(): Promise<void> {
  const selected = await open({ multiple: false, directory: true });
  if (typeof selected === "string") {
    await useWorkspace.getState().openFolder(selected);
  }
}

export function newTab(): void {
  useTabs.getState().newTab();
}

export async function saveTab(
  tabId: string,
  options: { saveAs?: boolean; silent?: boolean } = {},
): Promise<boolean> {
  const tabs = useTabs.getState();
  const tab = tabs.tabs.find((item) => item.id === tabId);
  if (!tab) return false;

  let path = tab.path;
  if (!path || options.saveAs) {
    const root = useWorkspace.getState().root;
    const defaultPath = path ?? (root ? joinPath(root, tab.title) : tab.title);
    const selected = await save({
      defaultPath,
      filters: [MARKDOWN_FILTER],
    });
    if (!selected) return false;
    path = selected;
  }

  const isNewPath = path !== tab.path;
  const snapshot = tab.content;

  try {
    const result = await saveFile(
      path,
      snapshot,
      isNewPath ? null : tab.mtime,
      isNewPath ? null : tab.hash,
    );
    if (isNewPath) useTabs.getState().setPath(tabId, path);
    useTabs.getState().markSaved(tabId, result, snapshot);
    if (!options.silent) useUi.getState().flash(`已保存 ${basename(path)}`);
    if (useWorkspace.getState().root) void useWorkspace.getState().refresh();
    return true;
  } catch (error) {
    if (isConflict(error)) {
      if (options.silent) {
        useTabs.getState().setExternalChanged(tabId, true);
        useUi.getState().flash("自动保存暂停：文件已在磁盘上被修改");
        return false;
      }
      const overwrite = await confirm(
        `“${basename(path)}”已在磁盘上被修改。是否用当前内容覆盖？`,
        { title: "保存冲突", kind: "warning" },
      );
      if (!overwrite) {
        useTabs.getState().setExternalChanged(tabId, true);
        return false;
      }
      try {
        const result = await saveFile(path, snapshot, null, null);
        if (isNewPath) useTabs.getState().setPath(tabId, path);
        useTabs.getState().markSaved(tabId, result, snapshot);
        useUi.getState().flash(`已覆盖保存 ${basename(path)}`);
        return true;
      } catch (overwriteError) {
        await message(errorMessage(overwriteError), {
          title: "保存失败",
          kind: "error",
        });
        return false;
      }
    }

    await message(errorMessage(error), {
      title: "保存失败",
      kind: "error",
    });
    return false;
  }
}

export async function saveActive(
  options: { saveAs?: boolean; silent?: boolean } = {},
): Promise<boolean> {
  const activeId = useTabs.getState().activeId;
  if (!activeId) return false;
  return saveTab(activeId, options);
}

export async function saveAll(silent = false): Promise<boolean> {
  const tabs = useTabs.getState().tabs;
  for (const tab of tabs) {
    if (!tab.dirty) continue;
    const ok = await saveTab(tab.id, { silent });
    if (!ok) return false;
  }
  return true;
}

export async function closeTabWithConfirm(tabId: string): Promise<boolean> {
  const tab = useTabs.getState().tabs.find((item) => item.id === tabId);
  if (!tab) return true;
  if (tab.dirty) {
    const choice = await useUi
      .getState()
      .askUnsaved("关闭标签页", `“${tab.title}”有未保存的更改。`);
    if (choice === "cancel") return false;
    if (choice === "save") {
      const saved = await saveTab(tabId);
      if (!saved) return false;
    }
  }
  useTabs.getState().close(tabId);
  return true;
}

export async function requestQuit(): Promise<void> {
  const dirty = useTabs.getState().tabs.filter((tab) => tab.dirty);
  if (dirty.length) {
    const message =
      dirty.length === 1
        ? `“${dirty[0].title}”有未保存的更改。`
        : `有 ${dirty.length} 个文件包含未保存的更改。`;
    const choice = await useUi.getState().askUnsaved("退出 Rypora", message);
    if (choice === "cancel") return;
    if (choice === "save") {
      const saved = await saveAll(true);
      if (!saved) return;
    }
  }
  await getCurrentWindow().destroy();
}

export async function insertImageDialog(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
      },
    ],
  });
  if (typeof selected !== "string") return;
  const tab = useTabs.getState().getActive();
  try {
    const relative = await importImage(
      tab?.path ?? null,
      useWorkspace.getState().root,
      selected,
    );
    runCommand("insertImage", relative, basename(selected));
    useUi.getState().flash("图片已插入");
  } catch (error) {
    await message(errorMessage(error), {
      title: "插入图片失败",
      kind: "error",
    });
  }
}

export async function insertImageBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<void> {
  const tab = useTabs.getState().getActive();
  const docDir = tab?.path
    ? dirname(tab.path)
    : useWorkspace.getState().root;
  if (!docDir) {
    await message("请先打开文件夹或保存文档，再插入图片。", {
      title: "插入图片",
      kind: "warning",
    });
    return;
  }
  try {
    const relative = await saveImage(
      docDir,
      fileName,
      Array.from(bytes),
    );
    runCommand("insertImage", relative, fileName);
    useUi.getState().flash("图片已插入");
  } catch (error) {
    await message(errorMessage(error), {
      title: "插入图片失败",
      kind: "error",
    });
  }
}

export function toggleTheme(): void {
  const settings = useSettings.getState();
  const next =
    resolveTheme(settings.theme) === "dark" ? "light" : "dark";
  settings.update({ theme: next });
}

export async function reloadTab(tabId: string): Promise<void> {
  const tab = useTabs.getState().tabs.find((item) => item.id === tabId);
  if (!tab?.path) return;
  try {
    const file = await openFile(tab.path);
    useTabs.getState().applyDiskContent(tabId, file);
    useUi.getState().flash("已重新加载");
  } catch (error) {
    useUi.getState().flash(`重新加载失败：${errorMessage(error)}`);
  }
}
