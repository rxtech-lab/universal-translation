"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { TranslationEditor } from "@/lib/translation/components/translation-editor";
import { XclocEditor } from "@/lib/translation/xcloc/xcloc-editor";
import { useTranslationProject } from "@/lib/translation/components/use-translation-project";
import { useAutoSave } from "@/lib/translation/components/use-auto-save";
import { useTranslationStream } from "@/lib/translation/components/use-translation-stream";
import {
	XclocClient,
	type XclocFormatData,
} from "@/lib/translation/xcloc/client";
import { updateProjectContent } from "@/app/actions/projects";
import { saveProjectTerms } from "@/app/actions/terms";
import type { TranslationProject } from "@/lib/translation/types";
import type { Term } from "@/lib/translation/tools/term-tools";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
	lookupPrevLines: "Looking up previous entries",
	lookupNextLines: "Looking up next entries",
	searchEntries: "Searching entries",
	lookupTerm: "Looking up term",
};

interface EditorClientProps {
	project: {
		id: string;
		name: string;
		formatId: string;
		sourceLanguage: string | null;
		targetLanguage: string | null;
		blobUrl: string | null;
		content: unknown;
		formatData: unknown;
	};
	initialTerms?: Term[];
}

export function EditorClient({
	project: dbProject,
	initialTerms,
}: EditorClientProps) {
	const [client] = useState(() => {
		const c = new XclocClient();
		if (dbProject.content && dbProject.formatData) {
			c.loadFromJson(
				dbProject.content as TranslationProject,
				dbProject.formatData as unknown as XclocFormatData,
				{
					blobUrl: dbProject.blobUrl ?? undefined,
					projectId: dbProject.id,
				},
			);
		}
		return c;
	});

	const { project, updateEntry, applyStreamUpdate, refreshFromClient } =
		useTranslationProject(client);

	const {
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
	} = useTranslationStream(initialTerms);

	const TOAST_ID = "translation-agent";

	const dismissTranslationToast = useCallback(() => {
		toast.dismiss(TOAST_ID);
	}, []);

	const handleAgentTextDelta = useCallback(
		(_batchIndex: number, text: string) => {
			toast.loading("Translating...", {
				id: TOAST_ID,
				description: text,
				duration: Infinity,
				classNames: { description: "!text-foreground" },
			});
		},
		[],
	);

	const handleAgentToolCall = useCallback(
		(
			_batchIndex: number,
			_toolCallId: string,
			toolName: string,
			args: Record<string, unknown>,
		) => {
			const title = TOOL_DISPLAY_NAMES[toolName] ?? toolName;
			const desc = "query" in args ? `${title}: "${args.query}"` : title;
			toast.loading("Translating...", {
				id: TOAST_ID,
				description: desc,
				duration: Infinity,
				classNames: { description: "!text-foreground" },
			});
		},
		[],
	);

	const handleAgentToolResult = useCallback(
		(_batchIndex: number, _toolCallId: string, _toolName: string) => {
			// No-op: the next text delta will update the toast
		},
		[],
	);

	const { markDirty } = useAutoSave({
		onSave: async () => {
			setStatus({ state: "saving" });
			await updateProjectContent(dbProject.id, client.getProject());
			setStatus({ state: "saved", at: new Date() });
		},
		debounceMs: 5000,
	});

	const handleEntryUpdate = useCallback(
		(
			resourceId: string,
			entryId: string,
			update: { targetText?: string; comment?: string },
		) => {
			updateEntry(resourceId, entryId, update);
			markUserEdited(resourceId, entryId);
			markDirty();
		},
		[updateEntry, markUserEdited, markDirty],
	);

	const handleTranslationUpdated = useCallback(
		(resourceId: string, entryId: string, targetText: string) => {
			client.updateEntry(resourceId, entryId, { targetText });
			applyStreamUpdate(resourceId, entryId, { targetText });
			markDirty();
		},
		[client, applyStreamUpdate, markDirty],
	);

	const handleTranslate = useCallback(async () => {
		const flatEntries = project.resources.flatMap((r) =>
			r.entries
				.filter((e) => !e.targetText.trim())
				.map((e) => ({ ...e, resourceId: r.id })),
		);

		if (flatEntries.length === 0) return;

		toast.loading("Translating...", {
			id: TOAST_ID,
			description: "Starting translation...",
			duration: Infinity,
			classNames: { description: "!text-foreground" },
		});

		await startStream({
			projectId: dbProject.id,
			entries: flatEntries,
			sourceLanguage:
				project.sourceLanguage ?? dbProject.sourceLanguage ?? "en",
			targetLanguage:
				project.targetLanguages?.[0] ?? dbProject.targetLanguage ?? "zh-Hans",
			onEntryTranslated: (resourceId, entryId, targetText) => {
				applyStreamUpdate(resourceId, entryId, { targetText });
				client.updateEntry(resourceId, entryId, { targetText });
			},
			onTermsFound: (foundTerms) => {
				setTerms(foundTerms);
				saveProjectTerms(dbProject.id, foundTerms);
			},
			onComplete: () => {
				refreshFromClient();
				dismissTranslationToast();
			},
			onAgentTextDelta: handleAgentTextDelta,
			onAgentToolCall: handleAgentToolCall,
			onAgentToolResult: handleAgentToolResult,
		});
	}, [
		project,
		dbProject,
		startStream,
		applyStreamUpdate,
		client,
		setTerms,
		refreshFromClient,
		dismissTranslationToast,
		handleAgentTextDelta,
		handleAgentToolCall,
		handleAgentToolResult,
	]);

	const handleStopTranslation = useCallback(() => {
		cancelStream();
		toast.info("Translation stopped", { id: TOAST_ID, duration: 2000 });
	}, [cancelStream]);

	const handleClearAllTranslations = useCallback(() => {
		const proj = client.getProject();
		const promise = new Promise<void>((resolve) => {
			for (const resource of proj.resources) {
				for (const entry of resource.entries) {
					if (entry.targetText.trim()) {
						client.updateEntry(resource.id, entry.id, { targetText: "" });
					}
				}
			}
			refreshFromClient();
			markDirty();
			resolve();
		});
		toast.promise(promise, {
			loading: "Clearing translations...",
			success: "All translations cleared",
			error: "Failed to clear translations",
		});
	}, [client, refreshFromClient, markDirty]);

	const handleExport = useCallback(async () => {
		const result = await client.exportFile(terms);
		if (!result.hasError && result.data.blob) {
			const url = URL.createObjectURL(result.data.blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = result.data.fileName;
			a.click();
			URL.revokeObjectURL(url);
		}
	}, [client, terms]);

	const handleSave = useCallback(async () => {
		setStatus({ state: "saving" });
		const result = await client.save();
		if (result.hasError) {
			setStatus({ state: "error", message: result.errorMessage });
		} else {
			setStatus({ state: "saved", at: new Date() });
		}
	}, [client, setStatus]);

	const formatDisplayName =
		dbProject.formatId === "xcloc"
			? "Xcode Localization Catalog"
			: dbProject.formatId;

	return (
		<TranslationEditor
			projectId={dbProject.id}
			projectName={dbProject.name}
			formatId={dbProject.formatId}
			formatDisplayName={formatDisplayName}
			sourceLanguage={dbProject.sourceLanguage ?? undefined}
			targetLanguage={dbProject.targetLanguage ?? undefined}
			status={status}
			errors={errors}
			onClearErrors={clearErrors}
			onTranslate={handleTranslate}
			onStopTranslation={handleStopTranslation}
			onExport={handleExport}
			onSave={handleSave}
			terms={terms}
			onTermsChange={setTerms}
			onTranslationUpdated={handleTranslationUpdated}
			onClearAllTranslations={handleClearAllTranslations}
		>
			<XclocEditor
				project={project}
				onEntryUpdate={handleEntryUpdate}
				streamingEntryIds={streamingEntryIds}
				terms={terms}
			/>
		</TranslationEditor>
	);
}
