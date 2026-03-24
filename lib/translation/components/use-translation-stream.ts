"use client";

import { useCallback, useRef, useState } from "react";
import type { Term } from "../tools/term-tools";
import type { EditorStatus } from "./types";

export interface LyricsAnalysis {
  syllableCount?: number;
  stressPattern?: string;
  rhymeWords?: string[];
  relatedLineIds?: string[];
  relatedRhymeWords?: Record<string, string[]>;
  reviewPassed?: boolean;
  reviewFeedback?: string;
}

interface StreamConnectionParams {
  projectId: string;
  onEntryTranslated: (
    resourceId: string,
    entryId: string,
    targetText: string,
  ) => void;
  onTermsFound?: (terms: Term[]) => void;
  onComplete?: () => void;
  onError?: (message: string) => void;
  onAgentTextDelta?: (batchIndex: number, text: string) => void;
  onAgentToolCall?: (
    batchIndex: number,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => void;
  onAgentToolResult?: (
    batchIndex: number,
    toolCallId: string,
    toolName: string,
  ) => void;
}

interface StartStreamParams extends StreamConnectionParams {
  entries: Array<{
    id: string;
    sourceText: string;
    targetText: string;
    comment?: string;
    resourceId: string;
  }>;
  sourceLanguage: string;
  targetLanguage: string;
  suggestion?: string;
}

export function useTranslationStream() {
  const [status, setStatus] = useState<EditorStatus>({ state: "idle" });
  const [errors, setErrors] = useState<string[]>([]);
  const [streamingEntryIds, setStreamingEntryIds] = useState<Set<string>>(
    new Set(),
  );
  const [lyricsAnalysis, setLyricsAnalysis] = useState<
    Map<string, LyricsAnalysis>
  >(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const userEditedIdsRef = useRef<Set<string>>(new Set());
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  /** Mark an entry as user-edited so stream updates won't overwrite it. */
  const markUserEdited = useCallback((resourceId: string, entryId: string) => {
    userEditedIdsRef.current.add(`${resourceId}:${entryId}`);
  }, []);

  /** Reset the user-edited set (e.g. when starting a new translation). */
  const resetUserEdited = useCallback(() => {
    userEditedIdsRef.current.clear();
  }, []);

  const connectToRun = useCallback(
    async (params: StreamConnectionParams, runId: string) => {
      activeRunIdRef.current = runId;
      activeProjectIdRef.current = params.projectId;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const source = new EventSource(
          `/api/translate/${params.projectId}/stream?runId=${encodeURIComponent(
            runId,
          )}`,
        );
        eventSourceRef.current = source;

        const finish = () => {
          if (settled) return;
          settled = true;
          if (eventSourceRef.current === source) {
            eventSourceRef.current = null;
          }
          activeRunIdRef.current = null;
          activeProjectIdRef.current = null;
          source.close();
          resolve();
        };

        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          if (eventSourceRef.current === source) {
            eventSourceRef.current = null;
          }
          activeRunIdRef.current = null;
          activeProjectIdRef.current = null;
          source.close();
          params.onError?.(message);
          reject(new Error(message));
        };

        source.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data);

            if (event.type === "translate-line-start") {
              const key = `${event.resourceId}:${event.entryId}`;
              setStreamingEntryIds((prev) => {
                const next = new Set(prev);
                next.add(key);
                return next;
              });
            } else if (event.type === "translate-start") {
              setStatus({
                state: "translating",
                current: 0,
                total: event.total,
              });
            } else if (event.type === "entry-translated") {
              const key = `${event.resourceId}:${event.entryId}`;
              if (!userEditedIdsRef.current.has(key)) {
                params.onEntryTranslated(
                  event.resourceId,
                  event.entryId,
                  event.targetText,
                );
                const existing = highlightTimersRef.current.get(key);
                if (existing) clearTimeout(existing);
                highlightTimersRef.current.set(
                  key,
                  setTimeout(() => {
                    highlightTimersRef.current.delete(key);
                    setStreamingEntryIds((prev) => {
                      const next = new Set(prev);
                      next.delete(key);
                      return next;
                    });
                  }, 5000),
                );
              }
              setStatus((prev) =>
                prev.state === "translating"
                  ? { ...prev, current: event.current }
                  : prev,
              );
            } else if (event.type === "previous-translation-modified") {
              const key = `${event.resourceId}:${event.entryId}`;
              if (!userEditedIdsRef.current.has(key)) {
                params.onEntryTranslated(
                  event.resourceId,
                  event.entryId,
                  event.targetText,
                );
              }
            } else if (event.type === "terminology-found") {
              params.onTermsFound?.(event.terms);
            } else if (event.type === "complete") {
              setStatus({ state: "idle" });
              for (const timer of highlightTimersRef.current.values()) {
                clearTimeout(timer);
              }
              highlightTimersRef.current.clear();
              setStreamingEntryIds(new Set());
              params.onComplete?.();
              finish();
            } else if (event.type === "stopped") {
              setStatus({ state: "idle" });
              for (const timer of highlightTimersRef.current.values()) {
                clearTimeout(timer);
              }
              highlightTimersRef.current.clear();
              setStreamingEntryIds(new Set());
              finish();
            } else if (event.type === "save-error") {
              setErrors((prev) => [
                ...prev,
                `Save failed (batch ${event.batchIndex + 1}): ${event.message}`,
              ]);
            } else if (event.type === "error") {
              setErrors((prev) => [...prev, event.message]);
              setStatus({ state: "error", message: event.message });
              params.onError?.(event.message);
              finish();
            } else if (event.type === "agent-text-delta") {
              params.onAgentTextDelta?.(event.batchIndex, event.text);
            } else if (event.type === "agent-tool-call") {
              params.onAgentToolCall?.(
                event.batchIndex,
                event.toolCallId,
                event.toolName,
                event.args,
              );
            } else if (event.type === "agent-tool-result") {
              params.onAgentToolResult?.(
                event.batchIndex,
                event.toolCallId,
                event.toolName,
              );
            } else if (event.type === "line-rhythm-analyzed") {
              setLyricsAnalysis((prev) => {
                const next = new Map(prev);
                const existing = next.get(event.entryId) ?? {};
                next.set(event.entryId, {
                  ...existing,
                  syllableCount: event.syllableCount,
                  stressPattern: event.stressPattern,
                });
                return next;
              });
            } else if (event.type === "line-rhyme-analyzed") {
              setLyricsAnalysis((prev) => {
                const next = new Map(prev);
                const existing = next.get(event.entryId) ?? {};
                next.set(event.entryId, {
                  ...existing,
                  rhymeWords: event.rhymeWords,
                  relatedLineIds: event.relatedLineIds,
                  relatedRhymeWords: event.relatedRhymeWords,
                });
                return next;
              });
            } else if (event.type === "line-review-result") {
              setLyricsAnalysis((prev) => {
                const next = new Map(prev);
                const existing = next.get(event.entryId) ?? {};
                next.set(event.entryId, {
                  ...existing,
                  reviewPassed: event.passed,
                  reviewFeedback: event.feedback,
                });
                return next;
              });
            }
          } catch {
            // skip malformed lines
          }
        };

        source.onerror = () => {
          if (source.readyState === EventSource.CLOSED && !settled) {
            fail("Translation stream disconnected");
          }
        };
      });
    },
    [],
  );

  const startStream = useCallback(
    async (params: StartStreamParams) => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      activeRunIdRef.current = null;
      activeProjectIdRef.current = null;

      resetUserEdited();
      for (const timer of highlightTimersRef.current.values()) {
        clearTimeout(timer);
      }
      highlightTimersRef.current.clear();
      setStreamingEntryIds(new Set());
      // Only clear analysis for entries being (re)translated, preserve others
      setLyricsAnalysis((prev) => {
        const next = new Map(prev);
        for (const entry of params.entries) {
          next.delete(entry.id);
        }
        return next;
      });
      setErrors([]);
      setStatus({
        state: "translating",
        current: 0,
        total: params.entries.length,
      });

      try {
        const response = await fetch(`/api/translate/${params.projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: params.entries,
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.targetLanguage,
            suggestion: params.suggestion,
          }),
        });

        if (!response.ok) {
          setStatus({
            state: "error",
            message: "Failed to start translation",
          });
          return;
        }

        const data = (await response.json()) as {
          queued?: boolean;
          runId?: string;
        };
        if (!data.queued || !data.runId) {
          setStatus({
            state: "error",
            message: "Failed to queue translation",
          });
          return;
        }

        await connectToRun(params, data.runId);
      } catch (err) {
        setStatus({ state: "error", message: String(err) });
      } finally {
        if (
          eventSourceRef.current === null &&
          activeRunIdRef.current === null
        ) {
          setStreamingEntryIds(new Set());
        }
      }
    },
    [connectToRun, resetUserEdited],
  );

  const resumeStream = useCallback(
    async (params: StreamConnectionParams & { runId: string }) => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      activeRunIdRef.current = null;
      activeProjectIdRef.current = null;

      setErrors([]);
      setStatus((prev) =>
        prev.state === "translating"
          ? prev
          : { state: "translating", current: 0, total: 0 },
      );

      try {
        await connectToRun(params, params.runId);
      } catch (err) {
        setStatus({ state: "error", message: String(err) });
      }
    },
    [connectToRun],
  );

  const cancelStream = useCallback(() => {
    const runId = activeRunIdRef.current;
    const projectId = activeProjectIdRef.current;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    activeRunIdRef.current = null;
    activeProjectIdRef.current = null;

    if (runId && projectId) {
      fetch(`/api/translate/${projectId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      }).catch(() => undefined);
    }

    for (const timer of highlightTimersRef.current.values()) {
      clearTimeout(timer);
    }
    highlightTimersRef.current.clear();
    setStatus({ state: "idle" });
    setStreamingEntryIds(new Set());
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  const clearLyricsAnalysis = useCallback(
    () => setLyricsAnalysis(new Map()),
    [],
  );

  const clearEntryAnalysis = useCallback((entryId: string) => {
    setLyricsAnalysis((prev) => {
      if (!prev.has(entryId)) return prev;
      const next = new Map(prev);
      next.delete(entryId);
      return next;
    });
  }, []);

  return {
    status,
    setStatus,
    errors,
    clearErrors,
    streamingEntryIds,
    lyricsAnalysis,
    clearLyricsAnalysis,
    clearEntryAnalysis,
    startStream,
    resumeStream,
    cancelStream,
    markUserEdited,
  };
}
