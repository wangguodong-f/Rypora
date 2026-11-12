import type { EditorCommands } from "./commands";

let current: EditorCommands | null = null;

export function setEditorCommands(commands: EditorCommands | null): void {
  current = commands;
}

export function getEditorCommands(): EditorCommands | null {
  return current;
}

export function runCommand<K extends keyof EditorCommands>(
  name: K,
  ...args: Parameters<EditorCommands[K]>
): ReturnType<EditorCommands[K]> | undefined {
  const commands = current;
  if (!commands) return undefined;
  const fn = commands[name] as (...params: unknown[]) => unknown;
  return fn(...args) as ReturnType<EditorCommands[K]>;
}
