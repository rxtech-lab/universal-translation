import type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "../detection";
import type { UploadPayload } from "../types";
import { DocumentClient } from "./client";

export const documentDescriptor: TranslationFormatDescriptor = {
  formatId: "document",
  displayName: "Document",
  description: "Text documents (.txt, .md, .docx)",
  fileExtensions: [".txt", ".md", ".docx"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind === "single-file") {
      const name = payload.file.name.toLowerCase();
      if (name.endsWith(".txt")) {
        return { score: 0.9, reason: "Text file detected by extension" };
      }
      if (name.endsWith(".md") || name.endsWith(".markdown")) {
        return { score: 0.9, reason: "Markdown file detected by extension" };
      }
      return { score: 0, reason: "Not a document file" };
    }

    if (payload.kind === "archive") {
      // .docx is a ZIP archive containing word/document.xml
      const hasDocumentXml = payload.tree.files.some(
        (f) =>
          f.path.endsWith("word/document.xml") ||
          f.path === "word/document.xml",
      );
      if (hasDocumentXml) {
        return {
          score: 0.95,
          reason: "Word document detected: archive contains word/document.xml",
        };
      }
    }

    return { score: 0, reason: "Not a document file" };
  },

  createClient() {
    return new DocumentClient();
  },
};
