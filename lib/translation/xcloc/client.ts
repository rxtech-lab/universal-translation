import { strToU8, unzipSync, zipSync } from "fflate";
import type { TranslationClient } from "../client";
import type { Term } from "../tools/term-tools";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
  VirtualFileTree,
} from "../types";
import { resolveTermTemplates } from "./agent";
import { parseContentsJson, type XclocContentsJson } from "./contents-json";
import type { XclocTranslationEvent } from "./events";
import { parseXliff, serializeXliff, type XliffDocument } from "./xliff-parser";

/** Shape of the format-specific data stored in the DB. */
export interface XclocFormatData {
  xliffDoc: XliffDocument;
  contentsJson: XclocContentsJson;
  xliffPath: string;
  originalFileName: string;
}

export class XclocClient implements TranslationClient<XclocTranslationEvent> {
  private xliffDoc: XliffDocument = { version: "1.2", files: [] };
  private contentsJson: XclocContentsJson | null = null;
  private project: TranslationProject = { resources: [] };
  private originalTree: VirtualFileTree = { files: [] };
  private xliffPath = "";
  private originalFileName = "";
  private blobUrl: string | null = null;
  private projectId: string | null = null;

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
        errorMessage: "No XLIFF file found in Localized Contents/ directory",
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

  /**
   * Load from DB-stored JSON content instead of a file payload.
   * Used when opening an existing project from the database.
   */
  loadFromJson(
    content: TranslationProject,
    formatData: XclocFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.xliffDoc = formatData.xliffDoc;
    this.contentsJson = formatData.contentsJson;
    this.xliffPath = formatData.xliffPath;
    this.originalFileName = formatData.originalFileName;
    this.blobUrl = opts?.blobUrl ?? null;
    this.projectId = opts?.projectId ?? null;
    return { hasError: false, data: undefined };
  }

  /** Get the format-specific data needed for DB persistence. */
  getFormatData(): XclocFormatData {
    return {
      xliffDoc: this.xliffDoc,
      contentsJson: this.contentsJson ?? {
        developmentRegion: this.project.sourceLanguage ?? "en",
        targetLocale: this.project.targetLanguages?.[0] ?? "",
        toolInfo: {
          toolBuildNumber: "",
          toolID: "",
          toolName: "",
          toolVersion: "",
        },
        version: "1.0",
        project: "",
      },
      xliffPath: this.xliffPath,
      originalFileName: this.originalFileName,
    };
  }

  /** Get the blob URL for the original uploaded file. */
  getBlobUrl(): string | null {
    return this.blobUrl;
  }

  async exportFile(
    terms?: Term[],
  ): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  > {
    // Resolve term templates in a clone before serializing
    let docToSerialize = this.xliffDoc;
    if (terms && terms.length > 0) {
      const termsMap = new Map(terms.map((t) => [t.id, t]));
      docToSerialize = structuredClone(this.xliffDoc);
      for (const file of docToSerialize.files) {
        for (const tu of file.transUnits) {
          if (tu.target) {
            tu.target = resolveTermTemplates(tu.target, termsMap);
          }
        }
      }
    }

    // Serialize XLIFF back to XML
    const xliffXml = serializeXliff(docToSerialize);
    const xliffBytes = strToU8(xliffXml);

    // If we have the original tree in memory, use it directly
    if (this.originalTree.files.length > 0) {
      return this.buildExportZip(xliffBytes);
    }

    // Otherwise download the original blob and reconstruct
    if (this.blobUrl) {
      try {
        const response = await fetch(this.blobUrl);
        const buffer = new Uint8Array(await response.arrayBuffer());
        const entries = unzipSync(buffer);

        const zipEntries: Record<string, Uint8Array> = {};
        for (const [path, content] of Object.entries(entries)) {
          if (path.endsWith("/") || path.includes("__MACOSX")) continue;
          if (path === this.xliffPath) {
            zipEntries[path] = xliffBytes;
          } else {
            zipEntries[path] = content;
          }
        }

        const zipped = zipSync(zipEntries);
        const blob = new Blob([zipped.buffer as ArrayBuffer], {
          type: "application/zip",
        });
        const fileName = this.originalFileName || "translated.xcloc.zip";

        return { hasError: false, data: { blob, fileName } };
      } catch (err) {
        return {
          hasError: true,
          errorMessage: `Failed to download original file: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Fallback: build from xliff only (no other bundle files)
    return this.buildExportZip(xliffBytes);
  }

  async save(): Promise<OperationResult<{ projectId: string }>> {
    if (!this.projectId) {
      return {
        hasError: true,
        errorMessage: "No project ID set. Save via server action instead.",
      };
    }

    const { updateProjectContent, updateProjectFormatData } = await import(
      "@/app/actions/projects"
    );
    await updateProjectContent(this.projectId, this.project);
    await updateProjectFormatData(
      this.projectId,
      this.getFormatData() as unknown as Record<string, unknown>,
    );

    return { hasError: false, data: { projectId: this.projectId } };
  }

  async open(openProjectId: string): Promise<OperationResult> {
    const { getProject } = await import("@/app/actions/projects");
    const dbProject = await getProject(openProjectId);
    if (!dbProject) {
      return { hasError: true, errorMessage: "Project not found" };
    }

    const content = dbProject.content as TranslationProject | null;
    const formatData =
      dbProject.formatData as unknown as XclocFormatData | null;

    if (!content || !formatData) {
      return {
        hasError: true,
        errorMessage: "Project has no content data",
      };
    }

    return this.loadFromJson(content, formatData, {
      blobUrl: dbProject.blobUrl ?? undefined,
      projectId: openProjectId,
    });
  }

  // ---- Internal helpers ----------------------------------------

  private buildExportZip(
    xliffBytes: Uint8Array,
  ): OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }> {
    const zipEntries: Record<string, Uint8Array> = {};

    for (const file of this.originalTree.files) {
      if (file.path.includes("__MACOSX")) continue;
      if (file.path === this.xliffPath) {
        zipEntries[file.path] = xliffBytes;
      } else {
        zipEntries[file.path] = file.content;
      }
    }

    // If no original tree files, at least include the XLIFF
    if (Object.keys(zipEntries).length === 0 && this.xliffPath) {
      zipEntries[this.xliffPath] = xliffBytes;
    }

    const zipped = zipSync(zipEntries);
    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: "application/zip",
    });
    const fileName = this.originalFileName || "translated.xcloc.zip";

    return { hasError: false, data: { blob, fileName } };
  }

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
