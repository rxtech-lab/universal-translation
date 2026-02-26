import type { TranslationClient } from "../client";
import type { Term } from "../tools/term-tools";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
} from "../types";
import { resolveTermTemplates } from "./agent";
import type { VttTranslationEvent } from "./events";
import { parseVtt, type VttCue, serializeVtt } from "./parser";

/** Shape of the format-specific data stored in the DB. */
export interface VttFormatData {
  cues: VttCue[];
  header: string;
  originalFileName: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class VttClient implements TranslationClient<VttTranslationEvent> {
  private cues: VttCue[] = [];
  private header = "WEBVTT";
  private project: TranslationProject = { resources: [] };
  private sourceLanguage = "";
  private targetLanguage = "";
  private originalFileName = "";
  private blobUrl: string | null = null;
  private projectId: string | null = null;

  async load(payload: UploadPayload): Promise<OperationResult> {
    if (payload.kind !== "single-file") {
      return {
        hasError: true,
        errorMessage: "WebVTT requires a single file upload",
      };
    }

    this.originalFileName = payload.file.name;
    const text = await payload.file.text();
    const result = parseVtt(text);
    this.cues = result.cues;
    this.header = result.header;

    if (this.cues.length === 0) {
      return {
        hasError: true,
        errorMessage: "No valid subtitle cues found in the WebVTT file",
      };
    }

    this.buildProject();
    return { hasError: false, data: undefined };
  }

  /** Set source and target languages (called after user selects languages). */
  setLanguages(sourceLanguage: string, targetLanguage: string): void {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.project.sourceLanguage = sourceLanguage;
    this.project.targetLanguages = [targetLanguage];
    for (const resource of this.project.resources) {
      resource.sourceLanguage = sourceLanguage;
      resource.targetLanguage = targetLanguage;
    }
  }

  getProject(): TranslationProject {
    return this.project;
  }

  getResource(resourceId: string): TranslationResource | undefined {
    return this.project.resources.find((r) => r.id === resourceId);
  }

  getSourceLanguage(): string | undefined {
    return this.sourceLanguage || undefined;
  }

  getTargetLanguages(): string[] {
    return this.targetLanguage ? [this.targetLanguage] : [];
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
  }): AsyncGenerator<VttTranslationEvent> {
    const { translateVttEntries } = await import("./agent");
    const allEntries = this.project.resources.flatMap((r) =>
      r.entries.map((e) => ({ ...e, resourceId: r.id })),
    );
    yield* translateVttEntries({
      entries: allEntries,
      sourceLanguage: this.sourceLanguage || "en",
      targetLanguage: this.targetLanguage || "zh-Hans",
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
    formatData: VttFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.cues = formatData.cues;
    this.header = formatData.header;
    this.originalFileName = formatData.originalFileName;
    this.sourceLanguage = formatData.sourceLanguage;
    this.targetLanguage = formatData.targetLanguage;
    this.blobUrl = opts?.blobUrl ?? null;
    this.projectId = opts?.projectId ?? null;
    return { hasError: false, data: undefined };
  }

  /** Get the format-specific data needed for DB persistence. */
  getFormatData(): VttFormatData {
    return {
      cues: this.cues,
      header: this.header,
      originalFileName: this.originalFileName,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
    };
  }

  async exportFile(
    terms?: Term[],
  ): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  > {
    const resource = this.project.resources[0];
    if (!resource) {
      return {
        hasError: true,
        errorMessage: "No resource found to export",
      };
    }

    // Build translated cues from the source cues + translated entries
    const translatedCues: VttCue[] = this.cues.map((cue) => {
      const entry = resource.entries.find((e) => e.id === String(cue.index));
      let text = entry?.targetText || cue.text;

      // Resolve term templates if terms are provided
      if (terms && terms.length > 0 && text) {
        const termsMap = new Map(terms.map((t) => [t.slug, t]));
        text = resolveTermTemplates(text, termsMap);
      }

      return { ...cue, text };
    });

    const vttContent = serializeVtt(this.header, translatedCues);
    const blob = new Blob([vttContent], { type: "text/vtt;charset=utf-8" });
    const baseName = this.originalFileName.replace(/\.vtt$/i, "");
    const fileName = `${baseName}_${this.targetLanguage || "translated"}.vtt`;

    return { hasError: false, data: { blob, fileName } };
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
    const formatData = dbProject.formatData as unknown as VttFormatData | null;

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

  private buildProject(): void {
    const entries: TranslationEntry[] = this.cues.map((cue) => ({
      id: String(cue.index),
      sourceText: cue.text,
      targetText: "",
      metadata: {
        startTimestamp: cue.startTimestamp,
        endTimestamp: cue.endTimestamp,
        cueIndex: cue.index,
        cueId: cue.id,
      },
    }));

    const resource: TranslationResource = {
      id: "vtt-main",
      label: this.originalFileName || "Subtitles",
      entries,
      sourceLanguage: this.sourceLanguage || undefined,
      targetLanguage: this.targetLanguage || undefined,
    };

    this.project = {
      resources: [resource],
      sourceLanguage: this.sourceLanguage || undefined,
      targetLanguages: this.targetLanguage ? [this.targetLanguage] : undefined,
    };
  }
}
