//! Extra Markdown syntax that Typora supports but GitHub-flavoured Markdown
//! does not: underline, highlight, super/subscript, comments, alert blocks,
//! link references and link definitions.
//!
//! Parsing happens in a remark transformer (mdast level) and serialization is
//! provided by a matching `toMarkdown` handler, because the syntax has no
//! standard mdast node type.

import { $mark, $node, $remark } from "@milkdown/kit/utils";
import { imageSchema } from "@milkdown/kit/preset/commonmark";

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  [key: string]: unknown;
}

const TAG_TYPES: Record<string, string> = {
  u: "underline",
  ins: "underline",
  sup: "superscript",
  sub: "subscript",
};

const BLOCK_CONTAINERS = new Set([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition",
  "alert",
]);

export const ALERT_KINDS = [
  "NOTE",
  "TIP",
  "IMPORTANT",
  "WARNING",
  "CAUTION",
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_LABELS: Record<AlertKind, string> = {
  NOTE: "提醒",
  TIP: "建议",
  IMPORTANT: "重要",
  WARNING: "警告",
  CAUTION: "注意",
};

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "node"; node: MdNode }
  | {
      kind: "delim";
      type: string;
      raw: string;
      side?: "open" | "close";
      pair?: number;
    };

/** Split text into delimiter tokens and text runs. */
function tokenizeText(value: string, tokens: InlineToken[]): void {
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      tokens.push({ kind: "text", value: buffer });
      buffer = "";
    }
  };

  const tight = (at: number) =>
    (at > 0 && !/\s/.test(value[at - 1])) ||
    (at + 1 < value.length && !/\s/.test(value[at + 1]));

  while (index < value.length) {
    if (value[index] === "=" && value[index + 1] === "=") {
      flush();
      tokens.push({ kind: "delim", type: "highlight", raw: "==" });
      index += 2;
      continue;
    }

    if (value[index] === "^" && tight(index)) {
      flush();
      tokens.push({ kind: "delim", type: "superscript", raw: "^" });
      index += 1;
      continue;
    }

    if (
      value[index] === "~" &&
      value[index + 1] !== "~" &&
      tight(index)
    ) {
      flush();
      tokens.push({ kind: "delim", type: "subscript", raw: "~" });
      index += 1;
      continue;
    }

    buffer += value[index];
    index += 1;
  }

  flush();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function imageAttr(source: string, name: string): string {
  const match = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  ).exec(source);
  if (!match) return "";
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
}

/** `<img src="…" style="zoom:50%;" />` → an image mdast node. */
function parseImageTag(value: string): MdNode | null {
  const tag = /^<img\b([^>]*)\/?>$/i.exec(value);
  if (!tag) return null;
  const src = imageAttr(tag[1], "src");
  if (!src) return null;
  const style = imageAttr(tag[1], "style");
  const zoom = /zoom\s*:\s*([\d.]+)\s*%/i.exec(style);
  return {
    type: "image",
    url: src,
    alt: imageAttr(tag[1], "alt"),
    title: imageAttr(tag[1], "title") || null,
    zoom: zoom ? Number(zoom[1]) : 0,
    syntax: "html",
  };
}

function tokenizeInline(children: MdNode[], parent: MdNode): InlineToken[] {
  const tokens: InlineToken[] = [];

  for (const child of children) {
    if (child.type === "text" && typeof child.value === "string") {
      tokenizeText(child.value, tokens);
      continue;
    }

    if (child.type === "html" && typeof child.value === "string") {
      const trimmed = child.value.trim();
      const image = parseImageTag(trimmed);
      if (image) {
        tokens.push({ kind: "node", node: image });
        continue;
      }
      const open = /^<(u|ins|sup|sub)(?:\s[^>]*)?>$/i.exec(trimmed);
      const close = /^<\/(u|ins|sup|sub)\s*>$/i.exec(trimmed);

      if (open) {
        tokens.push({
          kind: "delim",
          type: TAG_TYPES[open[1].toLowerCase()],
          raw: child.value,
          side: "open",
        });
        continue;
      }
      if (close) {
        tokens.push({
          kind: "delim",
          type: TAG_TYPES[close[1].toLowerCase()],
          raw: child.value,
          side: "close",
        });
        continue;
      }
      if (/^<!--[\s\S]*-->$/.test(trimmed)) {
        const value = trimmed.replace(/^<!--/, "").replace(/-->$/, "");
        const comment: MdNode = { type: "comment", value };
        tokens.push({
          kind: "node",
          node: BLOCK_CONTAINERS.has(parent.type)
            ? { type: "paragraph", children: [comment] }
            : comment,
        });
        continue;
      }
    }

    tokens.push({ kind: "node", node: child });
  }

  return tokens;
}

/** Pair opener/closer tokens so marks may span sibling inline nodes. */
function pairDelimiters(tokens: InlineToken[]): void {
  const stack: number[] = [];

  tokens.forEach((token, index) => {
    if (token.kind !== "delim") return;

    if (token.side === "open") {
      stack.push(index);
      return;
    }

    let found = -1;
    for (let at = stack.length - 1; at >= 0; at -= 1) {
      const candidate = tokens[stack[at]];
      if (candidate.kind === "delim" && candidate.type === token.type) {
        found = at;
        break;
      }
    }

    // A closing tag with no matching opener stays literal.
    if (token.side === "close" && found < 0) return;
    // Text delimiters either close the nearest open or start a new span.
    if (token.side === undefined && found < 0) {
      stack.push(index);
      return;
    }

    const openIndex = stack[found];
    stack.splice(found);
    const opener = tokens[openIndex];
    if (opener.kind !== "delim") return;

    // `====` and `<u></u>` have no content and should stay literal.
    const hasContent = tokens
      .slice(openIndex + 1, index)
      .some(
        (item) =>
          (item.kind === "text" && item.value.length > 0) ||
          item.kind === "node" ||
          (item.kind === "delim" && item.pair !== undefined),
      );
    if (!hasContent) {
      return;
    }

    // Superscript/subscript do not span whitespace, so paths such as
    // `file~1 and file~2` are not mistaken for subscript.
    if (token.type === "superscript" || token.type === "subscript") {
      const spaced = tokens
        .slice(openIndex + 1, index)
        .some((item) => item.kind === "text" && /\s/.test(item.value));
      if (spaced) {
        return;
      }
    }

    opener.pair = index;
    token.pair = openIndex;
  });
}

function pushText(out: MdNode[], value: string): void {
  if (!value) return;
  const last = out[out.length - 1];
  if (last && last.type === "text") {
    last.value = `${last.value ?? ""}${value}`;
  } else {
    out.push({ type: "text", value });
  }
}

function buildInline(
  tokens: InlineToken[],
  start = 0,
  end = tokens.length,
): MdNode[] {
  const out: MdNode[] = [];
  let index = start;

  while (index < end) {
    const token = tokens[index];

    if (token.kind === "text") {
      pushText(out, token.value);
      index += 1;
      continue;
    }

    if (token.kind === "node") {
      out.push(token.node);
      index += 1;
      continue;
    }

    if (token.pair !== undefined && token.pair > index) {
      const children = buildInline(tokens, index + 1, token.pair);
      out.push({ type: token.type, children });
      index = token.pair + 1;
      continue;
    }

    if (token.raw.startsWith("<")) out.push({ type: "html", value: token.raw });
    else pushText(out, token.raw);
    index += 1;
  }

  return out;
}

function parseInline(children: MdNode[], parent: MdNode): MdNode[] {
  const tokens = tokenizeInline(children, parent);
  pairDelimiters(tokens);
  return buildInline(tokens);
}

/** `> [!NOTE]` becomes an alert node, leaving the block content intact. */
function toAlert(node: MdNode): MdNode | null {
  const first = node.children?.[0];
  if (!first || first.type !== "paragraph" || !first.children?.length) {
    return null;
  }

  const text = first.children[0];
  if (!text || text.type !== "text" || typeof text.value !== "string") {
    return null;
  }

  const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(text.value);
  if (!match) return null;

  const rest = text.value.slice(match[0].length);
  const remaining = first.children.slice(1);
  if (rest) remaining.unshift({ type: "text", value: rest });

  // `remarkLineBreak` turns the newline after `[!NOTE]` into a `break` node.
  while (
    remaining.length > 0 &&
    (remaining[0].type === "break" ||
      (remaining[0].type === "text" &&
        !String(remaining[0].value ?? "").trim()))
  ) {
    remaining.shift();
  }

  const children = [...(node.children ?? [])];
  if (remaining.length) {
    children[0] = { type: "paragraph", children: remaining };
  } else {
    children.shift();
  }

  return {
    type: "alert",
    kind: match[1].toUpperCase(),
    children,
  };
}

export function transformNode(node: MdNode): void {
  if (!Array.isArray(node.children)) return;

  for (const child of node.children) transformNode(child);

  if (node.type === "blockquote") {
    const alert = toAlert(node);
    if (alert) {
      delete node.children;
      delete node.value;
      Object.assign(node, alert);
    }
  }

  node.children = parseInline(node.children ?? [], node);
}

function delimiter(
  node: MdNode,
  state: {
    enter: (name: string) => () => void;
    containerPhrasing: (node: MdNode, info: unknown) => string;
  },
  info: unknown,
  marker: string,
): string {
  const exit = state.enter(node.type);
  const value = state.containerPhrasing(node, {
    ...(info as Record<string, unknown>),
    before: marker,
    after: marker,
  });
  exit();
  return `${marker}${value}${marker}`;
}

export const HANDLERS = {
  underline(node: MdNode, _parent: unknown, state: never, info: unknown) {
    const exit = (state as never as { enter: (name: string) => () => void })
      .enter("underline");
    const value = (
      state as never as {
        containerPhrasing: (node: MdNode, info: unknown) => string;
      }
    ).containerPhrasing(node, {
      ...(info as Record<string, unknown>),
      before: "<u>",
      after: "</u>",
    });
    exit();
    return `<u>${value}</u>`;
  },
  highlight(node: MdNode, _parent: unknown, state: never, info: unknown) {
    return delimiter(node, state as never, info, "==");
  },
  superscript(node: MdNode, _parent: unknown, state: never, info: unknown) {
    return delimiter(node, state as never, info, "^");
  },
  subscript(node: MdNode, _parent: unknown, state: never, info: unknown) {
    return delimiter(node, state as never, info, "~");
  },
  comment(node: MdNode) {
    return `<!--${node.value ?? ""}-->`;
  },
  alert(node: MdNode, _parent: unknown, state: never, info: unknown) {
    const typed = state as never as {
      enter: (name: string) => () => void;
      containerFlow: (node: MdNode, info: unknown) => string;
    };
    const exit = typed.enter("alert");
    const body = typed.containerFlow(node, info);
    exit();

    const kind = String(node.kind ?? "NOTE").toUpperCase();
    const lines = body.replace(/\n$/, "").split("\n");
    const quoted = lines
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
    return `> [!${kind}]\n${quoted}`;
  },
};

function remarkRich() {
  return function (this: any) {
    const data = this.data() as Record<string, unknown>;
    const extensions =
      (data.toMarkdownExtensions as unknown[]) ??
      (data.toMarkdownExtensions = []);
    extensions.push({ handlers: HANDLERS });

    return (tree: MdNode) => {
      transformNode(tree);
    };
  };
}

/** Rename reference links before commonmark unfolds them into inline links. */
export function renameLinkReferences(node: MdNode): void {
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child.type === "linkReference") child.type = "link_ref_source";
    else if (child.type === "definition") child.type = "link_definition_source";
    renameLinkReferences(child);
  }
}

/**
 * An empty footnote definition is serialized as `[^1]: <br />` because the
 * commonmark preset preserves empty paragraphs. Typora writes `[^1]: `.
 */
export function normalizeEmptyFootnoteDefinitions(markdown: string): string {
  return markdown.replace(
    /^\[\^([^\]]+)\]:[ \t]*<br\s*\/?>[ \t]*$/gm,
    "[^$1]: ",
  );
}

export const linkRefRemark = $remark(
  "rypora-link-ref-preserve",
  () =>
    function () {
      return (tree: MdNode) => renameLinkReferences(tree);
    } as never,
);

export const richRemark = $remark(
  "rypora-rich-syntax",
  () => remarkRich() as never,
);

function escapeAttr(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The commonmark image node plus the two attributes Typora stores for
 * `<img src="…" style="zoom:50%;" />`: a zoom percentage and the syntax the
 * image is written with.
 */
export const richImageSchema = imageSchema.extendSchema(
  (base) => (ctx) => {
    const node = base(ctx);
    return {
      ...node,
      attrs: {
        ...node.attrs,
        zoom: { default: 0, validate: "number" },
        syntax: { default: "markdown", validate: "string" },
      },
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs: (dom: HTMLElement) => {
            const style = dom.getAttribute("style") ?? "";
            const zoom = /zoom\s*:\s*([\d.]+)\s*%/i.exec(style);
            return {
              src: dom.getAttribute("src") ?? "",
              alt: dom.getAttribute("alt") ?? "",
              title:
                dom.getAttribute("title") ?? dom.getAttribute("alt") ?? "",
              zoom: zoom ? Number(zoom[1]) : 0,
              syntax: zoom ? "html" : "markdown",
            };
          },
        },
      ],
      toDOM: (target) => {
        const attrs: Record<string, string> = {
          src: String(target.attrs.src ?? ""),
          alt: String(target.attrs.alt ?? ""),
        };
        if (target.attrs.title) attrs.title = String(target.attrs.title);
        const zoom = Number(target.attrs.zoom ?? 0);
        if (zoom > 0) attrs.style = `zoom:${zoom}%;`;
        return ["img", attrs] as never;
      },
      parseMarkdown: {
        match: ({ type }) => type === "image",
        runner: (state, source, type) => {
          state.addNode(type, {
            src: source.url,
            alt: source.alt ?? "",
            title: source.title ?? "",
            zoom: Number(source.zoom ?? 0) || 0,
            syntax: String(source.syntax ?? "markdown"),
          });
        },
      },
      toMarkdown: {
        match: (target) => target.type.name === "image",
        runner: (state, target) => {
          const zoom = Number(target.attrs.zoom ?? 0);
          const syntax = String(target.attrs.syntax ?? "markdown");
          if (syntax === "html" || zoom > 0) {
            const title = target.attrs.title
              ? ` title="${escapeAttr(target.attrs.title)}"`
              : "";
            const style = zoom > 0 ? ` style="zoom:${zoom}%;"` : "";
            state.addNode(
              "html",
              void 0,
              `<img src="${escapeAttr(target.attrs.src)}" alt="${escapeAttr(
                target.attrs.alt,
              )}"${title}${style} />`,
            );
            return;
          }
          state.addNode("image", void 0, void 0, {
            title: target.attrs.title || null,
            url: target.attrs.src,
            alt: target.attrs.alt ?? "",
          });
        },
      },
    };
  },
);

export const underlineSchema = $mark("underline", () => ({
  parseDOM: [{ tag: "u" }, { tag: "ins" }],
  toDOM: () => ["u", 0] as const,
  parseMarkdown: {
    match: (node) => node.type === "underline",
    runner: (state, node, markType) => {
      state.openMark(markType).next(node.children).closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "underline",
    runner: (state, mark) => {
      state.withMark(mark, "underline");
    },
  },
}));

function simpleMark(id: string, tag: string) {
  return $mark(id, () => ({
    parseDOM: [{ tag }],
    toDOM: () => [tag, 0] as const,
    parseMarkdown: {
      match: (node) => node.type === id,
      runner: (state, node, markType) => {
        state.openMark(markType).next(node.children).closeMark(markType);
      },
    },
    toMarkdown: {
      match: (mark) => mark.type.name === id,
      runner: (state, mark) => {
        state.withMark(mark, id);
      },
    },
  }));
}

export const highlightSchema = simpleMark("highlight", "mark");
export const superscriptSchema = simpleMark("superscript", "sup");
export const subscriptSchema = simpleMark("subscript", "sub");

export const commentSchema = $node("comment", () => ({
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  attrs: { value: { default: "" } },
  parseDOM: [
    {
      tag: "span[data-comment]",
      getAttrs: (dom: HTMLElement) => ({
        value: dom.dataset.value ?? dom.textContent ?? "",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    {
      class: "md-comment",
      "data-comment": "",
      "data-value": String(node.attrs.value ?? ""),
    },
    `<!--${node.attrs.value ?? ""}-->`,
  ],
  parseMarkdown: {
    match: ({ type }) => type === "comment",
    runner: (state, node, type) => {
      state.addNode(type, { value: String(node.value ?? "") });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "comment",
    runner: (state, node) => {
      state.addNode("comment", void 0, String(node.attrs.value ?? ""));
    },
  },
}));

export const alertSchema = $node("alert", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: { kind: { default: "NOTE" } },
  parseDOM: [
    {
      tag: "div[data-alert]",
      getAttrs: (dom: HTMLElement) => ({
        kind: (dom.dataset.alert ?? "NOTE").toUpperCase(),
      }),
      contentElement: ".alert-body",
    },
  ],
  toDOM: (node) => {
    const kind = String(node.attrs.kind ?? "NOTE").toUpperCase();
    return [
      "div",
      {
        class: `md-alert md-alert-${kind.toLowerCase()}`,
        "data-alert": kind,
      },
      [
        "div",
        { class: "md-alert-label", contenteditable: "false" },
        ALERT_LABELS[kind as AlertKind] ?? kind,
      ],
      ["div", { class: "md-alert-body" }, 0],
    ];
  },
  parseMarkdown: {
    match: ({ type }) => type === "alert",
    runner: (state, node, type) => {
      state
        .openNode(type, { kind: String(node.kind ?? "NOTE") })
        .next(node.children)
        .closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "alert",
    runner: (state, node) => {
      state
        .openNode("alert", void 0, { kind: node.attrs.kind })
        .next(node.content)
        .closeNode();
    },
  },
}));

export const linkRefSchema = $mark("link_ref", () => ({
  attrs: {
    label: { default: "" },
    referenceType: { default: "full" },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "span[data-link-reference]",
      getAttrs: (dom: HTMLElement) => ({
        label: dom.dataset.label ?? "",
        referenceType: dom.dataset.referenceType ?? "full",
      }),
    },
  ],
  toDOM: (mark) => [
    "span",
    {
      class: "md-link-reference",
      "data-link-reference": "",
      "data-label": String(mark.attrs.label ?? ""),
      "data-reference-type": String(mark.attrs.referenceType ?? "full"),
    },
    0,
  ],
  parseMarkdown: {
    match: ({ type }) => type === "link_ref_source",
    runner: (state, node, markType) => {
      state
        .openMark(markType, {
          label: String(node.label ?? node.identifier ?? ""),
          referenceType: String(node.referenceType ?? "full"),
        })
        .next(node.children)
        .closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "link_ref",
    runner: (state, mark) => {
      state.withMark(mark, "linkReference", void 0, {
        identifier: mark.attrs.label,
        label: mark.attrs.label,
        referenceType: mark.attrs.referenceType,
      });
    },
  },
}));

export const linkDefinitionSchema = $node("link_definition", () => ({
  group: "block",
  atom: true,
  selectable: true,
  attrs: {
    identifier: { default: "" },
    label: { default: "" },
    url: { default: "" },
    title: { default: null },
  },
  parseDOM: [
    {
      tag: "div[data-link-definition]",
      getAttrs: (dom: HTMLElement) => ({
        identifier: dom.dataset.identifier ?? "",
        label: dom.dataset.label ?? "",
        url: dom.dataset.url ?? "",
        title: dom.dataset.title ?? null,
      }),
    },
  ],
  toDOM: (node) => {
    const label = String(node.attrs.label ?? "");
    const url = String(node.attrs.url ?? "");
    const title =
      node.attrs.title == null ? "" : ` "${String(node.attrs.title)}"`;
    return [
      "div",
      {
        class: "md-link-definition",
        "data-link-definition": "",
        "data-identifier": String(node.attrs.identifier ?? label),
        "data-label": label,
        "data-url": url,
      },
      `[${label}]: ${url}${title}`,
    ];
  },
  parseMarkdown: {
    match: ({ type }) => type === "link_definition_source",
    runner: (state, node, type) => {
      state.addNode(type, {
        identifier: String(node.identifier ?? node.label ?? ""),
        label: String(node.label ?? node.identifier ?? ""),
        url: String(node.url ?? ""),
        title: (node.title as string | null) ?? null,
      });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "link_definition",
    runner: (state, node) => {
      state.addNode("definition", void 0, void 0, {
        identifier: node.attrs.identifier,
        label: node.attrs.label,
        url: node.attrs.url,
        title: node.attrs.title,
      });
    },
  },
}));
