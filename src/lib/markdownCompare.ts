/**
 * Markdown written by different tools formats the same document differently:
 * `*` or `+` bullets instead of `-`, `***` rules, trailing spaces. The editor
 * canonicalises all of that when it loads a file, and the result must not be
 * mistaken for a user edit.
 */
function canonical(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/^([ \t]*)[-*+]([ \t]+)/gm, "$1-$2")
    .replace(/^([ \t]*)(?:\*{3,}|-{3,}|_{3,})[ \t]*$/gm, "$1---")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "\n")
    .trimEnd();
}

export function isSameMarkdown(left: string, right: string): boolean {
  if (left === right) return true;
  return canonical(left) === canonical(right);
}
