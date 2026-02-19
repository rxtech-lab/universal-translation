import type { TranslationClient } from "./client";
import type { UploadPayload } from "./types";

// ============================================================
// Detection result
// ============================================================

export interface DetectionConfidence {
  /** 0 to 1 score. 1 = certain match, 0 = no match.
   *  Scores above 0.5 are considered viable candidates. */
  score: number;

  /** Human-readable reason for the score (for debugging/logging). */
  reason: string;
}

// ============================================================
// Format descriptor -- static metadata + detection for a format
// ============================================================

/**
 * Each translation format registers a descriptor.
 * The descriptor is used for detection (before any client instance exists)
 * and for UI display (icons, labels).
 *
 * This is intentionally separate from TranslationClient because detection
 * must happen before a client is instantiated — the descriptor is a
 * lightweight, stateless object that can inspect payloads and create clients.
 */
export interface TranslationFormatDescriptor {
  /** Unique identifier for this format (e.g., "srt", "xcstrings", "po"). */
  formatId: string;

  /** Human-readable format name (e.g., "SubRip Subtitles"). */
  displayName: string;

  /** Short description of the format. */
  description: string;

  /** File extensions this format handles (e.g., [".srt", ".sub"]).
   *  Include the leading dot. */
  fileExtensions: string[];

  /** Whether this format is single-file or bundle/folder-based. */
  mode: "single-file" | "bundle";

  /**
   * Inspect the upload payload and return a confidence score.
   *
   * For single-file formats, this typically checks the file extension
   * and optionally peeks at the first bytes of content.
   *
   * For bundle formats, this inspects the directory structure
   * (e.g., looking for *.lproj directories or specific manifest files).
   */
  detect(payload: UploadPayload): Promise<DetectionConfidence>;

  /**
   * Factory: create a new, unloaded client instance for this format.
   * The caller must invoke `client.load(payload)` after creation.
   */
  createClient(): TranslationClient;
}
