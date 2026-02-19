import type { TranslationClient } from "./client";
import type {
	DetectionConfidence,
	TranslationFormatDescriptor,
} from "./detection";
import type { UploadPayload } from "./types";

// ============================================================
// Detection match result
// ============================================================

export interface DetectionMatch {
	descriptor: TranslationFormatDescriptor;
	confidence: DetectionConfidence;
}

// ============================================================
// Registry interface
// ============================================================

/**
 * Central registry that manages all known translation format descriptors.
 * Handles format detection and client instantiation.
 */
export interface TranslationClientRegistry {
	/**
	 * Register a new format descriptor.
	 * Throws if a descriptor with the same formatId is already registered.
	 */
	register(descriptor: TranslationFormatDescriptor): void;

	/**
	 * Remove a registered descriptor by formatId.
	 */
	unregister(formatId: string): void;

	/**
	 * Return all registered descriptors.
	 */
	getDescriptors(): TranslationFormatDescriptor[];

	/**
	 * Look up a descriptor by formatId.
	 */
	getDescriptor(formatId: string): TranslationFormatDescriptor | undefined;

	/**
	 * Run detection across all registered formats and return matches
	 * sorted by confidence (highest first).
	 *
	 * Only returns matches with score > 0.
	 */
	detect(payload: UploadPayload): Promise<DetectionMatch[]>;

	/**
	 * Convenience: detect the best match and create + load a client.
	 *
	 * Returns undefined if no format matches with sufficient confidence.
	 * The `minConfidence` parameter defaults to 0.5.
	 */
	resolve(
		payload: UploadPayload,
		minConfidence?: number,
	): Promise<{ client: TranslationClient; match: DetectionMatch } | undefined>;
}
