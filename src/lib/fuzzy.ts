/**
 * Minimal fuzzy matcher for the Quick Open palette. A query matches when all of
 * its characters appear in order; the score rewards consecutive runs and
 * matches at the start of a path segment.
 */
export interface FuzzyMatch {
  score: number;
  positions: number[];
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  if (!query) return { score: 0, positions: [] };
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  const positions: number[] = [];

  let score = 0;
  let at = 0;
  let run = 0;
  for (const char of needle) {
    if (char === " ") continue;
    const found = haystack.indexOf(char, at);
    if (found === -1) return null;
    if (found === at && at > 0) {
      run += 1;
      score += 2 + run;
    } else {
      run = 0;
      score += 1;
    }
    if (found === 0 || /[/\\\s._-]/.test(haystack[found - 1] ?? "")) {
      score += 4;
    }
    positions.push(found);
    at = found + 1;
  }

  // Prefer shorter paths when the scores are close.
  score -= Math.max(0, text.length - query.length) * 0.02;
  return { score, positions };
}
