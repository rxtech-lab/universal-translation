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
import type { PoTranslationEvent } from "./events";
import { parsePo, serializePo, type PoDocument } from "./parser";

/** Shape of the format-specific data stored in the DB. */
export interface PoFormatData {
  document: PoDocument;
  originalFileName: string;
  sourceLanguage: string;
  targetLanguage: string;
}

/** Map plural form index to CLDR category name based on nplurals. */
function pluralIndexToForm(
  index: number,
  nplurals: number,
): "zero" | "one" | "two" | "few" | "many" | "other" {
  if (nplurals === 1) return "other";
  if (nplurals === 2) return index === 0 ? "one" : "other";
  if (nplurals === 3) {
    if (index === 0) return "one";
    if (index === 1) return "few";
    return "other";
  }
  if (nplurals === 6) {
    const forms = ["zero", "one", "two", "few", "many", "other"] as const;
    return forms[index] ?? "other";
  }
  // Fallback for 4-5 forms
  const forms4 = ["one", "few", "many", "other"] as const;
  return forms4[index] ?? "other";
}

export class PoClient implements TranslationClient<PoTranslationEvent> {
  private document: PoDocument = {
    header: { raw: {}, nplurals: 2 },
    entries: [],
  };
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
        errorMessage: "PO requires a single file upload",
      };
    }

    this.originalFileName = payload.file.name;
    const text = await payload.file.text();
    this.document = parsePo(text);

    if (this.document.entries.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable entries found in the PO file",
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

    // Sync back to the PO document
    this.syncToDocument(entryId, update);

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
  }): AsyncGenerator<PoTranslationEvent> {
    const { translatePoEntries } = await import("./agent");
    const allEntries = this.project.resources.flatMap((r) =>
      r.entries.map((e) => ({ ...e, resourceId: r.id })),
    );
    yield* translatePoEntries({
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
    formatData: PoFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.document = formatData.document;
    this.originalFileName = formatData.originalFileName;
    this.sourceLanguage = formatData.sourceLanguage;
    this.targetLanguage = formatData.targetLanguage;
    this.blobUrl = opts?.blobUrl ?? null;
    this.projectId = opts?.projectId ?? null;
    return { hasError: false, data: undefined };
  }

  /** Get the format-specific data needed for DB persistence. */
  getFormatData(): PoFormatData {
    return {
      document: this.document,
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
    // Clone the document and resolve term templates before serializing
    const docToSerialize = structuredClone(this.document);

    if (terms && terms.length > 0) {
      const termsMap = new Map(terms.map((t) => [t.id, t]));
      for (const entry of docToSerialize.entries) {
        if (entry.msgstr) {
          entry.msgstr = resolveTermTemplates(entry.msgstr, termsMap);
        }
        if (entry.msgstrPlural) {
          for (const idx of Object.keys(entry.msgstrPlural).map(Number)) {
            entry.msgstrPlural[idx] = resolveTermTemplates(
              entry.msgstrPlural[idx],
              termsMap,
            );
          }
        }
      }
    }

    // Sync project entries back to the document before export
    this.syncAllToDocument(docToSerialize);

    const poContent = serializePo(docToSerialize);
    const blob = new Blob([poContent], { type: "text/x-gettext-translation;charset=utf-8" });
    const baseName = this.originalFileName.replace(/\.po$/i, "");
    const fileName = `${baseName}_${this.targetLanguage || "translated"}.po`;

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
    const formatData = dbProject.formatData as unknown as PoFormatData | null;

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
    const nplurals = this.document.header.nplurals;
    const entries: TranslationEntry[] = [];

    for (let i = 0; i < this.document.entries.length; i++) {
      const poEntry = this.document.entries[i];

      const comment = poEntry.extractedComments.length > 0
        ? poEntry.extractedComments.join("\n")
        : undefined;
      const context = poEntry.references.length > 0
        ? poEntry.references.join(", ")
        : undefined;

      const baseMetadata: Record<string, unknown> = {
        entryIndex: i,
        flags: poEntry.flags,
        msgctxt: poEntry.msgctxt,
        translatorComments: poEntry.translatorComments,
      };

      if (poEntry.msgidPlural !== undefined && poEntry.msgstrPlural) {
        // Plural entry: create one TranslationEntry per plural form
        for (let f = 0; f < nplurals; f++) {
          entries.push({
            id: `${i}:plural:${f}`,
            sourceText: f === 0 ? poEntry.msgid : poEntry.msgidPlural,
            targetText: poEntry.msgstrPlural[f] ?? "",
            comment,
            context,
            pluralForm: pluralIndexToForm(f, nplurals),
            metadata: { ...baseMetadata, pluralIndex: f },
          });
        }
      } else {
        // Non-plural entry
        entries.push({
          id: String(i),
          sourceText: poEntry.msgid,
          targetText: poEntry.msgstr ?? "",
          comment,
          context,
          metadata: baseMetadata,
        });
      }
    }

    const resource: TranslationResource = {
      id: "po-main",
      label: this.originalFileName || "PO Translations",
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

  private syncToDocument(
    entryId: string,
    update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
  ): void {
    if (update.targetText === undefined) return;

    // Parse entry ID to find the PO entry
    const pluralMatch = entryId.match(/^(\d+):plural:(\d+)$/);
    if (pluralMatch) {
      const poIdx = parseInt(pluralMatch[1], 10);
      const formIdx = parseInt(pluralMatch[2], 10);
      const poEntry = this.document.entries[poIdx];
      if (poEntry?.msgstrPlural) {
        poEntry.msgstrPlural[formIdx] = update.targetText;
      }
    } else {
      const poIdx = parseInt(entryId, 10);
      const poEntry = this.document.entries[poIdx];
      if (poEntry) {
        poEntry.msgstr = update.targetText;
      }
    }
  }

  /** Sync all project entries back to a (potentially cloned) PO document. */
  private syncAllToDocument(doc: PoDocument): void {
    const resource = this.project.resources[0];
    if (!resource) return;

    for (const entry of resource.entries) {
      const pluralMatch = entry.id.match(/^(\d+):plural:(\d+)$/);
      if (pluralMatch) {
        const poIdx = parseInt(pluralMatch[1], 10);
        const formIdx = parseInt(pluralMatch[2], 10);
        const poEntry = doc.entries[poIdx];
        if (poEntry?.msgstrPlural) {
          poEntry.msgstrPlural[formIdx] = entry.targetText;
        }
      } else {
        const poIdx = parseInt(entry.id, 10);
        const poEntry = doc.entries[poIdx];
        if (poEntry) {
          poEntry.msgstr = entry.targetText;
        }
      }
    }
  }
}
