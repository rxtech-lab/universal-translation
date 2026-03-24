import type { UIMessageChunk } from "ai";
import type { EntryWithResource } from "@/lib/translation/tools/context-tools";
import type { LyricsTranslationEvent } from "@/lib/translation/lyrics/events";
import type { XclocTranslationEvent } from "@/lib/translation/xcloc/events";

export const TRANSLATION_TASK_QUEUE =
  process.env.TRANSLATION_TASK_QUEUE ?? "translation-tasks";

export const TRANSLATION_EVENTS_EXCHANGE =
  process.env.TRANSLATION_EVENTS_EXCHANGE ?? "translation-events";

export type TranslationWorkerEvent =
  | XclocTranslationEvent
  | LyricsTranslationEvent
  | { type: "stopped"; reason?: string };

export interface TranslateTaskPayload {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  suggestion?: string;
}

export interface ChatTaskPayload {
  messages: unknown[];
}

export type TranslationTask =
  | {
      type: "translate";
      runId: string;
      projectId: string;
      userId: string;
      payload: TranslateTaskPayload;
    }
  | {
      type: "chat";
      runId: string;
      projectId: string;
      userId: string;
      payload: ChatTaskPayload;
    };

interface RunEventBase {
  runId: string;
  projectId: string;
  userId: string;
  seq: number;
  timestamp: string;
}

export interface TranslationRunEvent extends RunEventBase {
  kind: "translation-event";
  payload: TranslationWorkerEvent;
}

export interface ChatRunEvent extends RunEventBase {
  kind: "chat-ui-chunk";
  payload: UIMessageChunk;
}

export type RunEventEnvelope = TranslationRunEvent | ChatRunEvent;

export function routingKeyForRun(runId: string) {
  return `run.${runId}`;
}

export function isTranslationTerminalEvent(event: TranslationWorkerEvent) {
  return (
    event.type === "complete" ||
    event.type === "error" ||
    event.type === "stopped"
  );
}

export function isChatTerminalChunk(chunk: UIMessageChunk) {
  return (
    chunk.type === "finish" || chunk.type === "abort" || chunk.type === "error"
  );
}
