import { unzipSync } from "fflate";
import type {
	OperationResult,
	UploadPayload,
	VirtualFile,
	VirtualFileTree,
} from "./types";
import type {
	UploadProcessor as IUploadProcessor,
	ZipDecompressor as IZipDecompressor,
} from "./upload";

// ============================================================
// Zip decompressor using fflate
// ============================================================

export class FflateZipDecompressor implements IZipDecompressor {
	async decompress(file: File): Promise<OperationResult<VirtualFileTree>> {
		try {
			const buffer = new Uint8Array(await file.arrayBuffer());
			const entries = unzipSync(buffer);
			const files: VirtualFile[] = [];

			for (const [path, content] of Object.entries(entries)) {
				// Skip directories (zero-length content ending with /)
				if (path.endsWith("/")) continue;
				files.push({ path, content });
			}

			return { hasError: false, data: { files } };
		} catch (err) {
			return {
				hasError: true,
				errorMessage: `Zip decompression failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}
}

// ============================================================
// Upload processor
// ============================================================

export class DefaultUploadProcessor implements IUploadProcessor {
	private decompressor = new FflateZipDecompressor();

	async process(file: File): Promise<OperationResult<UploadPayload>> {
		// Check for PK zip magic bytes
		const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
		const isZip =
			header[0] === 0x50 &&
			header[1] === 0x4b &&
			header[2] === 0x03 &&
			header[3] === 0x04;

		if (isZip) {
			const result = await this.decompressor.decompress(file);
			if (result.hasError) return result;
			return {
				hasError: false,
				data: {
					kind: "archive",
					tree: result.data,
					originalFileName: file.name,
				},
			};
		}

		return {
			hasError: false,
			data: { kind: "single-file", file },
		};
	}
}
