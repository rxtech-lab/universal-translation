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
  relatedRhymeWords: z
    .record(z.string(), z.array(z.string()))
    .describe(
      'For each related line ID, the rhyme-carrying word(s) from THAT line. Key = line ID, value = array of rhyme words from that line. E.g. { "line-4": ["dance"] }.',
    ),
});

export type RhymeAnalysis = z.infer<typeof rhymeSchema>;

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? ANALYSIS_MODEL);
}

/** Max distance (in lines) to look for rhyme partners. */
const RHYME_WINDOW = 8;

export async function analyzeRhyme(params: {
  currentLine: { id: string; text: string };
  allLines: Array<{ id: string; text: string }>;
  fullLyrics: string;
  model?: string;
}): Promise<RhymeAnalysis> {
  const model = createModel(params.model);

  // Only consider nearby lines for rhyme matching
  const currentIdx = params.allLines.findIndex(
    (l) => l.id === params.currentLine.id,
  );
  const start = Math.max(0, currentIdx - RHYME_WINDOW);
  const end = Math.min(params.allLines.length, currentIdx + RHYME_WINDOW + 1);
  const nearbyLines = params.allLines
    .slice(start, end)
    .filter((l) => l.id !== params.currentLine.id);

  const lineList = nearbyLines
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
- "relatedRhymeWords" = for each related line ID, the rhyme-carrying word(s) from THAT line. Example: if this line ends with "chance" and line-4 ends with "dance", return { "line-4": ["dance"] }.
- Only count true end-rhymes: the ending sounds must actually match (e.g. "time" / "rhyme", "chance" / "dance").
- Do NOT pair words that merely look similar but sound different (e.g. "lifetime" does NOT rhyme with "chance").
- Slant rhymes are acceptable only if the vowel sounds are very close (e.g. "home" / "bone").
- Only consider NEARBY lines (within a few lines). Rhyme partners in songs are almost always adjacent or within the same verse/stanza.
- If the line has no rhyme partner among the nearby lines, return empty arrays.
- For CJK languages, match by final vowel/tone sounds.`,
    prompt: `Analyze the rhyme of this line:
Current line [id="${params.currentLine.id}"]: "${params.currentLine.text}"

Nearby lines (only consider these for rhyme matching):
${lineList}

Full lyrics for context:
${params.fullLyrics}`,
  });

  return result.output!;
}
