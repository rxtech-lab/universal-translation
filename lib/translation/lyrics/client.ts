import type { TranslationClient } from "../client";
import type { DocumentFormatData } from "../document/client";
import {
  type DocumentParagraph,
  type DocumentSubType,
  type ParsedMarkdown,
  parseMd,
  serializeMd,
  serializeTxt,
} from "../document/parser";
import type { Term } from "../tools/term-tools";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
} from "../types";
import type { LyricsTranslationEvent } from "./events";

/** Shape of the format-specific data stored in the DB. */
export interface LyricsFormatData {
  subType: DocumentSubType;
  paragraphs: DocumentParagraph[];
  originalFileName: string;
  sourceLanguage: string;
  targetLanguage: string;
  rawMetadata?: string;
  translationMode: "lyrics";
}

/**
 * Lyrics translation client.
 *
 * Key difference from DocumentClient: text is split by LINES (not paragraphs).
 * Each non-empty line becomes one TranslationEntry because rhythm/rhyme analysis
 * operates at the line level.
 */
export class LyricsClient implements TranslationClient<LyricsTranslationEvent> {
  private subType: DocumentSubType = "txt";
  private paragraphs: DocumentParagraph[] = [];
  private project: TranslationProject = { resources: [] };
  private sourceLanguage = "";
  private targetLanguage = "";
  private originalFileName = "";
  private projectId: string | null = null;
  private rawMetadata?: string;

  async load(payload: UploadPayload): Promise<OperationResult> {
    if (payload.kind === "single-file") {
      const file = payload.file;
      this.originalFileName = file.name;
      const text = await file.text();
      return this.parseAndBuild(text, file.name);
    }

    return {
      hasError: true,
      errorMessage: "Lyrics mode only supports single text files",
    };
  }

  /**
   * Load from raw text (for text input tab — no file upload).
   */
  loadFromText(text: string, fileName: string): OperationResult {
    this.originalFileName = fileName;
    return this.parseAndBuild(text, fileName);
  }

  private parseAndBuild(text: string, fileName: string): OperationResult {
    const name = fileName.toLowerCase();

    if (name.endsWith(".md") || name.endsWith(".markdown")) {
      this.subType = "md";
      const parsed = parseMd(text);
      this.rawMetadata = parsed.frontmatter;
      // For lyrics, further split paragraphs into individual lines
      this.paragraphs = this.splitIntoLines(parsed.paragraphs);
    } else {
      this.subType = "txt";
      // Split directly by lines instead of paragraphs
      this.paragraphs = this.parseLyricsLines(text);
    }

    if (this.paragraphs.length === 0) {
      return {
        hasError: true,
        errorMessage: "No lyrics lines found in the file",
      };
    }

    this.buildProject();
    return { hasError: false, data: undefined };
  }

  /**
   * Parse text into individual lines (each line = one entry for lyrics).
   */
  private parseLyricsLines(text: string): DocumentParagraph[] {
    const cleaned = text
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!cleaned) return [];

    return cleaned
      .split("\n")
      .map((line, i) => ({
        index: i + 1,
        text: line.trim(),
      }))
      .filter((p) => p.text.length > 0);
  }

  /**
   * Split markdown paragraphs into individual lines.
   */
  private splitIntoLines(paragraphs: DocumentParagraph[]): DocumentParagraph[] {
    const lines: DocumentParagraph[] = [];
    let index = 1;
    for (const p of paragraphs) {
      if (p.kind === "code-block") continue; // Skip code blocks
      for (const line of p.text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          lines.push({ index, text: trimmed, kind: p.kind });
          index++;
        }
      }
    }
    return lines;
  }

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
      return { hasError: true, errorMessage: `Entry not found: ${entryId}` };
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
  }): AsyncGenerator<LyricsTranslationEvent> {
    const { translateLyricsEntries } = await import("./agent");
    const allEntries = this.project.resources.flatMap((r) =>
      r.entries.map((e) => ({ ...e, resourceId: r.id })),
    );
    yield* translateLyricsEntries({
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
   * Load from DB-stored JSON content.
   */
  loadFromJson(
    content: TranslationProject,
    formatData: LyricsFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.subType = formatData.subType;
    this.paragraphs = formatData.paragraphs;
    this.originalFileName = formatData.originalFileName;
    this.sourceLanguage = formatData.sourceLanguage;
    this.targetLanguage = formatData.targetLanguage;
    this.rawMetadata = formatData.rawMetadata;
    this.projectId = opts?.projectId ?? null;
    return { hasError: false, data: undefined };
  }

  getFormatData(): LyricsFormatData {
    return {
      subType: this.subType,
      paragraphs: this.paragraphs,
      originalFileName: this.originalFileName,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      rawMetadata: this.rawMetadata,
      translationMode: "lyrics",
    };
  }

  async exportFile(
    _terms?: Term[],
  ): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  > {
    const resource = this.project.resources[0];
    if (!resource) {
      return { hasError: true, errorMessage: "No resource found to export" };
    }

    if (this.subType === "md") {
      const translatedParagraphs: DocumentParagraph[] = resource.entries.map(
        (e) => ({
          index: Number(e.id),
          text: e.targetText || e.sourceText,
          kind: (e.metadata as { kind?: string } | undefined)?.kind as
            | DocumentParagraph["kind"]
            | undefined,
        }),
      );
      const parsed: ParsedMarkdown = {
        frontmatter: this.rawMetadata,
        paragraphs: translatedParagraphs,
      };
      const content = serializeMd(parsed);
      const blob = new Blob([content], {
        type: "text/markdown;charset=utf-8",
      });
      const baseName = this.originalFileName.replace(/\.(md|markdown)$/i, "");
      const fileName = `${baseName}_${this.targetLanguage || "translated"}.md`;
      return { hasError: false, data: { blob, fileName } };
    }

    // Default: txt — one line per entry
    const content =
      resource.entries.map((e) => e.targetText || e.sourceText).join("\n") +
      "\n";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const baseName = this.originalFileName.replace(/\.txt$/i, "");
    const fileName = `${baseName}_${this.targetLanguage || "translated"}.txt`;
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
    const formatData =
      dbProject.formatData as unknown as LyricsFormatData | null;

    if (!content || !formatData) {
      return { hasError: true, errorMessage: "Project has no content data" };
    }

    return this.loadFromJson(content, formatData, {
      blobUrl: dbProject.blobUrl ?? undefined,
      projectId: openProjectId,
    });
  }

  // ---- Internal helpers ----------------------------------------

  private buildProject(): void {
    const entries: TranslationEntry[] = this.paragraphs.map((p) => ({
      id: String(p.index),
      sourceText: p.text,
      targetText: "",
      metadata: {
        paragraphIndex: p.index,
        kind: p.kind,
      },
    }));

    const resource: TranslationResource = {
      id: "lyrics-main",
      label: this.originalFileName || "Lyrics",
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
