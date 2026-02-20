import { createGateway, generateText, Output } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL } from "../config";
import type { RhythmAnalysis } from "./rhythm-agent";
import type { RhymeAnalysis } from "./rhyme-agent";

export const reviewSchema = z.object({
  passed: z
    .boolean()
    .describe("Whether the translation passes ALL review criteria."),
  feedback: z
    .string()
    .describe(
      "Detailed feedback on the translation quality, including what needs improvement.",
    ),
  suggestedRevision: z
    .string()
    .optional()
    .describe(
      "An improved version of the translation if the review did not pass.",
    ),
});

export type ReviewResult = z.infer<typeof reviewSchema>;

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? DEFAULT_MODEL);
}

export async function reviewTranslation(params: {
  originalLine: string;
  translatedLine: string;
  translationComments: string;
  fullLyrics: string;
  rhythm: RhythmAnalysis;
  rhyme: RhymeAnalysis;
  previousTranslations: Array<{
    original: string;
    translated: string;
  }>;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
}): Promise<ReviewResult> {
  const model = createModel(params.model);

  const prevContext =
    params.previousTranslations.length > 0
      ? `
===Previously translated lines (check rhyme consistency with these)===
${params.previousTranslations.map((t, i) => `Line ${i + 1}: "${t.original}" → "${t.translated}"`).join("\n")}
===End of previous translations===`
      : "";

  const result = await generateText({
    model,
    output: Output.object({ schema: reviewSchema }),
    system: `You are a strict quality reviewer for song lyric translations. You are a native speaker of ${params.targetLanguage} and an experienced songwriter. You have HIGH standards.

## Review Criteria (ALL must pass)

### 1. Singability (most important)
Read the translated line aloud. Does it flow naturally when sung?
- FAIL if it sounds like a textbook sentence, not a song lyric
- FAIL if word order is awkward or forced to fit a rhyme

### 2. Semantic Coherence
Does the translated line make complete sense on its own?
- FAIL if the phrase is meaningless or nonsensical
- FAIL if the meaning was lost even though individual words were translated correctly

### 3. Natural Word Choice
Does it use words native speakers actually use in songs?
- FAIL if it uses overly literal translations
- FAIL if it reads like machine translation
- FAIL if grammar or word order is unnatural

### 4. Emotional Fidelity
Does the translation capture the same feeling as the original?
- FAIL if the emotion is lost even though words are technically correct

### 5. Cross-line Rhyme Consistency
If the original rhymes with previous lines, the translation must too.
- FAIL if rhyming lines in the original don't rhyme in translation
- FAIL if the same ending word is lazily reused

### 6. Rhythm / Syllable Count
The translation MUST have exactly ${params.rhythm.syllableCount} syllables.
- For CJK: each character = 1 syllable. Count characters carefully.
- FAIL if the count does not match.

Set passed=true ONLY if ALL 6 criteria pass. Be strict.
If the translation fails, provide a suggestedRevision that fixes the issues.`,
    prompt: `## Review This Translation
Original (${params.sourceLanguage}): "${params.originalLine}"
Translation (${params.targetLanguage}): "${params.translatedLine}"

Translator's notes: ${params.translationComments}

Required syllable count: ${params.rhythm.syllableCount}
Stress pattern: ${params.rhythm.stressPattern}
Rhyme words: ${params.rhyme.rhymeWords.join(", ") || "none"}

Full original lyrics:
${params.fullLyrics}
${prevContext}`,
  });

  return result.output!;
}
