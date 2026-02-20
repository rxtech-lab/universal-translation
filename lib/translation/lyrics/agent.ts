import type { EntryWithResource } from "../tools/context-tools";
import { analyzeRhythm } from "./agents/rhythm-agent";
import { analyzeRhyme } from "./agents/rhyme-agent";
import { reviewTranslation } from "./agents/review-agent";
import { translateLyricsLine } from "./agents/translation-agent";
import { checkSyllableMatch } from "./checker/syllable-check";
import { LYRICS_MAX_RETRIES } from "./config";
import type { LyricsTranslationEvent } from "./events";

/**
 * Translate lyrics entries line-by-line with rhythm/rhyme-aware multi-agent pipeline.
 *
 * For each line: analyze rhythm → analyze rhyme → translate → syllable check → AI review.
 * Retries up to LYRICS_MAX_RETRIES times if checks or review fail.
 */
export async function* translateLyricsEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<LyricsTranslationEvent> {
  const { entries, sourceLanguage, targetLanguage } = params;
  const total = entries.length;

  // Build full lyrics text for context
  const fullLyrics = entries.map((e) => e.sourceText).join("\n");
  const allLines = entries.map((e) => ({ id: e.id, text: e.sourceText }));

  yield { type: "translate-start", total };

  const completedTranslations: Array<{
    original: string;
    translated: string;
  }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const current = i + 1;

    // Step 1: Analyze rhythm & rhyme in parallel
    yield {
      type: "agent-text-delta",
      batchIndex: 0,
      text: `Analyzing rhythm & rhyme for line ${current}/${total}: "${entry.sourceText.slice(0, 40)}..."`,
    };

    const [rhythm, rhyme] = await Promise.all([
      analyzeRhythm({
        line: entry.sourceText,
        fullLyrics,
        model: params.model,
      }),
      analyzeRhyme({
        currentLine: { id: entry.id, text: entry.sourceText },
        allLines,
        fullLyrics,
        model: params.model,
      }),
    ]);

    yield {
      type: "line-rhythm-analyzed",
      entryId: entry.id,
      syllableCount: rhythm.syllableCount,
      stressPattern: rhythm.stressPattern,
    };

    yield {
      type: "line-rhyme-analyzed",
      entryId: entry.id,
      rhymeWords: rhyme.rhymeWords,
      relatedLineIds: rhyme.relatedLineIds,
    };

    // Step 3: Translate with retry loop
    let translatedText = "";
    let passed = false;
    let lastFeedback: string | undefined;

    for (let attempt = 1; attempt <= LYRICS_MAX_RETRIES; attempt++) {
      yield {
        type: "line-translation-attempt",
        entryId: entry.id,
        attempt,
        maxAttempts: LYRICS_MAX_RETRIES,
      };

      yield {
        type: "agent-text-delta",
        batchIndex: 0,
        text: `Translating line ${current}/${total} (attempt ${attempt}/${LYRICS_MAX_RETRIES})...`,
      };

      // Translate
      const translation = await translateLyricsLine({
        line: entry.sourceText,
        targetLanguage,
        sourceLanguage,
        fullLyrics,
        rhythm,
        rhyme,
        previousTranslations: completedTranslations,
        previousFeedback: lastFeedback,
        model: params.model,
      });

      translatedText = translation.translatedText;

      // Programmatic syllable check — use rhythm agent's count as source of truth
      const syllableResult = checkSyllableMatch(
        entry.sourceText,
        translatedText,
        rhythm.syllableCount,
      );

      if (!syllableResult.passed && attempt < LYRICS_MAX_RETRIES) {
        lastFeedback = `Syllable count mismatch: source has ${syllableResult.sourceSyllables} syllables but translation "${translatedText}" has ${syllableResult.targetSyllables}. Must be exactly ${syllableResult.sourceSyllables}.`;
        console.log(
          `[lyrics] Line ${current} attempt ${attempt} RETRY (syllable check failed):`,
          lastFeedback,
        );
        yield {
          type: "line-review-result",
          entryId: entry.id,
          passed: false,
          feedback: lastFeedback,
        };
        continue;
      }

      // AI review
      yield {
        type: "agent-text-delta",
        batchIndex: 0,
        text: `Reviewing translation for line ${current}/${total}...`,
      };

      const review = await reviewTranslation({
        originalLine: entry.sourceText,
        translatedLine: translatedText,
        translationComments: translation.translationComments,
        fullLyrics,
        rhythm,
        rhyme,
        previousTranslations: completedTranslations,
        sourceLanguage,
        targetLanguage,
        model: params.model,
      });

      yield {
        type: "line-review-result",
        entryId: entry.id,
        passed: review.passed,
        feedback: review.feedback,
      };

      if (review.passed) {
        passed = true;
        console.log(
          `[lyrics] Line ${current} attempt ${attempt} PASSED review`,
        );
        break;
      }

      console.log(
        `[lyrics] Line ${current} attempt ${attempt} RETRY (review failed):`,
        review.feedback,
        review.suggestedRevision
          ? `| suggested: "${review.suggestedRevision}"`
          : "",
      );

      // Use suggested revision if available and this is the last attempt
      if (attempt >= LYRICS_MAX_RETRIES && review.suggestedRevision) {
        translatedText = review.suggestedRevision;
        break;
      }

      lastFeedback = review.feedback;
    }

    // Emit final translation for this line
    yield {
      type: "entry-translated",
      resourceId: entry.resourceId,
      entryId: entry.id,
      targetText: translatedText,
      current,
      total,
    };

    yield {
      type: "agent-text-delta",
      batchIndex: 0,
      text: passed
        ? `Line ${current}/${total} passed review ✓`
        : `Line ${current}/${total} used best attempt`,
    };

    yield {
      type: "line-complete",
      entryId: entry.id,
      current,
      total,
    };

    completedTranslations.push({
      original: entry.sourceText,
      translated: translatedText,
    });
  }

  yield { type: "term-resolution-complete" };
  yield { type: "complete" };
}
