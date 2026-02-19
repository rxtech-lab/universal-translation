import type { Term } from "../tools/term-tools";

export type XclocTranslationEvent =
  | { type: "terminology-scan-start" }
  | {
      type: "terminology-found";
      terms: Term[];
    }
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
  | { type: "entries-saved"; batchIndex: number }
  | { type: "save-error"; message: string; batchIndex: number }
  | {
      type: "agent-text-delta";
      batchIndex: number;
      text: string;
    }
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
  | { type: "complete" }
  | { type: "error"; message: string };
