import { createGateway, generateText, Output } from "ai";
import { z } from "zod";
import { ANALYSIS_MODEL } from "../config";

export const rhymeSchema = z.object({
  rhymeWords: z
    .array(z.string())
    .describe(
      "The last word (or last few words) of this line that carry the end-rhyme sound. Usually just one word. Return empty array if the line has no clear rhyme role.",
    ),
  relatedLineIds: z
    .array(z.string())
    .describe(
      "IDs of other lines whose ending sound rhymes with this line's ending sound. Only include lines that share a matching end-rhyme. Return empty array if no other line rhymes.",
    ),
});

export type RhymeAnalysis = z.infer<typeof rhymeSchema>;

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? ANALYSIS_MODEL);
}

export async function analyzeRhyme(params: {
  currentLine: { id: string; text: string };
  allLines: Array<{ id: string; text: string }>;
  fullLyrics: string;
  model?: string;
}): Promise<RhymeAnalysis> {
  const model = createModel(params.model);

  const lineList = params.allLines
    .map((l) => `[id="${l.id}"] ${l.text}`)
    .join("\n");

  const result = await generateText({
    model,
    output: Output.object({ schema: rhymeSchema }),
    system: `You are an expert in analyzing rhyme patterns in song lyrics.

Your task: identify the END-RHYME relationship for a given line.

Rules:
- "rhymeWords" = the last word(s) of THIS line that carry the rhyme sound. Usually just the final word.
- "relatedLineIds" = IDs of OTHER lines whose final word(s) share a matching end-rhyme sound with this line.
- Only count true end-rhymes: the ending sounds must actually match (e.g. "time" / "rhyme", "chance" / "dance").
- Do NOT pair words that merely look similar but sound different (e.g. "lifetime" does NOT rhyme with "chance").
- Slant rhymes are acceptable only if the vowel sounds are very close (e.g. "home" / "bone").
- If the line has no rhyme partner in the lyrics, return empty arrays.
- For CJK languages, match by final vowel/tone sounds.`,
    prompt: `Analyze the rhyme of this line:
Current line [id="${params.currentLine.id}"]: "${params.currentLine.text}"

All lines:
${lineList}

Full lyrics:
${params.fullLyrics}`,
  });

  return result.output!;
}
