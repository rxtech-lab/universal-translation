// CJK Unicode ranges
const CJK_RANGES =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;

/**
 * Detect whether the text is predominantly CJK.
 * For CJK, each character ≈ 1 syllable.
 */
function isCjk(text: string): boolean {
  const cjkCount = [...text].filter((ch) => CJK_RANGES.test(ch)).length;
  const totalChars = [...text].filter((ch) => ch.trim()).length;
  return totalChars > 0 && cjkCount / totalChars > 0.5;
}

/**
 * Count syllables in a CJK string (each character = 1 syllable).
 */
function countCjkSyllables(text: string): number {
  return [...text].filter((ch) => CJK_RANGES.test(ch)).length;
}

/**
 * Count syllables in a Latin/English string using vowel-cluster heuristic.
 */
function countLatinSyllables(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-záàâãéèêíïóôõúùüñç\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;
  for (const word of words) {
    // Count vowel groups
    const matches = word.match(/[aeiouyáàâãéèêíïóôõúùü]+/g);
    let count = matches ? matches.length : 1;
    // Silent e
    if (word.endsWith("e") && count > 1) count--;
    // -le ending
    if (word.match(/[^aeiouy]le$/)) count++;
    total += Math.max(1, count);
  }
  return total;
}

/**
 * Count syllables in text, auto-detecting CJK vs Latin.
 */
export function countSyllables(text: string): number {
  if (!text.trim()) return 0;
  if (isCjk(text)) return countCjkSyllables(text);
  return countLatinSyllables(text);
}

/**
 * Check if the translated syllable count matches the source.
 *
 * When `knownSourceSyllables` is provided (from the rhythm agent),
 * use that instead of the heuristic counter for the source side.
 */
export function checkSyllableMatch(
  sourceText: string,
  translatedText: string,
  knownSourceSyllables?: number,
): {
  passed: boolean;
  sourceSyllables: number;
  targetSyllables: number;
} {
  const sourceSyllables = knownSourceSyllables ?? countSyllables(sourceText);
  const targetSyllables = countSyllables(translatedText);
  // Exact match required for lyrics
  const passed = sourceSyllables === targetSyllables;
  return { passed, sourceSyllables, targetSyllables };
}
