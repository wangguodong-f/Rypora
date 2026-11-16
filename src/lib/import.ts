import { basename, dirname, joinPath } from "./paths";
import { htmlToMarkdown } from "./html";

export type ImportKind = "markdown" | "text" | "html";

export function importKind(path: string): ImportKind {
  if (/\.(html?|xhtml)$/i.test(path)) return "html";
  if (/\.(md|markdown|mdx)$/i.test(path)) return "markdown";
  return "text";
}

/** Read a file chosen by the import dialog and turn it into Markdown. */
export function convertImport(path: string, raw: string): string {
  const kind = importKind(path);
  if (kind === "html") return htmlToMarkdown(raw);
  if (kind === "markdown") return raw;
  // Plain text: keep line breaks inside paragraphs.
  return raw
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** `notes.html` → `notes.md` next to the source file. */
export function importTarget(sourcePath: string): string {
  const dir = dirname(sourcePath);
  const stem = basename(sourcePath).replace(/\.[^.]+$/, "");
  return joinPath(dir, `${stem}.md`);
}

export const IMPORT_FILTERS = [
  {
    name: "可导入的文件",
    extensions: ["md", "markdown", "mdx", "txt", "html", "htm"],
  },
  { name: "Markdown", extensions: ["md", "markdown", "mdx"] },
  { name: "HTML", extensions: ["html", "htm"] },
  { name: "纯文本", extensions: ["txt"] },
];
