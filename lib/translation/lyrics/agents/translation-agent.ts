import { createGateway, generateText, Output, stepCountIs, tool } from "ai";
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

export interface PreviousTranslationModification {
  lineNumber: number;
  newTranslation: string;
  reason: string;
}

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
  userSuggestion?: string;
  model?: string;
}): Promise<
  LyricsTranslationResult & {
    modifications: PreviousTranslationModification[];
  }
> {
  const model = createModel(params.model);
  const modifications: PreviousTranslationModification[] = [];

  // Build rhyme target context — show which specific translations this line must rhyme with
  const rhymeTargets: string[] = [];
  if (params.rhyme.relatedLineIds.length > 0) {
    for (const relId of params.rhyme.relatedLineIds) {
      // relatedLineIds are entry IDs like "line-3"; previousTranslations is indexed by order
      const lineNum = Number.parseInt(relId.replace(/\D/g, ""), 10);
      if (
        !Number.isNaN(lineNum) &&
        lineNum > 0 &&
        lineNum <= params.previousTranslations.length
      ) {
        const prev = params.previousTranslations[lineNum - 1];
        rhymeTargets.push(
          `Line ${lineNum}: "${prev.original}" → "${prev.translated}"`,
        );
      }
    }
  }

  const rhymeTargetContext =
    rhymeTargets.length > 0
      ? `
## CRITICAL: Rhyme Targets
Your translation MUST end-rhyme with these already-translated lines:
${rhymeTargets.join("\n")}
Find the ending sound of these translations and make your line rhyme with them.`
      : "";

  const prevContext =
    params.previousTranslations.length > 0
      ? `
===Previously translated lines===
${params.previousTranslations.map((t, i) => `Line ${i + 1}: "${t.original}" → "${t.translated}"`).join("\n")}
===End of previous translations===`
      : "";

  const retryContext = params.previousFeedback
    ? `
## Previous Attempt Feedback
Your previous translation was rejected. Fix these issues:
${params.previousFeedback}`
    : "";

  const userSuggestionContext = params.userSuggestion
    ? `
## User Direction
The user has provided the following guidance for this specific line. Prioritize this instruction:
${params.userSuggestion}`
    : "";

  const modifyToolSchema = z.object({
    lineNumber: z
      .number()
      .int()
      .min(1)
      .describe(
        "The 1-based line number of the previous translation to modify.",
      ),
    newTranslation: z
      .string()
      .describe("The new translation text for the previous line."),
    reason: z
      .string()
      .describe(
        "Brief explanation of why this modification improves the overall translation.",
      ),
  });

  const modifyPreviousTranslation =
    params.previousTranslations.length > 0
      ? {
          modifyPreviousTranslation: tool({
            description:
              "Modify a previously translated lyrics line to improve rhyme consistency, rhythm, or overall coherence with the current translation. Use this when translating a new line reveals that an earlier line could be improved.",
            inputSchema: modifyToolSchema,
            execute: async ({ lineNumber, newTranslation, reason }) => {
              if (
                lineNumber < 1 ||
                lineNumber > params.previousTranslations.length
              ) {
                return {
                  success: false,
                  error: `Invalid line number ${lineNumber}. Must be between 1 and ${params.previousTranslations.length}.`,
                };
              }

              // Intentionally mutate the shared previousTranslations array so
              // subsequent translations see the updated text.
              const prev = params.previousTranslations[lineNumber - 1];
              prev.translated = newTranslation;
              modifications.push({ lineNumber, newTranslation, reason });

              return {
                success: true,
                lineNumber,
                original: prev.original,
                newTranslation,
              };
            },
          }),
        }
      : undefined;

  const toolsPromptSection = modifyPreviousTranslation
    ? `

## Tools
You have a tool to modify previously translated lines. Use it ONLY when translating the current line reveals that an earlier line's translation should be adjusted for better rhyme consistency or overall coherence. Do not modify previous lines unnecessarily.`
    : "";

  const result = await generateText({
    model,
    output: Output.object({ schema: lyricsTranslationSchema }),
    tools: modifyPreviousTranslation,
    // Allow up to 3 steps: the model may call the modify tool once or twice,
    // then produce its final structured output.
    stopWhen: modifyPreviousTranslation ? stepCountIs(3) : undefined,
    system: `You are a professional song lyricist who adapts songs into ${params.targetLanguage}. You don't do word-for-word translation — you write lyrics that a native ${params.targetLanguage} speaker would actually sing.

## Translation Principles (in priority order)
1. **Singability** — The translated line must sound natural when sung aloud. If it sounds awkward or clunky, rewrite it.
2. **Naturalness** — Use idiomatic expressions that native speakers actually use. NEVER translate word-by-word.
3. **Emotional fidelity** — Capture the feeling and intent, not a literal dictionary translation.
4. **Rhyme consistency** — If this line rhymes with other lines in the original, your translation must rhyme with those lines' translations too. But NEVER reuse the same ending word/character as a previous line — use a DIFFERENT word that rhymes.
5. **Rhythm** — Your translation MUST have exactly ${params.rhythm.syllableCount} syllables to fit the original melody. For Chinese/Japanese/Korean, each character = 1 syllable, so count your characters carefully.
6. **Grammar** — The translated line must be grammatically correct and natural.${toolsPromptSection}`,
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
${rhymeTargetContext}
${retryContext}
${userSuggestionContext}

Produce a translation that sounds like it was originally written in ${params.targetLanguage}.`,
  });

  return { ...result.output!, modifications };
}
