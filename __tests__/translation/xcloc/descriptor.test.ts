import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { unzipSync } from "fflate";
import { xclocDescriptor } from "@/lib/translation/xcloc/descriptor";
import type { UploadPayload, VirtualFile } from "@/lib/translation/types";

function loadTestPayload(): UploadPayload {
	const zipPath = resolve(__dirname, "../../../test-assets/zh-Hans.xcloc.zip");
	const zipBuffer = new Uint8Array(readFileSync(zipPath));
	const entries = unzipSync(zipBuffer);

	const files: VirtualFile[] = [];
	for (const [path, content] of Object.entries(entries)) {
		if (path.endsWith("/")) continue;
		files.push({ path, content });
	}

	return {
		kind: "archive",
		tree: { files },
		originalFileName: "zh-Hans.xcloc.zip",
	};
}

describe("xclocDescriptor", () => {
	it("has correct metadata", () => {
		expect(xclocDescriptor.formatId).toBe("xcloc");
		expect(xclocDescriptor.mode).toBe("bundle");
		expect(xclocDescriptor.fileExtensions).toContain(".xcloc");
	});

	it("detects valid xcloc archive with score 1.0", async () => {
		const payload = loadTestPayload();
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(1.0);
	});

	it("returns score 0 for single-file payload", async () => {
		const payload: UploadPayload = {
			kind: "single-file",
			file: new File(["test"], "test.xliff"),
		};
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(0);
	});

	it("returns score 0 for unrelated archive", async () => {
		const payload: UploadPayload = {
			kind: "archive",
			tree: {
				files: [
					{
						path: "some/random/file.txt",
						content: new TextEncoder().encode("hello"),
					},
				],
			},
			originalFileName: "random.zip",
		};
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(0);
	});

	it("returns partial score for archive with only contents.json", async () => {
		const payload: UploadPayload = {
			kind: "archive",
			tree: {
				files: [
					{
						path: "test.xcloc/contents.json",
						content: new TextEncoder().encode('{"version":"1.0"}'),
					},
				],
			},
			originalFileName: "test.zip",
		};
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(0.4);
	});

	it("returns partial score for archive with only XLIFF", async () => {
		const payload: UploadPayload = {
			kind: "archive",
			tree: {
				files: [
					{
						path: "test.xcloc/Localized Contents/en.xliff",
						content: new TextEncoder().encode("<xliff/>"),
					},
				],
			},
			originalFileName: "test.zip",
		};
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(0.4);
	});

	it("returns 0.6 score for .xcloc.zip filename without structure", async () => {
		const payload: UploadPayload = {
			kind: "archive",
			tree: { files: [] },
			originalFileName: "zh-Hans.xcloc.zip",
		};
		const result = await xclocDescriptor.detect(payload);
		expect(result.score).toBe(0.6);
	});

	it("creates an XclocClient instance", () => {
		const client = xclocDescriptor.createClient();
		expect(client).toBeDefined();
		expect(client.getProject).toBeDefined();
	});
});
