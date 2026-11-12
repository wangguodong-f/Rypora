import mermaid from "mermaid";
import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { useUi } from "../stores/ui";

const svgCache = new Map<string, string>();
const pending = new Map<string, Set<HTMLElement>>();

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "default",
  fontFamily: "inherit",
});

function themeName(): "default" | "dark" {
  return useUi.getState().dark ? "dark" : "default";
}

function cacheKey(code: string): string {
  return `${themeName()}::${code}`;
}

export async function renderMermaidSvg(code: string): Promise<string> {
  const key = cacheKey(code);
  const cached = svgCache.get(key);
  if (cached) return cached;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: themeName(),
    fontFamily: "inherit",
  });
  const id = `rypora-mermaid-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, code);
  svgCache.set(key, svg);
  return svg;
}

function fillPreview(element: HTMLElement, code: string): void {
  const key = cacheKey(code);
  const cached = svgCache.get(key);
  if (cached) {
    element.innerHTML = cached;
    return;
  }

  element.textContent = "正在渲染图表…";
  let waiting = pending.get(key);
  if (!waiting) {
    waiting = new Set();
    pending.set(key, waiting);
  }
  waiting.add(element);

  if (waiting.size === 1) {
    renderMermaidSvg(code)
      .then((svg) => {
        pending.get(key)?.forEach((node) => {
          node.innerHTML = svg;
        });
        pending.delete(key);
      })
      .catch((error) => {
        pending.get(key)?.forEach((node) => {
          node.textContent = `Mermaid 渲染失败：${String(error)}`;
        });
        pending.delete(key);
      });
  }
}

function createPreview(code: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "mermaid-block";
  wrapper.contentEditable = "false";

  const preview = document.createElement("div");
  preview.className = "mermaid-preview";
  wrapper.appendChild(preview);
  fillPreview(preview, code);
  return wrapper;
}

export const mermaidPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("RYPORA_MERMAID"),
      props: {
        decorations(state) {
          const widgets: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === "code_block" &&
              node.attrs.language === "mermaid"
            ) {
              const code = node.textContent.trim();
              if (code) {
                widgets.push(
                  Decoration.widget(
                    pos + node.nodeSize,
                    () => createPreview(code),
                    { side: 1 },
                  ),
                );
              }
            }
          });
          if (!widgets.length) return null;
          return DecorationSet.create(state.doc, widgets);
        },
      },
    }),
);
