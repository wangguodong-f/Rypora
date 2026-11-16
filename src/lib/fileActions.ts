import { confirm, message, open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  copyImage,
  deleteFile,
  deletePath,
  importImage,
  moveImage,
  newWindow as newWindowIpc,
  openFile,
  pathExists,
  readTextFile,
  saveFile,
  saveImage,
} from "./ipc";
import { errorMessage, isConflict } from "./errors";
import { basename, dirname, joinPath, relativize } from "./paths";
import { convertImport, importTarget, IMPORT_FILTERS } from "./import";
import { useSettings, resolveTheme } from "../stores/settings";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { runCommand } from "../editor/editorBus";
import { reloadAllImages } from "../editor/images";

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

export async function newWindow(path?: string | null): Promise<void> {
  try {
    await newWindowIpc(path ?? null);
  } catch (error) {
    useUi.getState().flash(`新建窗口失败：${errorMessage(error)}`);
  }
}

/** **File → Import**: convert the chosen file and save it as Markdown beside it. */
export async function importFile(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: IMPORT_FILTERS,
  });
  if (typeof selected !== "string") return;

  try {
    const raw = await readTextFile(selected);
    const markdown = convertImport(selected, raw);
    let target = importTarget(selected);
    const dot = target.lastIndexOf(".");
    const stem = dot > 0 ? target.slice(0, dot) : target;
    let index = 1;
    while (await pathExists(target)) {
      target = `${stem}-${index}.md`;
      index += 1;
    }

    const result = await saveFile(target, markdown, null, null);
    useTabs.getState().openContent({
      path: target,
      content: markdown,
      mtime: result.mtime,
      size: result.size,
      hash: result.hash,
    });
    if (useWorkspace.getState().root) void useWorkspace.getState().refresh();
    useUi.getState().flash(`已导入 ${basename(target)}`);
  } catch (error) {
    await message(errorMessage(error), { title: "导入失败", kind: "error" });
  }
}

/** **File → Delete**: move the active document to the system trash. */
export async function deleteActiveFile(): Promise<void> {
  const tab = useTabs.getState().getActive();
  if (!tab?.path) {
    useUi.getState().flash("该文件尚未保存到磁盘");
    return;
  }
  const ok = await confirm(`将“${tab.title}”移到废纸篓？`, {
    title: "删除文件",
    kind: "warning",
  });
  if (!ok) return;
  try {
    await deletePath(tab.path);
    useTabs.getState().close(tab.id);
    if (useWorkspace.getState().root) void useWorkspace.getState().refresh();
    useUi.getState().flash(`已删除 ${tab.title}`);
  } catch (error) {
    await message(errorMessage(error), { title: "删除失败", kind: "error" });
  }
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
  settings.update({ theme: resolveTheme(settings.theme) === "dark" ? "light" : "dark" });
}

/** Absolute file-system path for an image reference in the active document. */
export function absoluteImagePath(
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(src)) return null;

  let raw = src;
  if (/^file:\/\//i.test(raw)) {
    try {
      raw = decodeURIComponent(raw.replace(/^file:\/\//i, ""));
    } catch {
      return null;
    }
  }

  const imageRoot = useSettings.getState().imageRoot;
  if (raw.startsWith("/") && imageRoot) {
    return joinPath(imageRoot, raw.replace(/^\/+/, ""));
  }
  if (raw.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(raw)) return raw;

  const tab = useTabs.getState().getActive();
  if (!tab?.path) return null;
  return joinPath(dirname(tab.path), raw);
}

function documentDir(): string | null {
  const tab = useTabs.getState().getActive();
  return tab?.path ? dirname(tab.path) : null;
}

function referenceFor(target: string): string {
  const dir = documentDir();
  return dir ? relativize(dir, target) : target;
}

async function uniqueTarget(dir: string, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = joinPath(dir, name);
  let index = 1;
  while (await pathExists(candidate)) {
    candidate = joinPath(dir, `${stem}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

export async function copyActiveImage(): Promise<void> {
  const src = runCommand("imageSource");
  const absolute = absoluteImagePath(src);
  if (!absolute) {
    useUi.getState().flash("光标不在本地图片上");
    return;
  }
  const selected = await save({
    defaultPath: absolute,
    title: "复制图片到…",
  });
  if (typeof selected !== "string" || selected === absolute) return;
  try {
    await copyImage(absolute, selected);
    runCommand("updateImageSource", src ?? "", referenceFor(selected));
    useUi.getState().flash(`图片已复制到 ${basename(selected)}`);
  } catch (error) {
    await message(errorMessage(error), { title: "复制图片失败", kind: "error" });
  }
}

export async function moveActiveImage(): Promise<void> {
  const src = runCommand("imageSource");
  const absolute = absoluteImagePath(src);
  if (!absolute) {
    useUi.getState().flash("光标不在本地图片上");
    return;
  }
  const selected = await save({
    defaultPath: absolute,
    title: "重命名或移动图片到…",
  });
  if (typeof selected !== "string" || selected === absolute) return;
  try {
    await moveImage(absolute, selected);
    runCommand("updateImageSource", src ?? "", referenceFor(selected));
    useUi.getState().flash(`图片已移动到 ${basename(selected)}`);
  } catch (error) {
    await message(errorMessage(error), { title: "移动图片失败", kind: "error" });
  }
}

export async function deleteActiveImageFile(): Promise<void> {
  const src = runCommand("imageSource");
  const absolute = absoluteImagePath(src);
  if (!absolute) {
    useUi.getState().flash("光标不在本地图片上");
    return;
  }
  const ok = await confirm(`删除图片文件“${basename(absolute)}”？`, {
    title: "删除图片文件",
    kind: "warning",
  });
  if (!ok) return;
  try {
    await deleteFile(absolute);
    useUi.getState().flash("图片文件已删除");
  } catch (error) {
    await message(errorMessage(error), {
      title: "删除图片失败",
      kind: "error",
    });
  }
}

async function relocateAllImages(mode: "copy" | "move"): Promise<void> {
  const sources = runCommand("imageSources") ?? [];
  if (!sources.length) {
    useUi.getState().flash("文档中没有本地图片");
    return;
  }
  const dir = await open({ multiple: false, directory: true, title: "选择目标文件夹" });
  if (typeof dir !== "string") return;

  let done = 0;
  for (const src of sources) {
    const absolute = absoluteImagePath(src);
    if (!absolute) continue;
    try {
      const target = await uniqueTarget(dir, basename(absolute));
      if (mode === "copy") await copyImage(absolute, target);
      else await moveImage(absolute, target);
      runCommand("updateImageSource", src, referenceFor(target));
      done += 1;
    } catch (error) {
      await message(errorMessage(error), {
        title: mode === "copy" ? "复制图片失败" : "移动图片失败",
        kind: "error",
      });
      return;
    }
  }
  useUi.getState().flash(
    `${mode === "copy" ? "已复制" : "已移动"} ${done} 张图片到 ${basename(dir)}`,
  );
}

export function copyAllImages(): Promise<void> {
  return relocateAllImages("copy");
}

export function moveAllImages(): Promise<void> {
  return relocateAllImages("move");
}

export function reloadImages(): void {
  reloadAllImages();
  useUi.getState().flash("已重新加载图片");
}

export async function chooseImageRoot(): Promise<void> {
  const dir = await open({ multiple: false, directory: true, title: "选择图片根目录" });
  if (typeof dir !== "string") return;
  useSettings.getState().update({ imageRoot: dir });
  useUi.getState().flash(`图片根目录：${dir}`);
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
