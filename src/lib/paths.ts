import { convertFileSrc } from "@tauri-apps/api/core";

export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function dirname(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : path;
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith("/") || dir.endsWith("\\") ? `${dir}${name}` : `${dir}${sep}${name}`;
}

export function relativePath(root: string, path: string): string {
  if (path.startsWith(root)) {
    return path.slice(root.length).replace(/^[\\/]/, "");
  }
  return path;
}

export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const normalize = (value: string) =>
    value.replace(/\\/g, "/").replace(/\/+$/, "");
  const left = normalize(a);
  const right = normalize(b);
  if (left === right) return true;
  // macOS may report /private/var vs /var for the same file.
  return left.endsWith(right) || right.endsWith(left);
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(/\.(md|markdown|mdx|txt)$/i, "");
}

const REMOTE_SRC = /^(https?:|data:|blob:|asset:|tauri:)/i;
const FILE_URL = /^file:\/\//i;

function isAbsoluteFsPath(src: string): boolean {
  return src.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(src);
}

/**
 * Turn a Markdown image source into something the webview can load. Remote
 * and data URLs pass through untouched, local paths go through Tauri's asset
 * protocol (relative to `baseDir` unless already absolute).
 */
export function resolveImageSource(
  src: string,
  baseDir: string | null,
): string {
  if (!src || REMOTE_SRC.test(src)) return src;
  try {
    if (FILE_URL.test(src)) {
      const raw = decodeURIComponent(src.replace(FILE_URL, ""));
      // Windows file URLs look like file:///C:/dir/a.png.
      return convertFileSrc(raw.replace(/^\/([a-zA-Z]:[\\/])/, "$1"));
    }
    if (isAbsoluteFsPath(src)) return convertFileSrc(src);
    if (!baseDir) return src;
    return convertFileSrc(joinPath(baseDir, src));
  } catch {
    return src;
  }
}
