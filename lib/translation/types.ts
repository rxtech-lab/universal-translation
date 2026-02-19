// ============================================================
// Core result type used across all operations
// ============================================================

/** Standard result envelope for all async operations. */
export type OperationResult<T = void> =
  | { hasError: false; data: T }
  | { hasError: true; errorMessage: string };

// ============================================================
// Virtual file system types (for zip/folder decompression)
// ============================================================

/** A single file extracted from a zip or selected from disk. */
export interface VirtualFile {
  /** Relative path from the root of the upload, using "/" separators.
   *  e.g. "en.lproj/Localizable.strings" */
  path: string;

  /** The raw file content as bytes. */
  content: Uint8Array;

  /** MIME type if determinable, otherwise undefined. */
  mimeType?: string;
}

/** A flat list of files representing an extracted archive or folder upload. */
export interface VirtualFileTree {
  /** All files in the archive/folder, with relative paths. */
  files: VirtualFile[];
}

// ============================================================
// Upload payload -- what the system passes to detection & clients
// ============================================================

/** Discriminated union: either a single file or an extracted archive. */
export type UploadPayload =
  | { kind: "single-file"; file: File }
  | { kind: "archive"; tree: VirtualFileTree; originalFileName: string };

// ============================================================
// Normalized translation data model
// ============================================================

/** A single translatable unit. This is the universal common format
 *  that all clients normalize their format-specific data into. */
export interface TranslationEntry {
  /** Unique identifier within the file/resource.
   *  For key-value formats this is the key string.
   *  For sequential formats (SRT) this is an index or cue id. */
  id: string;

  /** The source-language text to be translated. */
  sourceText: string;

  /** The translated text. Empty string if not yet translated. */
  targetText: string;

  /** Developer/translator comment or note attached to this entry. */
  comment?: string;

  /** Contextual information (e.g., where the string appears in UI). */
  context?: string;

  /** Maximum character length constraint, if any. */
  maxLength?: number;

  /** Plural form category, if this entry is part of a plural rule. */
  pluralForm?: "zero" | "one" | "two" | "few" | "many" | "other";

  /** Arbitrary format-specific metadata that clients need to preserve
   *  for lossless round-tripping. */
  metadata?: Record<string, unknown>;
}

/** A group of entries, typically corresponding to one file or one
 *  logical resource within a bundle. */
export interface TranslationResource {
  /** Identifier for this resource (often the file path within the bundle). */
  id: string;

  /** Human-readable label for display. */
  label: string;

  /** The translatable entries in this resource. */
  entries: TranslationEntry[];

  /** Source language BCP-47 tag, if known. */
  sourceLanguage?: string;

  /** Target language BCP-47 tag, if known. */
  targetLanguage?: string;
}

/** Top-level container for all translation data held by a client. */
export interface TranslationProject {
  /** All resources in the project. Single-file formats have one resource;
   *  bundle formats have many. */
  resources: TranslationResource[];

  /** Source language for the entire project, if uniform. */
  sourceLanguage?: string;

  /** Target languages for the entire project. */
  targetLanguages?: string[];

  /** Format-specific metadata for lossless round-tripping. */
  metadata?: Record<string, unknown>;
}

// ============================================================
// Language info
// ============================================================

export interface LanguageInfo {
  /** BCP-47 language tag (e.g., "en", "zh-Hans", "ja"). */
  code: string;

  /** Human-readable name in English. */
  name: string;
}
