import type React from "react";
import type { Term } from "./tools/term-tools";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
} from "./types";

// ============================================================
// TranslationClient -- the core interface each format implements
// ============================================================

/**
 * A stateful translation client for a specific file format.
 *
 * Lifecycle:
 *   1. Created by the format descriptor after detection succeeds.
 *   2. `load(payload)` is called to parse the upload.
 *   3. The UI calls `getProject()`, `render()`, `updateEntry()`, etc.
 *   4. The user exports via `exportFile()` or persists via `save()`.
 */
export interface TranslationClient<TEvent = unknown> {
  // ---- Lifecycle --------------------------------------------------

  /**
   * Parse the uploaded content and populate internal state.
   * Called exactly once after construction.
   */
  load(payload: UploadPayload): Promise<OperationResult>;

  // ---- Data access ------------------------------------------------

  /** Return the full parsed project data. */
  getProject(): TranslationProject;

  /** Return a single resource by id. */
  getResource(resourceId: string): TranslationResource | undefined;

  /** Return detected source language, if any. */
  getSourceLanguage(): string | undefined;

  /** Return detected/configured target languages. */
  getTargetLanguages(): string[];

  // ---- Mutations --------------------------------------------------

  /**
   * Update a single translation entry.
   * The client is responsible for updating its internal state.
   */
  updateEntry(
    resourceId: string,
    entryId: string,
    update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
  ): OperationResult;

  /**
   * Bulk-update multiple entries at once (e.g., after AI batch translation).
   */
  updateEntries(
    updates: Array<{
      resourceId: string;
      entryId: string;
      update: Partial<Pick<TranslationEntry, "targetText" | "comment">>;
    }>,
  ): OperationResult;

  // ---- Rendering --------------------------------------------------

  /**
   * Render the translation editor UI for this format.
   * The client manages its own internal state and renders accordingly.
   */
  render(): React.ReactNode;

  // ---- Translation ------------------------------------------------

  /**
   * Run AI translation. Returns an async stream of format-specific events.
   * Each format client defines its own TEvent type so format-specific
   * frontends can listen to events they understand.
   */
  translate(options: {
    model?: string;
    projectId: string;
  }): AsyncIterable<TEvent>;

  // ---- Export & Persistence ---------------------------------------

  /**
   * Export the translated content back to its original format.
   * Returns a download URL or a Blob the caller can trigger a download from.
   */
  exportFile(
    terms?: Term[],
  ): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  >;

  /**
   * Persist the current state to the database (server-side save).
   * Returns a project/document ID for later retrieval.
   */
  save(): Promise<OperationResult<{ projectId: string }>>;

  /**
   * Restore state from a previously saved project.
   */
  open(projectId: string): Promise<OperationResult>;

  /**
   * Return format-specific data for DB persistence.
   * Keeps the internal document in sync with project content across saves.
   */
  getFormatData(): unknown;
}
