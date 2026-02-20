import type { Term } from "../tools/term-tools";

export type LyricsTranslationEvent =
  // Core events (same shape as existing pipeline — compatible with use-translation-stream.ts)
  | { type: "terminology-scan-start" }
  | { type: "terminology-found"; terms: Term[] }
  | { type: "translate-start"; total: number }
  | {
      type: "entry-translated";
      resourceId: string;
      entryId: string;
      targetText: string;
      current: number;
      total: number;
    }
  | { type: "batch-complete"; batchIndex: number; totalBatches: number }
  | { type: "term-resolution-complete" }
  | { type: "complete" }
  | { type: "error"; message: string }
  // Agent streaming (reuse shapes for toast display)
  | { type: "agent-text-delta"; batchIndex: number; text: string }
  | {
      type: "agent-tool-call";
      batchIndex: number;
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "agent-tool-result";
      batchIndex: number;
      toolCallId: string;
      toolName: string;
    }
  // Save events
  | { type: "entries-saved"; batchIndex: number }
  | { type: "save-error"; message: string; batchIndex: number }
  // Lyrics-specific events
  | {
      type: "line-rhythm-analyzed";
      entryId: string;
      syllableCount: number;
      stressPattern: string;
    }
  | {
      type: "line-rhyme-analyzed";
      entryId: string;
      rhymeWords: string[];
      relatedLineIds: string[];
    }
  | {
      type: "line-translation-attempt";
      entryId: string;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: "line-review-result";
      entryId: string;
      passed: boolean;
      feedback: string;
    }
  | { type: "line-complete"; entryId: string; current: number; total: number };
