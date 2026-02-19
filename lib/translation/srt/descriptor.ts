import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { SrtClient } from "./client";

export const srtDescriptor: TranslationFormatDescriptor = {
  formatId: "srt",
  displayName: "SubRip Subtitles",
  description: "SRT subtitle files with timestamp-based cues",
  fileExtensions: [".srt"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind !== "single-file") {
      return { score: 0, reason: "SRT requires a single file upload" };
    }

    const name = payload.file.name.toLowerCase();
    if (!name.endsWith(".srt")) {
      return { score: 0, reason: "File extension is not .srt" };
    }

    // Peek at content to validate SRT structure
    const text = await payload.file.slice(0, 500).text();
    const hasCuePattern =
      /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(
        text,
      );

    if (hasCuePattern) {
      return {
        score: 1.0,
        reason: "Valid SRT file: has cue numbers and timestamps",
      };
    }

    return {
      score: 0.5,
      reason: "File has .srt extension but content not confirmed",
    };
  },

  createClient() {
    return new SrtClient();
  },
};
