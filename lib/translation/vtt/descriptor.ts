import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { VttClient } from "./client";

export const vttDescriptor: TranslationFormatDescriptor = {
  formatId: "vtt",
  displayName: "WebVTT Subtitles",
  description: "WebVTT subtitle files with timestamp-based cues",
  fileExtensions: [".vtt"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind !== "single-file") {
      return { score: 0, reason: "WebVTT requires a single file upload" };
    }

    const name = payload.file.name.toLowerCase();
    if (!name.endsWith(".vtt")) {
      return { score: 0, reason: "File extension is not .vtt" };
    }

    // Peek at content to validate WebVTT structure (first line must start with WEBVTT)
    const text = await payload.file.slice(0, 500).text();
    const hasWebVttHeader = /^WEBVTT/i.test(
      text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trimStart(),
    );

    if (hasWebVttHeader) {
      return {
        score: 1.0,
        reason: "Valid WebVTT file: has WEBVTT header",
      };
    }

    return {
      score: 0.5,
      reason: "File has .vtt extension but content not confirmed",
    };
  },

  createClient() {
    return new VttClient();
  },
};
