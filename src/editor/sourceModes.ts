import { useUi } from "../stores/ui";

/**
 * Focus mode and typewriter mode for the plain-text (source) editor.
 *
 * A textarea has no per-block elements to decorate, so both modes are derived
 * from the caret position:
 *
 * - focus mode masks the sheet with a vertical gradient, keeping the current
 *   paragraph fully opaque and fading everything else to the same alpha the
 *   WYSIWYG focus plugin uses;
 * - typewriter mode scrolls the pane so that the caret sits on the vertical
 *   centre.
 *
 * Text metrics come from a hidden mirror element that copies the textarea's
 * font and wrapping styles, because a textarea itself exposes no layout API
 * for arbitrary character offsets.
 */

const DIM_ALPHA = 0.32;
const FADE_PX = 14;

const MIRROR_PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "letter-spacing",
  "line-height",
  "word-spacing",
  "text-indent",
  "text-transform",
  "white-space",
  "overflow-wrap",
  "word-break",
  "tab-size",
  "box-sizing",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
];

function createMirror(): HTMLDivElement {
  const mirror = document.createElement("div");
  mirror.className = "source-mirror";
  mirror.setAttribute("aria-hidden", "true");
  const style = mirror.style;
  style.position = "fixed";
  style.top = "-10000px";
  style.left = "0";
  style.visibility = "hidden";
  style.pointerEvents = "none";
  style.height = "auto";
  style.overflow = "hidden";
  style.zIndex = "-1";
  document.body.appendChild(mirror);
  return mirror;
}

function syncMirrorStyle(
  mirror: HTMLDivElement,
  textarea: HTMLTextAreaElement,
): void {
  const computed = window.getComputedStyle(textarea);
  for (const prop of MIRROR_PROPS) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }
  mirror.style.width = `${textarea.clientWidth}px`;
}

function lineHeightOf(textarea: HTMLTextAreaElement): number {
  const computed = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computed.lineHeight);
  if (Number.isFinite(lineHeight)) return lineHeight;
  const fontSize = Number.parseFloat(computed.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.4 : 24;
}

/** Top offset of the line box that contains `index`, in mirror coordinates. */
function offsetTopAt(
  mirror: HTMLDivElement,
  text: string,
  index: number,
): number {
  mirror.textContent = "";
  mirror.appendChild(document.createTextNode(text.slice(0, index)));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  return marker.offsetTop;
}

/**
 * Character range of the paragraph around `caret`: consecutive non-blank
 * lines form one block, a blank line is a block of its own.
 */
function blockRange(text: string, caret: number): [number, number] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  const lines = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : text.length;
    return { start, end, blank: /^\s*$/.test(text.slice(start, end)) };
  });

  let index = lines.length - 1;
  for (let i = 0; i < lines.length; i += 1) {
    if (caret <= lines[i].end) {
      index = i;
      break;
    }
  }

  const current = lines[index];
  if (current.blank) return [current.start, current.end];

  let first = index;
  while (first > 0 && !lines[first - 1].blank) first -= 1;
  let last = index;
  while (last + 1 < lines.length && !lines[last + 1].blank) last += 1;
  return [lines[first].start, lines[last].end];
}

function applyFocusMask(
  textarea: HTMLTextAreaElement,
  mirror: HTMLDivElement,
  text: string,
  caret: number,
  lineHeight: number,
): void {
  const sheet = textarea.parentElement;
  if (!sheet) return;

  const [blockStart, blockEnd] = blockRange(text, caret);
  const top = offsetTopAt(mirror, text, blockStart);
  const bottom = offsetTopAt(mirror, text, blockEnd) + lineHeight;
  const height = Math.max(textarea.offsetHeight, bottom);
  const fade = Math.min(FADE_PX, Math.max(2, (bottom - top) / 4));
  const outside = `rgba(0, 0, 0, ${DIM_ALPHA})`;
  const inside = "rgba(0, 0, 0, 1)";
  const gradient = [
    "linear-gradient(to bottom",
    `${outside} 0px`,
    `${outside} ${Math.max(0, top - fade)}px`,
    `${inside} ${top}px`,
    `${inside} ${bottom}px`,
    `${outside} ${Math.min(height, bottom + fade)}px`,
    `${outside} 100%)`,
  ].join(", ");

  sheet.style.setProperty("-webkit-mask-image", gradient);
  sheet.style.setProperty("mask-image", gradient);
  sheet.style.setProperty("-webkit-mask-repeat", "no-repeat");
  sheet.style.setProperty("mask-repeat", "no-repeat");
  sheet.style.setProperty("-webkit-mask-size", "100% 100%");
  sheet.style.setProperty("mask-size", "100% 100%");
}

function clearFocusMask(textarea: HTMLTextAreaElement): void {
  const sheet = textarea.parentElement;
  if (!sheet) return;
  for (const prop of [
    "-webkit-mask-image",
    "mask-image",
    "-webkit-mask-repeat",
    "mask-repeat",
    "-webkit-mask-size",
    "mask-size",
  ]) {
    sheet.style.removeProperty(prop);
  }
}

function centerCaret(
  pane: HTMLElement,
  textarea: HTMLTextAreaElement,
  caretTop: number,
  lineHeight: number,
): void {
  const caretY = caretTop + lineHeight / 2;
  const paneRect = pane.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  const contentY = textareaRect.top - paneRect.top + pane.scrollTop + caretY;
  const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
  const target = Math.min(
    maxScroll,
    Math.max(0, contentY - pane.clientHeight / 2),
  );
  if (Math.abs(target - pane.scrollTop) > 2) pane.scrollTop = target;
}

export interface SourceModesHandle {
  /** Measure and apply the modes right now (no animation frame). */
  sync: () => void;
  detach: () => void;
}

export function attachSourceModes(
  textarea: HTMLTextAreaElement,
  pane: HTMLElement,
): SourceModesHandle {
  const mirror = createMirror();
  let frame = 0;
  let lastFocus = useUi.getState().focusMode;
  let lastTypewriter = useUi.getState().typewriterMode;

  const sync = () => {
    frame = 0;
    if (!textarea.isConnected) return;
    const state = useUi.getState();
    lastFocus = state.focusMode;
    lastTypewriter = state.typewriterMode;
    if (!state.focusMode && !state.typewriterMode) {
      clearFocusMask(textarea);
      return;
    }

    syncMirrorStyle(mirror, textarea);
    const lineHeight = lineHeightOf(textarea);
    const text = textarea.value;
    const caret = textarea.selectionStart ?? 0;

    if (state.focusMode) {
      applyFocusMask(textarea, mirror, text, caret, lineHeight);
    } else {
      clearFocusMask(textarea);
    }
    if (state.typewriterMode) {
      centerCaret(
        pane,
        textarea,
        offsetTopAt(mirror, text, caret),
        lineHeight,
      );
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  const onSelectionChange = () => {
    if (document.activeElement === textarea) schedule();
  };

  const listeners: Array<[string, EventListener]> = [
    ["keyup", schedule],
    ["mouseup", schedule],
    ["click", schedule],
    ["select", schedule],
    ["input", schedule],
    ["focus", schedule],
    ["blur", schedule],
  ];
  for (const [type, listener] of listeners) {
    textarea.addEventListener(type, listener);
  }
  document.addEventListener("selectionchange", onSelectionChange);

  const unsubscribe = useUi.subscribe((state) => {
    if (
      state.focusMode === lastFocus &&
      state.typewriterMode === lastTypewriter
    ) {
      return;
    }
    lastFocus = state.focusMode;
    lastTypewriter = state.typewriterMode;
    schedule();
  });

  const observer = new ResizeObserver(schedule);
  observer.observe(pane);
  observer.observe(textarea);

  return {
    sync: () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      sync();
    },
    detach: () => {
      if (frame) cancelAnimationFrame(frame);
      for (const [type, listener] of listeners) {
        textarea.removeEventListener(type, listener);
      }
      document.removeEventListener("selectionchange", onSelectionChange);
      unsubscribe();
      observer.disconnect();
      clearFocusMask(textarea);
      mirror.remove();
    },
  };
}
