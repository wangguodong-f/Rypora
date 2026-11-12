import { refractor } from "refractor";
import type { Refractor } from "refractor/core";
import type { Element, Root, Text } from "hast";
import bash from "refractor/bash";
import c from "refractor/c";
import cpp from "refractor/cpp";
import go from "refractor/go";
import java from "refractor/java";
import json from "refractor/json";
import jsx from "refractor/jsx";
import markdown from "refractor/markdown";
import python from "refractor/python";
import rust from "refractor/rust";
import sql from "refractor/sql";
import toml from "refractor/toml";
import tsx from "refractor/tsx";
import typescript from "refractor/typescript";
import yaml from "refractor/yaml";

const LANGUAGES = [
  bash,
  c,
  cpp,
  go,
  java,
  json,
  jsx,
  markdown,
  python,
  rust,
  sql,
  toml,
  tsx,
  typescript,
  yaml,
];

let prepared = false;

/** The shared refractor instance, with Rypora's language set registered. */
export function getRefractor(): Refractor {
  if (!prepared) {
    for (const language of LANGUAGES) refractor.register(language);
    // Mermaid fences are rendered as diagrams, but prism still visits them.
    refractor.alias("markdown", "mermaid");
    prepared = true;
  }
  return refractor;
}

function hastToDom(node: Root | Element | Text): Node {
  if (node.type === "text") return document.createTextNode(node.value);
  if (node.type === "root") {
    const fragment = document.createDocumentFragment();
    for (const child of node.children) {
      fragment.appendChild(hastToDom(child as Root | Element | Text));
    }
    return fragment;
  }
  const element = document.createElement(node.tagName);
  const className = node.properties?.className;
  if (className) {
    element.className = Array.isArray(className)
      ? className.join(" ")
      : String(className);
  }
  for (const child of node.children) {
    element.appendChild(hastToDom(child as Root | Element | Text));
  }
  return element;
}

function languageOf(pre: HTMLElement, code: HTMLElement): string {
  const data = pre.dataset.language;
  if (data) return data;
  const match = /(?:^|\s)language-([\w-]+)/.exec(code.className);
  return match?.[1] ?? "";
}

/**
 * Re-apply prism highlighting to serialized HTML. Milkdown's `getHtml()`
 * output keeps the fence language as `data-language` but drops the token
 * spans, so exported files would otherwise lose their colors.
 */
export function applySyntaxHighlighting(container: HTMLElement): void {
  const highlighter = getRefractor();
  const known = highlighter.listLanguages();

  for (const pre of Array.from(container.querySelectorAll("pre"))) {
    const code = pre.querySelector("code");
    if (!code || code.childElementCount > 0) continue;
    const language = languageOf(pre, code);
    if (!language || !known.includes(language)) continue;
    const source = code.textContent ?? "";
    if (!source.trim()) continue;

    try {
      code.textContent = "";
      code.appendChild(hastToDom(highlighter.highlight(source, language)));
      code.className = `language-${language}`;
    } catch {
      // Leave the plain source when a grammar fails.
      code.textContent = source;
    }
  }
}
