import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { XclocClient } from "./client";

export const xclocDescriptor: TranslationFormatDescriptor = {
  formatId: "xcloc",
  displayName: "Xcode Localization Catalog",
  description:
    "Apple Xcode .xcloc localization export bundle containing XLIFF translations",
  fileExtensions: [".xcloc"],
  mode: "bundle",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind !== "archive") {
      return { score: 0, reason: "XCLOC requires an archive upload" };
    }

    const files = payload.tree.files.filter(
      (f) => !f.path.includes("__MACOSX"),
    );

    const contentsFile = files.find((f) => f.path.endsWith("contents.json"));
    const hasXliff = files.some(
      (f) =>
        f.path.includes("Localized Contents/") && f.path.endsWith(".xliff"),
    );

    if (contentsFile && hasXliff) {
      // Validate contents.json structure
      try {
        const json = JSON.parse(new TextDecoder().decode(contentsFile.content));
        if (json.targetLocale && json.developmentRegion && json.version) {
          return {
            score: 1.0,
            reason:
              "Valid xcloc bundle: contents.json + XLIFF in Localized Contents",
          };
        }
      } catch {
        // JSON parse failed, still has the structure
      }
      return {
        score: 0.9,
        reason: "Archive has contents.json + XLIFF in Localized Contents",
      };
    }

    if (contentsFile || hasXliff) {
      return { score: 0.4, reason: "Partial xcloc structure detected" };
    }

    if (payload.originalFileName.endsWith(".xcloc.zip")) {
      return { score: 0.6, reason: "Filename suggests xcloc archive" };
    }

    return { score: 0, reason: "No xcloc structure found" };
  },

  createClient() {
    return new XclocClient();
  },
};
