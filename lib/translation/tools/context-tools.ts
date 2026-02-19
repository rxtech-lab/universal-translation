import { tool } from "ai";
import { z } from "zod";
import type { TranslationEntry } from "../types";

export interface EntryWithResource extends TranslationEntry {
  resourceId: string;
}

export function createContextTools(allEntries: EntryWithResource[]) {
  return {
    lookupPrevLines: tool({
      description:
        "Look up the previous N translation entries before the current position for context. Returns source text and any existing translations.",
      inputSchema: z.object({
        currentIndex: z
          .number()
          .describe("Index of the current entry in the full list"),
        count: z
          .number()
          .default(5)
          .describe("Number of previous entries to retrieve"),
      }),
      execute: async ({ currentIndex, count }) => {
        const start = Math.max(0, currentIndex - count);
        return allEntries.slice(start, currentIndex).map((e, i) => ({
          index: start + i,
          id: e.id,
          sourceText: e.sourceText,
          targetText: e.targetText || "(not yet translated)",
        }));
      },
    }),

    lookupNextLines: tool({
      description:
        "Look up the next N translation entries after the current position for forward context.",
      inputSchema: z.object({
        currentIndex: z
          .number()
          .describe("Index of the current entry in the full list"),
        count: z
          .number()
          .default(5)
          .describe("Number of next entries to retrieve"),
      }),
      execute: async ({ currentIndex, count }) => {
        const start = currentIndex + 1;
        return allEntries.slice(start, start + count).map((e, i) => ({
          index: start + i,
          id: e.id,
          sourceText: e.sourceText,
        }));
      },
    }),

    searchEntries: tool({
      description:
        "Search all translation entries by source text content. Returns up to 10 matching entries.",
      inputSchema: z.object({
        query: z.string().describe("Search text to find in source entries"),
      }),
      execute: async ({ query }) => {
        const lowerQuery = query.toLowerCase();
        return allEntries
          .filter((e) => e.sourceText.toLowerCase().includes(lowerQuery))
          .slice(0, 10)
          .map((e) => ({
            index: allEntries.indexOf(e),
            id: e.id,
            sourceText: e.sourceText,
            targetText: e.targetText || "(not yet translated)",
            resourceId: e.resourceId,
          }));
      },
    }),
  };
}
