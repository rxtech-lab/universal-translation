import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DefaultUploadProcessor,
  FflateZipDecompressor,
} from "@/lib/translation/upload-processor";

function loadTestZip(): File {
  const zipPath = resolve(__dirname, "../../test-assets/zh-Hans.xcloc.zip");
  const buffer = readFileSync(zipPath);
  return new File([buffer], "zh-Hans.xcloc.zip", {
    type: "application/zip",
  });
}

describe("FflateZipDecompressor", () => {
  const decompressor = new FflateZipDecompressor();

  it("decompresses a valid zip file", async () => {
    const file = loadTestZip();
    const result = await decompressor.decompress(file);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.files.length).toBeGreaterThan(0);
  });

  it("extracts expected file paths from xcloc zip", async () => {
    const file = loadTestZip();
    const result = await decompressor.decompress(file);
    if (result.hasError) return;

    const paths = result.data.files.map((f) => f.path);
    expect(paths).toContain("zh-Hans.xcloc/Localized Contents/zh-Hans.xliff");
    expect(paths).toContain("zh-Hans.xcloc/contents.json");
  });

  it("skips directory entries", async () => {
    const file = loadTestZip();
    const result = await decompressor.decompress(file);
    if (result.hasError) return;

    for (const f of result.data.files) {
      expect(f.path.endsWith("/")).toBe(false);
    }
  });

  it("returns error for invalid zip data", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 3])], "bad.zip");
    const result = await decompressor.decompress(file);
    expect(result.hasError).toBe(true);
  });
});

describe("DefaultUploadProcessor", () => {
  const processor = new DefaultUploadProcessor();

  it("detects zip files by magic bytes and returns archive payload", async () => {
    const file = loadTestZip();
    const result = await processor.process(file);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.kind).toBe("archive");
    if (result.data.kind !== "archive") return;

    expect(result.data.originalFileName).toBe("zh-Hans.xcloc.zip");
    expect(result.data.tree.files.length).toBeGreaterThan(0);
  });

  it("returns single-file payload for non-zip files", async () => {
    const file = new File(["hello world"], "test.txt", {
      type: "text/plain",
    });
    const result = await processor.process(file);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.kind).toBe("single-file");
  });

  it("returns single-file for files with zip extension but no magic bytes", async () => {
    const file = new File(["not a zip"], "fake.zip", {
      type: "application/zip",
    });
    const result = await processor.process(file);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.kind).toBe("single-file");
  });
});
