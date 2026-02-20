import { strToU8, zipSync } from "fflate";
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
import type { DocumentTranslationEvent } from "./events";
import {
  type DocumentParagraph,
  type DocumentSubType,
  type ParsedMarkdown,
  parseDocxXml,
  parseMd,
  parseTxt,
  serializeDocxXml,
  serializeMd,
  serializeTxt,
} from "./parser";

/** Shape of the format-specific data stored in the DB. */
export interface DocumentFormatData {
  subType: DocumentSubType;
  paragraphs: DocumentParagraph[];
  originalFileName: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** For markdown: frontmatter string. For docx: document.xml content. */
  rawMetadata?: string;
  /** Path to word/document.xml within the docx archive. */
  documentXmlPath?: string;
}

export class DocumentClient
  implements TranslationClient<DocumentTranslationEvent>
{
  private subType: DocumentSubType = "txt";
  private paragraphs: DocumentParagraph[] = [];
  private project: TranslationProject = { resources: [] };
  private sourceLanguage = "";
  private targetLanguage = "";
  private originalFileName = "";
  private blobUrl: string | null = null;
  private projectId: string | null = null;
  private rawMetadata?: string;
  private originalTree: VirtualFileTree = { files: [] };
  private documentXmlPath = "";
  private documentXml = "";

  async load(payload: UploadPayload): Promise<OperationResult> {
    if (payload.kind === "single-file") {
      return this.loadSingleFile(payload.file);
    }

    if (payload.kind === "archive") {
      return this.loadArchive(payload);
    }

    return {
      hasError: true,
      errorMessage: "Unsupported payload kind",
    };
  }

  private async loadSingleFile(file: File): Promise<OperationResult> {
    this.originalFileName = file.name;
    const name = file.name.toLowerCase();

    if (name.endsWith(".md") || name.endsWith(".markdown")) {
      this.subType = "md";
      const text = await file.text();
      const parsed = parseMd(text);
      this.paragraphs = parsed.paragraphs;
      this.rawMetadata = parsed.frontmatter;
    } else {
      // Default to txt
      this.subType = "txt";
      const text = await file.text();
      this.paragraphs = parseTxt(text);
    }

    if (this.paragraphs.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable content found in the file",
      };
    }

    this.buildProject();
    return { hasError: false, data: undefined };
  }

  private loadArchive(payload: {
    tree: VirtualFileTree;
    originalFileName: string;
  }): OperationResult {
    this.subType = "docx";
    this.originalFileName = payload.originalFileName;
    this.originalTree = payload.tree;

    const files = payload.tree.files.filter(
      (f) => !f.path.includes("__MACOSX"),
    );

    // Find word/document.xml
    const docFile = files.find(
      (f) =>
        f.path.endsWith("word/document.xml") || f.path === "word/document.xml",
    );

    if (!docFile) {
      return {
        hasError: true,
        errorMessage: "No word/document.xml found in the archive",
      };
    }

    this.documentXmlPath = docFile.path;
    this.documentXml = new TextDecoder().decode(docFile.content);
    this.paragraphs = parseDocxXml(this.documentXml);

    if (this.paragraphs.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable content found in the Word document",
      };
    }

    this.rawMetadata = this.documentXml;
    this.buildProject();
    return { hasError: false, data: undefined };
  }

  /**
   * Load from raw text content (for text input tab — no file upload).
   */
  loadFromText(text: string, fileName: string): OperationResult {
    this.originalFileName = fileName;
    const name = fileName.toLowerCase();

    if (name.endsWith(".md") || name.endsWith(".markdown")) {
      this.subType = "md";
      const parsed = parseMd(text);
      this.paragraphs = parsed.paragraphs;
      this.rawMetadata = parsed.frontmatter;
    } else {
      this.subType = "txt";
      this.paragraphs = parseTxt(text);
    }

    if (this.paragraphs.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable content found",
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
  }): AsyncGenerator<DocumentTranslationEvent> {
    const { translateDocumentEntries } = await import("./agent");
    const allEntries = this.project.resources.flatMap((r) =>
      r.entries.map((e) => ({ ...e, resourceId: r.id })),
    );
    yield* translateDocumentEntries({
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
   */
  loadFromJson(
    content: TranslationProject,
    formatData: DocumentFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.subType = formatData.subType;
    this.paragraphs = formatData.paragraphs;
    this.originalFileName = formatData.originalFileName;
    this.sourceLanguage = formatData.sourceLanguage;
    this.targetLanguage = formatData.targetLanguage;
    this.rawMetadata = formatData.rawMetadata;
    this.documentXmlPath = formatData.documentXmlPath ?? "";
    if (this.subType === "docx" && formatData.rawMetadata) {
      this.documentXml = formatData.rawMetadata;
    }
    this.blobUrl = opts?.blobUrl ?? null;
    this.projectId = opts?.projectId ?? null;
    return { hasError: false, data: undefined };
  }

  /** Get the format-specific data needed for DB persistence. */
  getFormatData(): DocumentFormatData {
    return {
      subType: this.subType,
      paragraphs: this.paragraphs,
      originalFileName: this.originalFileName,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      rawMetadata: this.rawMetadata,
      documentXmlPath: this.documentXmlPath || undefined,
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

    // Build translated texts with term resolution
    const termsMap =
      terms && terms.length > 0 ? new Map(terms.map((t) => [t.id, t])) : null;

    const getTranslatedText = (entry: TranslationEntry): string => {
      let text = entry.targetText || entry.sourceText;
      if (termsMap) {
        text = resolveTermTemplates(text, termsMap);
      }
      return text;
    };

    if (this.subType === "txt") {
      const translatedParagraphs = resource.entries.map((e) => ({
        text: getTranslatedText(e),
      }));
      const content = serializeTxt(translatedParagraphs);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const baseName = this.originalFileName.replace(/\.txt$/i, "");
      const fileName = `${baseName}_${this.targetLanguage || "translated"}.txt`;
      return { hasError: false, data: { blob, fileName } };
    }

    if (this.subType === "md") {
      const translatedParagraphs: DocumentParagraph[] = resource.entries.map(
        (e) => {
          const meta = e.metadata as { kind?: string } | undefined;
          return {
            index: Number(e.id),
            text: getTranslatedText(e),
            kind: (meta?.kind as DocumentParagraph["kind"]) ?? "paragraph",
          };
        },
      );
      const parsed: ParsedMarkdown = {
        frontmatter: this.rawMetadata,
        paragraphs: translatedParagraphs,
      };
      const content = serializeMd(parsed);
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const baseName = this.originalFileName.replace(/\.(md|markdown)$/i, "");
      const fileName = `${baseName}_${this.targetLanguage || "translated"}.md`;
      return { hasError: false, data: { blob, fileName } };
    }

    if (this.subType === "docx") {
      return this.exportDocx(resource, getTranslatedText);
    }

    return {
      hasError: true,
      errorMessage: `Unsupported document sub-type: ${this.subType}`,
    };
  }

  private exportDocx(
    resource: TranslationResource,
    getTranslatedText: (entry: TranslationEntry) => string,
  ): OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }> {
    if (!this.documentXml) {
      return {
        hasError: true,
        errorMessage: "No document XML available for export",
      };
    }

    // Build translation map (1-based paragraph index → translated text)
    const translationMap = new Map<number, string>();
    for (const entry of resource.entries) {
      translationMap.set(Number(entry.id), getTranslatedText(entry));
    }

    // Replace text in XML
    const translatedXml = serializeDocxXml(this.documentXml, translationMap);
    const translatedXmlBytes = strToU8(translatedXml);

    // Build zip with all original files, replacing document.xml
    const zipEntries: Record<string, Uint8Array> = {};

    if (this.originalTree.files.length > 0) {
      for (const file of this.originalTree.files) {
        if (file.path.includes("__MACOSX")) continue;
        if (file.path === this.documentXmlPath) {
          zipEntries[file.path] = translatedXmlBytes;
        } else {
          zipEntries[file.path] = file.content;
        }
      }
    } else if (this.documentXmlPath) {
      zipEntries[this.documentXmlPath] = translatedXmlBytes;
    }

    const zipped = zipSync(zipEntries);
    const blob = new Blob([zipped.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const baseName = this.originalFileName.replace(/\.docx$/i, "");
    const fileName = `${baseName}_${this.targetLanguage || "translated"}.docx`;

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
      dbProject.formatData as unknown as DocumentFormatData | null;

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
    const entries: TranslationEntry[] = this.paragraphs
      .filter((p) => p.kind !== "code-block")
      .map((p) => ({
        id: String(p.index),
        sourceText: p.text,
        targetText: "",
        metadata: {
          paragraphIndex: p.index,
          kind: p.kind,
        },
      }));

    const resource: TranslationResource = {
      id: "doc-main",
      label: this.originalFileName || "Document",
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
