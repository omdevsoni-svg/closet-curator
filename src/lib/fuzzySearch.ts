/**
 * Lightweight fuzzy search utility for closet items.
 * Supports typo tolerance, partial matching, and multi-token queries.
 */

/**
 * Compute a simple fuzzy match score between a query and a target string.
 * Returns 0 (no match) to 1 (perfect match). Higher is better.
 */
function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact substring match — highest score
  if (t.includes(q)) return 1;

  // Check if query is a prefix of a word in the target
  const words = t.split(/[\s,_-]+/);
  for (const w of words) {
    if (w.startsWith(q)) return 0.9;
  }

  // Levenshtein-based fuzzy matching for short queries (typo tolerance)
  // Compare against each word in target
  for (const w of words) {
    const dist = levenshtein(q, w);
    const maxLen = Math.max(q.length, w.length);
    if (maxLen === 0) continue;
    const similarity = 1 - dist / maxLen;
    // Allow up to ~30% character difference
    if (similarity >= 0.7) return similarity * 0.8;
  }

  // Subsequence match — letters appear in order
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) {
    return 0.5 * (q.length / t.length);
  }

  return 0;
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/**
 * Fuzzy search across items. Each query token is matched independently
 * against all searchable fields. All tokens must match for an item to be included.
 *
 * @param items - Array of items to search
 * @param query - Search query string
 * @param getFields - Function that returns searchable strings for an item
 * @param threshold - Minimum score for a token match (default 0.3)
 * @returns Filtered items sorted by relevance (best first)
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getFields: (item: T) => string[],
  threshold = 0.3
): FuzzyMatch<T>[] {
  if (!query.trim()) return items.map((item) => ({ item, score: 1 }));

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const results: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const fields = getFields(item);
    let totalScore = 0;
    let allTokensMatch = true;

    for (const token of tokens) {
      let bestTokenScore = 0;

      for (const field of fields) {
        const score = fuzzyScore(token, field);
        if (score > bestTokenScore) bestTokenScore = score;

        // Also check individual words in the field
        const fieldWords = field.toLowerCase().split(/[\s,_-]+/);
        for (const word of fieldWords) {
          const wordScore = fuzzyScore(token, word);
          if (wordScore > bestTokenScore) bestTokenScore = wordScore;
        }
      }

      if (bestTokenScore < threshold) {
        allTokensMatch = false;
        break;
      }
      totalScore += bestTokenScore;
    }

    if (allTokensMatch) {
      results.push({ item, score: totalScore / tokens.length });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}
