/**
 * Minimal HTML → Markdown conversion for **File → Import**. It covers the
 * elements that show up in exported documents (headings, paragraphs, lists,
 * quotes, code, tables, links, images); anything unknown is kept as text.
 */

function escapeInline(text: string): string {
  return text.replace(/([\\`*_{}[\]<>])/g, "\\$1");
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeInline((node.textContent ?? "").replace(/\s+/g, " "));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const children = () => Array.from(element.childNodes).map(inline).join("");
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case "br":
      return "  \n";
    case "strong":
    case "b": {
      const text = children().trim();
      return text ? `**${text}**` : "";
    }
    case "em":
    case "i": {
      const text = children().trim();
      return text ? `*${text}*` : "";
    }
    case "del":
    case "s":
    case "strike": {
      const text = children().trim();
      return text ? `~~${text}~~` : "";
    }
    case "code": {
      const text = element.textContent ?? "";
      const fence = text.includes("`") ? "``" : "`";
      return `${fence}${text}${fence}`;
    }
    case "a": {
      const href = element.getAttribute("href") ?? "";
      const text = children().trim() || href;
      return href ? `[${text}](${href})` : text;
    }
    case "img": {
      const src = element.getAttribute("src") ?? "";
      if (!src) return "";
      const alt = element.getAttribute("alt") ?? "";
      return `![${alt}](${src})`;
    }
    case "sup":
      return `^${children()}^`;
    case "sub":
      return `~${children()}~`;
    case "u":
    case "ins":
      return `<u>${children()}</u>`;
    case "mark":
      return `==${children()}==`;
    default:
      return children();
  }
}

function tableToMarkdown(element: HTMLElement): string {
  const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|"),
    ),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) => {
    const cells = [...row];
    while (cells.length < width) cells.push("");
    return `| ${cells.join(" | ")} |`;
  };
  const header = line(rows[0]);
  const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return [header, divider, ...rows.slice(1).map(line)].join("\n");
}

function block(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").trim();
    return text ? escapeInline(text) : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = inline(element).trim().replace(/\n/g, " ");
    return text ? `${"#".repeat(level)} ${text}` : "";
  }

  if (tag === "p") {
    const text = inline(element).trim();
    return text;
  }

  if (tag === "blockquote") {
    const body = flow(element);
    if (!body) return "";
    return body
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  if (tag === "pre") {
    const code = element.querySelector("code");
    const language =
      code?.className.match(/language-([\w-]+)/)?.[1] ??
      element.getAttribute("data-lang") ??
      "";
    const text = (code ?? element).textContent ?? "";
    return `\`\`\`${language}\n${text.replace(/\n$/, "")}\n\`\`\``;
  }

  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((item, index) => {
        const clone = item.cloneNode(true) as HTMLElement;
        // Nested lists become indented content of their parent item.
        const nested = Array.from(clone.children).filter((child) =>
          ["ul", "ol"].includes(child.tagName.toLowerCase()),
        );
        for (const child of nested) child.remove();
        const marker = ordered ? `${index + 1}.` : "-";
        const text = inline(clone).trim().replace(/\n/g, "\n  ");
        const inner = nested.map((child) => block(child)).join("\n");
        const body = inner
          .split("\n")
          .map((line) => (line ? `  ${line}` : line))
          .join("\n");
        return `${marker} ${text}${inner ? `\n${body}` : ""}`;
      });

    // Task list items (`<li class="task-list-item">` with a checkbox).
    const tasks = Array.from(element.querySelectorAll("li")).some((item) =>
      item.querySelector('input[type="checkbox"]'),
    );
    if (tasks) {
      return Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((item) => {
          const checkbox = item.querySelector('input[type="checkbox"]');
          const checked = checkbox?.hasAttribute("checked");
          checkbox?.remove();
          const text = inline(item).trim();
          return `- [${checked ? "x" : " "}] ${text}`;
        })
        .join("\n");
    }

    return items.filter(Boolean).join("\n");
  }

  if (tag === "table") return tableToMarkdown(element);

  if (tag === "hr") return "---";

  if (tag === "br") return "";

  if (["header", "footer", "nav", "aside", "script", "style"].includes(tag)) {
    return "";
  }

  // Containers (div, section, article, body …) contribute their blocks.
  return flow(element);
}

function flow(root: Node): string {
  const parts: string[] = [];
  let buffer = "";

  const flush = () => {
    const text = buffer.trim();
    if (text) parts.push(text);
    buffer = "";
  };

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      buffer += child.textContent ?? "";
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = (child as HTMLElement).tagName.toLowerCase();
    const isBlock = [
      "p", "div", "section", "article", "main", "body", "header", "footer",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "pre", "table",
      "blockquote", "hr",
    ].includes(tag);

    if (isBlock) {
      flush();
      const converted = block(child);
      if (converted) parts.push(converted);
      continue;
    }

    buffer += inline(child);
  }

  flush();
  return parts.join("\n\n");
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim();
  const body = doc.body ? flow(doc.body) : "";
  const markdown = body.trim();
  if (markdown) return `${markdown}\n`;
  return title ? `${title}\n` : "";
}
