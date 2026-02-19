// Types
export type {
	OperationResult,
	VirtualFile,
	VirtualFileTree,
	UploadPayload,
	TranslationEntry,
	TranslationResource,
	TranslationProject,
	LanguageInfo,
} from "./types";

// Client interface
export type { TranslationClient } from "./client";

// Detection
export type {
	DetectionConfidence,
	TranslationFormatDescriptor,
} from "./detection";

// Registry
export type { DetectionMatch, TranslationClientRegistry } from "./registry";

// Upload processing
export type { UploadProcessor, ZipDecompressor } from "./upload";
