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

export function useTranslationStream() {
  const [status, setStatus] = useState<EditorStatus>({ state: "idle" });
  const [errors, setErrors] = useState<string[]>([]);
  const [streamingEntryIds, setStreamingEntryIds] = useState<Set<string>>(
    new Set(),
  );
  const [lyricsAnalysis, setLyricsAnalysis] = useState<
    Map<string, LyricsAnalysis>
  >(new Map());
  const abortRef = useRef<AbortController | null>(null);
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

  const startStream = useCallback(
    async (params: {
      projectId: string;
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
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setStatus({
            state: "error",
            message: "Failed to start translation",
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            if (json === "[DONE]") continue;

            try {
              const event = JSON.parse(json);

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
                // Skip if user has manually edited this entry
                if (!userEditedIdsRef.current.has(key)) {
                  params.onEntryTranslated(
                    event.resourceId,
                    event.entryId,
                    event.targetText,
                  );
                  // Remove highlight after 5 seconds
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
              } else if (event.type === "save-error") {
                setErrors((prev) => [
                  ...prev,
                  `Save failed (batch ${event.batchIndex + 1}): ${event.message}`,
                ]);
              } else if (event.type === "error") {
                setErrors((prev) => [...prev, event.message]);
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
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStatus({ state: "error", message: String(err) });
        }
      } finally {
        // Ensure we never leave status stuck at "translating"
        setStatus((prev) =>
          prev.state === "translating" ? { state: "idle" } : prev,
        );
        setStreamingEntryIds(new Set());
      }
    },
    [resetUserEdited],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
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
    cancelStream,
    markUserEdited,
  };
}
