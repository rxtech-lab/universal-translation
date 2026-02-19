import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { PoClient } from "./client";

export const poDescriptor: TranslationFormatDescriptor = {
  formatId: "po",
  displayName: "Gettext PO",
  description:
    "GNU gettext Portable Object files for app and website localization",
  fileExtensions: [".po"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind !== "single-file") {
      return { score: 0, reason: "PO requires a single file upload" };
    }

    const name = payload.file.name.toLowerCase();
    if (!name.endsWith(".po")) {
      return { score: 0, reason: "File extension is not .po" };
    }

    // Peek at content to validate PO structure
    const text = await payload.file.slice(0, 1000).text();
    const hasMsgid = /^msgid\s+"/m.test(text);
    const hasMsgstr = /^msgstr\s+"/m.test(text);

    if (hasMsgid && hasMsgstr) {
      return {
        score: 1.0,
        reason: "Valid PO file: has msgid and msgstr directives",
      };
    }

    return {
      score: 0.5,
      reason: "File has .po extension but content not confirmed",
    };
  },

  createClient() {
    return new PoClient();
  },
};
