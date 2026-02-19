import type { TranslationClient } from "../client";
import type {
	OperationResult,
	TranslationEntry,
	TranslationProject,
	TranslationResource,
	UploadPayload,
	VirtualFileTree,
} from "../types";
import {
	parseContentsJson,
	type XclocContentsJson,
} from "./contents-json";
import type { XclocTranslationEvent } from "./events";
import {
	parseXliff,
	serializeXliff,
	type XliffDocument,
} from "./xliff-parser";
import { zipSync, strToU8 } from "fflate";

export class XclocClient implements TranslationClient<XclocTranslationEvent> {
	private xliffDoc: XliffDocument = { version: "1.2", files: [] };
	private contentsJson: XclocContentsJson | null = null;
	private project: TranslationProject = { resources: [] };
	private originalTree: VirtualFileTree = { files: [] };
	private xliffPath = "";
	private originalFileName = "";

	async load(payload: UploadPayload): Promise<OperationResult> {
		if (payload.kind !== "archive") {
			return {
				hasError: true,
				errorMessage: "XCLOC requires an archive upload",
			};
		}

		this.originalTree = payload.tree;
		this.originalFileName = payload.originalFileName;

		const files = payload.tree.files.filter(
			(f) => !f.path.includes("__MACOSX"),
		);

		// Find contents.json
		const contentsFile = files.find((f) => f.path.endsWith("contents.json"));
		if (!contentsFile) {
			return {
				hasError: true,
				errorMessage: "No contents.json found in xcloc bundle",
			};
		}

		const contentsResult = parseContentsJson(contentsFile.content);
		if (contentsResult.hasError) return contentsResult;
		this.contentsJson = contentsResult.data;

		// Find XLIFF file in Localized Contents/
		const xliffFile = files.find(
			(f) =>
				f.path.includes("Localized Contents/") && f.path.endsWith(".xliff"),
		);
		if (!xliffFile) {
			return {
				hasError: true,
				errorMessage:
					"No XLIFF file found in Localized Contents/ directory",
			};
		}

		this.xliffPath = xliffFile.path;
		const xliffXml = new TextDecoder().decode(xliffFile.content);
		this.xliffDoc = parseXliff(xliffXml);

		// Normalize into TranslationProject
		const resources: TranslationResource[] = this.xliffDoc.files.map(
			(file) => ({
				id: file.original,
				label: file.original.split("/").pop() ?? file.original,
				sourceLanguage: file.sourceLanguage,
				targetLanguage: file.targetLanguage,
				entries: file.transUnits.map((tu) => ({
					id: tu.id,
					sourceText: tu.source,
					targetText: tu.target ?? "",
					comment: tu.note,
					metadata: {
						fileOriginal: file.original,
					},
				})),
			}),
		);

		this.project = {
			resources,
			sourceLanguage: this.contentsJson.developmentRegion,
			targetLanguages: [this.contentsJson.targetLocale],
			metadata: {
				project: this.contentsJson.project,
				toolInfo: this.contentsJson.toolInfo,
			},
		};

		return { hasError: false, data: undefined };
	}

	getProject(): TranslationProject {
		return this.project;
	}

	getResource(resourceId: string): TranslationResource | undefined {
		return this.project.resources.find((r) => r.id === resourceId);
	}

	getSourceLanguage(): string | undefined {
		return this.project.sourceLanguage;
	}

	getTargetLanguages(): string[] {
		return this.project.targetLanguages ?? [];
	}

	updateEntry(
		resourceId: string,
		entryId: string,
		update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
	): OperationResult {
		const resource = this.project.resources.find((r) => r.id === resourceId);
		if (!resource) {
			return {
				hasError: true,
				errorMessage: `Resource not found: ${resourceId}`,
			};
		}

		const entry = resource.entries.find((e) => e.id === entryId);
		if (!entry) {
			return {
				hasError: true,
				errorMessage: `Entry not found: ${entryId}`,
			};
		}

		if (update.targetText !== undefined) entry.targetText = update.targetText;
		if (update.comment !== undefined) entry.comment = update.comment;

		// Keep xliffDoc in sync
		this.syncToXliff(resourceId, entryId, update);

		return { hasError: false, data: undefined };
	}

	updateEntries(
		updates: Array<{
			resourceId: string;
			entryId: string;
			update: Partial<Pick<TranslationEntry, "targetText" | "comment">>;
		}>,
	): OperationResult {
		for (const u of updates) {
			const result = this.updateEntry(u.resourceId, u.entryId, u.update);
			if (result.hasError) return result;
		}
		return { hasError: false, data: undefined };
	}

	async *translate(options: {
		model?: string;
		projectId: string;
	}): AsyncGenerator<XclocTranslationEvent> {
		// Delegated to agent.ts — will be wired up later
		const { translateProject } = await import("./agent");
		yield* translateProject({
			client: this,
			projectId: options.projectId,
			model: options.model,
		});
	}

	render(): React.ReactNode {
		return null;
	}

	async exportFile(): Promise<
		OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
	> {
		// Serialize XLIFF back to XML
		const xliffXml = serializeXliff(this.xliffDoc);
		const xliffBytes = strToU8(xliffXml);

		// Build zip entries from original tree, replacing the XLIFF
		const zipEntries: Record<string, Uint8Array> = {};

		for (const file of this.originalTree.files) {
			// Skip __MACOSX entries and directories
			if (file.path.includes("__MACOSX")) continue;

			if (file.path === this.xliffPath) {
				zipEntries[file.path] = xliffBytes;
			} else {
				zipEntries[file.path] = file.content;
			}
		}

		const zipped = zipSync(zipEntries);
		const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
		const fileName = this.originalFileName || "translated.xcloc.zip";

		return {
			hasError: false,
			data: { blob, fileName },
		};
	}

	async save(): Promise<OperationResult<{ projectId: string }>> {
		// TODO: implement database persistence
		return { hasError: false, data: { projectId: "" } };
	}

	async open(_projectId: string): Promise<OperationResult> {
		// TODO: implement database restore
		return { hasError: false, data: undefined };
	}

	// ---- Internal helpers ----------------------------------------

	private syncToXliff(
		resourceId: string,
		entryId: string,
		update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
	): void {
		const xliffFile = this.xliffDoc.files.find(
			(f) => f.original === resourceId,
		);
		if (!xliffFile) return;

		const tu = xliffFile.transUnits.find((t) => t.id === entryId);
		if (!tu) return;

		if (update.targetText !== undefined) tu.target = update.targetText;
		if (update.comment !== undefined) tu.note = update.comment;
	}
}
