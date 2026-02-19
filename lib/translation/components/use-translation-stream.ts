"use client";

import { useState, useCallback, useRef } from "react";
import type { EditorStatus } from "./types";
import type { Term } from "../tools/term-tools";

export function useTranslationStream(initialTerms?: Term[]) {
	const [status, setStatus] = useState<EditorStatus>({ state: "idle" });
	const [errors, setErrors] = useState<string[]>([]);
	const [terms, setTerms] = useState<Term[]>(initialTerms ?? []);
	const [streamingEntryIds, setStreamingEntryIds] = useState<Set<string>>(
		new Set(),
	);
	const abortRef = useRef<AbortController | null>(null);
	const userEditedIdsRef = useRef<Set<string>>(new Set());

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
			setStreamingEntryIds(new Set());
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

							if (event.type === "translate-start") {
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
									setStreamingEntryIds((prev) => {
										const next = new Set(prev);
										next.add(key);
										return next;
									});
								}
								setStatus((prev) =>
									prev.state === "translating"
										? { ...prev, current: event.current }
										: prev,
								);
							} else if (event.type === "terminology-found") {
								setTerms(event.terms);
								params.onTermsFound?.(event.terms);
							} else if (event.type === "complete") {
								setStatus({ state: "idle" });
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
			}
		},
		[resetUserEdited],
	);

	const cancelStream = useCallback(() => {
		abortRef.current?.abort();
		setStatus({ state: "idle" });
		setStreamingEntryIds(new Set());
	}, []);

	const clearErrors = useCallback(() => setErrors([]), []);

	return {
		status,
		setStatus,
		errors,
		clearErrors,
		terms,
		setTerms,
		streamingEntryIds,
		startStream,
		cancelStream,
		markUserEdited,
	};
}
