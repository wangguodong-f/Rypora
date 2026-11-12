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
