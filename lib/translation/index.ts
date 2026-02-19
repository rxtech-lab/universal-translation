// Types

// Client interface
export type { TranslationClient } from "./client";
// Editor components
export type { EditorStatus, TranslationEditorProps } from "./components/types";

// Detection
export type {
  DetectionConfidence,
  TranslationFormatDescriptor,
} from "./detection";
// Languages
export { LANGUAGES } from "./languages";
// Registry
export type { DetectionMatch, TranslationClientRegistry } from "./registry";
export {
  createDefaultRegistry,
  DefaultTranslationClientRegistry,
} from "./registry-impl";
export type { SrtFormatData } from "./srt/client";
// SRT
export { SrtClient } from "./srt/client";
export { srtDescriptor } from "./srt/descriptor";
export type { SrtTranslationEvent } from "./srt/events";
export { parseSrt, serializeSrt } from "./srt/parser";
export type {
  LanguageInfo,
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
  VirtualFile,
  VirtualFileTree,
} from "./types";
// Upload processing
export type { UploadProcessor, ZipDecompressor } from "./upload";
export {
  DefaultUploadProcessor,
  FflateZipDecompressor,
} from "./upload-processor";
export { translateEntries } from "./xcloc/agent";
export type { DocumentFormatData } from "./document/client";
// Document
export { DocumentClient } from "./document/client";
export { documentDescriptor } from "./document/descriptor";
export type { DocumentTranslationEvent } from "./document/events";
export {
  parseTxt,
  parseMd,
  parseDocxXml,
  serializeTxt,
  serializeMd,
  serializeDocxXml,
} from "./document/parser";
export type { PoFormatData } from "./po/client";
// PO
export { PoClient } from "./po/client";
export { poDescriptor } from "./po/descriptor";
export type { PoTranslationEvent } from "./po/events";
export { parsePo, serializePo } from "./po/parser";
export type { XclocFormatData } from "./xcloc/client";
// Xcloc
export { XclocClient } from "./xcloc/client";
export { xclocDescriptor } from "./xcloc/descriptor";
export type { XclocTranslationEvent } from "./xcloc/events";
