import { createGateway, generateText, Output } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL } from "../config";
import type { RhythmAnalysis } from "./rhythm-agent";
import type { RhymeAnalysis } from "./rhyme-agent";

export const lyricsTranslationSchema = z.object({
  translatedText: z.string().describe("The translated lyrics line."),
  translationComments: z
    .string()
    .describe(
      "Brief notes on the translation choices made (meaning, rhyme, rhythm).",
    ),
});

export type LyricsTranslationResult = z.infer<typeof lyricsTranslationSchema>;

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? DEFAULT_MODEL);
}

export async function translateLyricsLine(params: {
  line: string;
  targetLanguage: string;
  sourceLanguage: string;
  fullLyrics: string;
  rhythm: RhythmAnalysis;
  rhyme: RhymeAnalysis;
  previousTranslations: Array<{
    original: string;
    translated: string;
  }>;
  previousFeedback?: string;
  model?: string;
}): Promise<LyricsTranslationResult> {
  const model = createModel(params.model);

  const prevContext =
    params.previousTranslations.length > 0
      ? `
===Previously translated lines (your translation MUST rhyme with these where the originals rhyme)===
${params.previousTranslations.map((t, i) => `Line ${i + 1}: "${t.original}" → "${t.translated}"`).join("\n")}
===End of previous translations===`
      : "";

  const retryContext = params.previousFeedback
    ? `
## Previous Attempt Feedback
Your previous translation was rejected. Fix these issues:
${params.previousFeedback}`
    : "";

  const result = await generateText({
    model,
    output: Output.object({ schema: lyricsTranslationSchema }),
    system: `You are a professional song lyricist who adapts songs into ${params.targetLanguage}. You don't do word-for-word translation — you write lyrics that a native ${params.targetLanguage} speaker would actually sing.

## Translation Principles (in priority order)
1. **Singability** — The translated line must sound natural when sung aloud. If it sounds awkward or clunky, rewrite it.
2. **Naturalness** — Use idiomatic expressions that native speakers actually use. NEVER translate word-by-word.
3. **Emotional fidelity** — Capture the feeling and intent, not a literal dictionary translation.
4. **Rhyme consistency** — If this line rhymes with other lines in the original, your translation must rhyme with those lines' translations too. But NEVER reuse the same ending word/character as a previous line — use a DIFFERENT word that rhymes.
5. **Rhythm** — Your translation MUST have exactly ${params.rhythm.syllableCount} syllables to fit the original melody. For Chinese/Japanese/Korean, each character = 1 syllable, so count your characters carefully.
6. **Grammar** — The translated line must be grammatically correct and natural.`,
    prompt: `Translate this lyrics line: "${params.line}"

Source language: ${params.sourceLanguage}
Target language: ${params.targetLanguage}
Required syllable count: ${params.rhythm.syllableCount}
Stress pattern: ${params.rhythm.stressPattern}
Rhyme words in original: ${params.rhyme.rhymeWords.join(", ") || "none"}
Related rhyming lines: ${params.rhyme.relatedLineIds.join(", ") || "none"}

Full original lyrics:
${params.fullLyrics}
${prevContext}
${retryContext}

Produce a translation that sounds like it was originally written in ${params.targetLanguage}.`,
  });

  return result.output!;
}
