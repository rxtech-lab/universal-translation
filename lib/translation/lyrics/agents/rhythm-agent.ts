import { createGateway, generateText, Output } from "ai";
import { z } from "zod";
import { ANALYSIS_MODEL } from "../config";

export const rhythmSchema = z.object({
  syllableCount: z
    .number()
    .describe("The total number of syllables in the line."),
  stressPattern: z
    .string()
    .describe(
      "A string of 1s and 0s representing the stress pattern, where 1 is stressed and 0 is unstressed.",
    ),
});

export type RhythmAnalysis = z.infer<typeof rhythmSchema>;

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? ANALYSIS_MODEL);
}

export async function analyzeRhythm(params: {
  line: string;
  fullLyrics: string;
  model?: string;
}): Promise<RhythmAnalysis> {
  const model = createModel(params.model);

  const result = await generateText({
    model,
    output: Output.object({ schema: rhythmSchema }),
    system: `You are an expert in analyzing the rhythm of song lyrics. Analyze the given line and determine:
1. The total syllable count
2. The stress pattern as a sequence of 1s (stressed) and 0s (unstressed)

For CJK languages (Chinese, Japanese, Korean), each character counts as one syllable.
For other languages, count syllables by vowel clusters.

Be precise — the syllable count is critical for matching translations to the original melody.`,
    prompt: `Analyze the rhythm of this lyrics line: "${params.line}"

Full lyrics for context:
${params.fullLyrics}`,
  });

  return result.output!;
}
