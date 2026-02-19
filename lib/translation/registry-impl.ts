import type { TranslationFormatDescriptor } from "./detection";
import type {
	DetectionMatch,
	TranslationClientRegistry,
} from "./registry";
import type { UploadPayload } from "./types";

/**
 * Default implementation of the TranslationClientRegistry.
 * Manages format descriptors and handles detection + client creation.
 */
export class DefaultTranslationClientRegistry
	implements TranslationClientRegistry
{
	private descriptors = new Map<string, TranslationFormatDescriptor>();

	register(descriptor: TranslationFormatDescriptor): void {
		if (this.descriptors.has(descriptor.formatId)) {
			throw new Error(
				`Format descriptor "${descriptor.formatId}" is already registered`,
			);
		}
		this.descriptors.set(descriptor.formatId, descriptor);
	}

	unregister(formatId: string): void {
		this.descriptors.delete(formatId);
	}

	getDescriptors(): TranslationFormatDescriptor[] {
		return Array.from(this.descriptors.values());
	}

	getDescriptor(formatId: string): TranslationFormatDescriptor | undefined {
		return this.descriptors.get(formatId);
	}

	async detect(payload: UploadPayload): Promise<DetectionMatch[]> {
		const results = await Promise.all(
			Array.from(this.descriptors.values()).map(async (descriptor) => {
				const confidence = await descriptor.detect(payload);
				return { descriptor, confidence };
			}),
		);

		return results
			.filter((r) => r.confidence.score > 0)
			.sort((a, b) => b.confidence.score - a.confidence.score);
	}

	async resolve(
		payload: UploadPayload,
		minConfidence = 0.5,
	) {
		const matches = await this.detect(payload);
		const best = matches[0];

		if (!best || best.confidence.score < minConfidence) {
			return undefined;
		}

		const client = best.descriptor.createClient();
		return { client, match: best };
	}
}

/**
 * Create a pre-configured registry with all built-in format descriptors.
 */
export async function createDefaultRegistry(): Promise<TranslationClientRegistry> {
	const registry = new DefaultTranslationClientRegistry();

	// Register built-in formats
	const { xclocDescriptor } = await import("./xcloc/descriptor");
	registry.register(xclocDescriptor);

	return registry;
}
