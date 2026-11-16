import { copyText, isTauri, readClipboard, revealPath, openUrl } from "./ipc";

/** Copy text without relying on a user gesture inside the web view. */
export async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (isTauri()) {
    try {
      await copyText(text);
      return true;
    } catch (error) {
      console.warn("native clipboard write failed", error);
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("clipboard write failed", error);
    return false;
  }
}

export async function readClipboardText(): Promise<string | null> {
  if (isTauri()) {
    try {
      return await readClipboard();
    } catch (error) {
      console.warn("native clipboard read failed", error);
    }
  }
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.warn("clipboard read failed", error);
    return null;
  }
}

export { openUrl, revealPath };
