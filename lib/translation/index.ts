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
export {
	DefaultTranslationClientRegistry,
	createDefaultRegistry,
} from "./registry-impl";

// Upload processing
export type { UploadProcessor, ZipDecompressor } from "./upload";
export {
	DefaultUploadProcessor,
	FflateZipDecompressor,
} from "./upload-processor";

// Xcloc
export { XclocClient } from "./xcloc/client";
export { xclocDescriptor } from "./xcloc/descriptor";
export type { XclocTranslationEvent } from "./xcloc/events";
