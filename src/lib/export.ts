import { message, save } from "@tauri-apps/plugin-dialog";
import katexCss from "katex/dist/katex.min.css?raw";
import { getEditorCommands } from "../editor/editorBus";
import { applySyntaxHighlighting } from "../editor/highlight";
import { renderMermaidSvg } from "../editor/mermaid";
import { errorMessage } from "./errors";
import {
  basename,
  dirname,
  joinPath,
  resolveImageSource,
  stripMarkdownExtension,
} from "./paths";
import { writeTextFile } from "./ipc";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

const EXPORT_CSS = `
:root {
  --text: #26251f;
  --muted: #6f6b62;
  --border: #e3e0d8;
  --code-bg: #f4f2ec;
  --accent: #6c5ce7;
  --bg: #ffffff;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}
article.rypora-export {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 40px 96px;
  word-wrap: break-word;
}
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.6em 0 0.7em; font-weight: 650; }
h1 { font-size: 2em; }
h2 { font-size: 1.55em; }
h3 { font-size: 1.3em; }
h4 { font-size: 1.12em; }
h5 { font-size: 1em; }
h6 { font-size: 0.92em; color: var(--muted); }
p { margin: 0.85em 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
strong { font-weight: 650; }
blockquote {
  margin: 1em 0;
  padding: 0.2em 1em;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  background: rgba(108, 92, 231, 0.05);
}
code {
  font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: var(--code-bg);
  padding: 0.15em 0.4em;
  border-radius: 4px;
}
pre {
  background: var(--code-bg);
  padding: 16px 18px;
  border-radius: 8px;
  overflow: auto;
  line-height: 1.55;
}
pre code { background: transparent; padding: 0; font-size: 0.86em; }
table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em; }
th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
th { background: var(--code-bg); font-weight: 600; }
img { max-width: 100%; height: auto; border-radius: 6px; }
hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
ul, ol { padding-left: 1.6em; margin: 0.8em 0; }
li { margin: 0.3em 0; }
li[data-item-type="task"] { list-style: none; margin-left: -1.4em; }
li[data-item-type="task"] > p::before {
  content: "";
  display: inline-block;
  width: 13px;
  height: 13px;
  margin: 0 0.5em 0 0;
  vertical-align: -0.08em;
  border: 1.5px solid var(--border);
  border-radius: 3px;
}
li[data-item-type="task"][data-checked="true"] > p::before {
  content: "✓";
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  font-size: 10px;
  line-height: 13px;
  text-align: center;
}
.math-inline, .math-block { font-size: 1.02em; }
.math-block { margin: 1em 0; text-align: center; overflow-x: auto; }
.mermaid-block {
  margin: 1.2em 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  text-align: center;
  overflow-x: auto;
}
.mermaid-block svg { max-width: 100%; height: auto; }
.token.comment, .token.prolog, .token.doctype { color: #8a877e; }
.token.punctuation { color: #6f6b62; }
.token.property, .token.tag, .token.constant, .token.symbol { color: #d05a3a; }
.token.boolean, .token.number { color: #b07d2b; }
.token.selector, .token.attr-name, .token.string, .token.char { color: #4c8b4c; }
.token.operator, .token.entity, .token.url { color: #6f6b62; }
.token.atrule, .token.attr-value, .token.keyword { color: #6c5ce7; }
.token.function, .token.class-name { color: #2f6fbf; }
.token.regex, .token.important, .token.variable { color: #b0563f; }
@media print {
  body { font-size: 12.5pt; }
  article.rypora-export { max-width: none; padding: 0; }
  pre, blockquote, table, img, .mermaid-block { break-inside: avoid; }
  a { color: inherit; }
}
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function replaceMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = new Set<Element>([
    ...container.querySelectorAll('pre[data-language="mermaid"]'),
    ...container.querySelectorAll("pre > code.language-mermaid"),
  ]);
  await Promise.all(
    Array.from(blocks).map(async (block) => {
      const pre =
        block.tagName === "PRE" ? block : block.parentElement;
      const code =
        block.tagName === "PRE" ? block.querySelector("code") : block;
      const source = code?.textContent ?? "";
      if (!pre || !source.trim()) return;
      try {
        const svg = await renderMermaidSvg(source);
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-block";
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch {
        // keep the source code block when rendering fails
      }
    }),
  );
}

export function buildHtmlDocument(
  title: string,
  body: string,
  dark: boolean,
): string {
  const theme = dark
    ? `
:root { --text: #e8e6e3; --muted: #a09c93; --border: #3a3a3d; --code-bg: #2a2a2d; --accent: #a29bfe; --bg: #1c1c1e; }
`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${theme}${EXPORT_CSS}</style>
<style>${katexCss}</style>
</head>
<body>
<article class="rypora-export">
${body}
</article>
</body>
</html>`;
}

/**
 * Turn serialized editor HTML into export-ready HTML: render mermaid fences
 * and re-apply syntax highlighting.
 */
export async function enhanceExportElement(root: HTMLElement): Promise<void> {
  await replaceMermaidBlocks(root);
  applySyntaxHighlighting(root);
}

export async function buildExportBody(html: string): Promise<string> {
  const container = document.createElement("div");
  container.innerHTML = html;
  await enhanceExportElement(container);
  return container.innerHTML;
}

export async function exportHtml(): Promise<void> {
  const commands = getEditorCommands();
  const tab = useTabs.getState().getActive();
  if (!commands || !tab) {
    await message("请先打开一个文档。", { title: "导出 HTML" });
    return;
  }

  const container = document.createElement("div");
  container.innerHTML = commands.getHtml();
  await enhanceExportElement(container);

  const defaultPath = tab.path
    ? joinPath(dirname(tab.path), `${stripMarkdownExtension(basename(tab.path))}.html`)
    : `${stripMarkdownExtension(tab.title)}.html`;
  const target = await save({
    defaultPath,
    filters: [{ name: "HTML", extensions: ["html", "htm"] }],
  });
  if (!target) return;

  try {
    const html = buildHtmlDocument(
      tab.title,
      container.innerHTML,
      useUi.getState().dark,
    );
    await writeTextFile(target, html);
    useUi.getState().flash(`已导出 ${basename(target)}`);
  } catch (error) {
    await message(errorMessage(error), {
      title: "导出失败",
      kind: "error",
    });
  }
}

export async function exportPdf(): Promise<void> {
  const commands = getEditorCommands();
  const tab = useTabs.getState().getActive();
  if (!commands || !tab) {
    await message("请先打开一个文档。", { title: "导出 PDF" });
    return;
  }

  const container = document.createElement("div");
  container.id = "print-root";
  const article = document.createElement("article");
  article.className = "rypora-export";
  article.innerHTML = commands.getHtml();
  container.appendChild(article);

  const base = tab.path ? dirname(tab.path) : null;
  for (const image of Array.from(article.querySelectorAll("img"))) {
    const src = image.getAttribute("src") ?? "";
    if (src) image.src = resolveImageSource(src, base);
  }

  await enhanceExportElement(article);
  document.body.appendChild(container);

  const images = Array.from(article.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => image.decode().catch(() => undefined)),
  );

  const cleanup = () => {
    container.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 60_000);
}
