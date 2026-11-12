import { $prose, $view } from "@milkdown/kit/utils";
import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { Plugin } from "@milkdown/kit/prose/state";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";
import { imageSchema } from "@milkdown/kit/preset/commonmark";
import { message } from "@tauri-apps/plugin-dialog";
import { saveImage } from "../lib/ipc";
import { dirname, resolveImageSource } from "../lib/paths";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";

export function resolveImageSrc(src: string): string {
  const tab = useTabs.getState().getActive();
  return resolveImageSource(src, tab?.path ? dirname(tab.path) : null);
}

const imageNodeView: NodeViewConstructor = (node) => {
  const img = document.createElement("img");
  img.className = "rypora-image";

  let current = node;

  const apply = (target: typeof node) => {
    current = target;
    const src = String(target.attrs.src ?? "");
    const resolved = resolveImageSrc(src);
    if (img.getAttribute("src") !== resolved) img.src = resolved;
    img.alt = String(target.attrs.alt ?? "");
    const title = target.attrs.title;
    if (typeof title === "string" && title) img.title = title;
    else img.removeAttribute("title");
  };

  // Surface broken images instead of silently rendering an empty box.
  img.addEventListener("load", () => {
    img.dataset.state = "loaded";
    apply(current);
  });
  img.addEventListener("error", () => {
    img.dataset.state = "error";
    img.title = "图片加载失败";
  });

  apply(node);

  return {
    dom: img,
    update: (updated) => {
      if (updated.type !== node.type) return false;
      apply(updated);
      return true;
    },
    ignoreMutation: () => true,
  };
};

export const imageView = $view(imageSchema.node, () => imageNodeView);


async function insertImageFile(
  ctx: Ctx,
  file: File,
  position?: number,
): Promise<void> {
  const tab = useTabs.getState().getActive();
  const docDir = tab?.path ? dirname(tab.path) : useWorkspace.getState().root;
  if (!docDir) {
    await message("请先打开文件夹或保存文档，再插入图片。", {
      title: "插入图片",
      kind: "warning",
    });
    return;
  }

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const name = file.name || `image-${Date.now()}.png`;
    const src = await saveImage(docDir, name, bytes);
    const view = ctx.get(editorViewCtx);
    const imageType = ctx.get(schemaCtx).nodes.image;
    const node = imageType.create({ src, alt: name });
    if (position != null) {
      view.dispatch(view.state.tr.insert(position, node).scrollIntoView());
    } else {
      view.dispatch(
        view.state.tr.replaceSelectionWith(node).scrollIntoView(),
      );
    }
    useUi.getState().flash("图片已插入");
  } catch (error) {
    useUi.getState().flash(`插入图片失败：${String(error)}`);
  }
}

export const imagePastePlugin = $prose(
  (ctx) =>
    new Plugin({
      props: {
        handlePaste(_view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;
          const files: File[] = [];
          for (const item of Array.from(items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
          if (!files.length) return false;
          event.preventDefault();
          for (const file of files) void insertImageFile(ctx, file);
          return true;
        },
        handleDrop(view, event, _slice, moved) {
          if (moved) return false;
          const files = Array.from(event.dataTransfer?.files ?? []).filter(
            (file) => file.type.startsWith("image/"),
          );
          if (!files.length) return false;
          event.preventDefault();
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          for (const file of files) {
            void insertImageFile(ctx, file, coordinates?.pos);
          }
          return true;
        },
      },
    }),
);
