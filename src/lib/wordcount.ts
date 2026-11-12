const CJK =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;

export function countWords(text: string): number {
  if (!text) return 0;
  let words = 0;
  let latinBuffer = "";

  const flush = () => {
    if (latinBuffer) {
      words += latinBuffer.split(/\s+/).filter(Boolean).length;
      latinBuffer = "";
    }
  };

  for (const char of text) {
    if (CJK.test(char)) {
      flush();
      words += 1;
    } else if (/[A-Za-z0-9_'’-]/.test(char)) {
      latinBuffer += char;
    } else {
      flush();
    }
  }
  flush();
  return words;
}

export function countChars(text: string): number {
  return Array.from(text).length;
}

export function countLines(text: string): number {
  if (!text) return 1;
  return text.split(/\r\n|\r|\n/).length;
}
