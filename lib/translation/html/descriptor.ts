import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { HtmlClient } from "./client";

export const htmlDescriptor: TranslationFormatDescriptor = {
  formatId: "html",
  displayName: "HTML",
  description: "HTML web pages (.html, .htm)",
  fileExtensions: [".html", ".htm"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind === "single-file") {
      const name = payload.file.name.toLowerCase();
      if (name.endsWith(".html") || name.endsWith(".htm")) {
        // Peek at content to validate HTML structure
        const text = await payload.file.slice(0, 500).text();
        const hasHtmlIndicators =
          /<(!doctype|html|head|body|div|p|h[1-6])/i.test(text);
        return {
          score: hasHtmlIndicators ? 1.0 : 0.7,
          reason: hasHtmlIndicators
            ? "Valid HTML file: has HTML structure indicators"
            : "File has .html extension but content not confirmed",
        };
      }
      return { score: 0, reason: "Not an HTML file" };
    }

    if (payload.kind === "archive") {
      const htmlFiles = payload.tree.files.filter(
        (f) => /\.(html|htm)$/i.test(f.path) && !f.path.includes("__MACOSX"),
      );
      if (htmlFiles.length > 0) {
        return {
          score: 0.85,
          reason: `Archive contains ${htmlFiles.length} HTML file(s)`,
        };
      }
    }

    return { score: 0, reason: "Not an HTML file or archive" };
  },

  createClient() {
    return new HtmlClient();
  },
};
