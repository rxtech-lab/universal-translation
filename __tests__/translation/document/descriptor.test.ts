import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { UploadPayload } from "@/lib/translation/types";
import { documentDescriptor } from "@/lib/translation/document/descriptor";

function createDocxArchivePayload(): UploadPayload {
  return {
    kind: "archive",
    tree: {
      files: [
        {
          path: "word/document.xml",
          content: strToU8(
            `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>`,
          ),
        },
        {
          path: "[Content_Types].xml",
          content: strToU8("<Types></Types>"),
        },
      ],
    },
    originalFileName: "test.docx",
  };
}

describe("documentDescriptor", () => {
  it("has correct metadata", () => {
    expect(documentDescriptor.formatId).toBe("document");
    expect(documentDescriptor.fileExtensions).toContain(".txt");
    expect(documentDescriptor.fileExtensions).toContain(".md");
    expect(documentDescriptor.fileExtensions).toContain(".docx");
  });

  it("detects .txt file with score 0.9", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["Hello world"], "test.txt", { type: "text/plain" }),
    };
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0.9);
  });

  it("detects .md file with score 0.9", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["# Hello"], "test.md", { type: "text/markdown" }),
    };
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0.9);
  });

  it("detects .markdown file with score 0.9", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["# Hello"], "README.markdown"),
    };
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0.9);
  });

  it("detects .docx archive with score 0.95", async () => {
    const payload = createDocxArchivePayload();
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0.95);
  });

  it("returns score 0 for unrelated single file", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["test"], "image.png", { type: "image/png" }),
    };
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0);
  });

  it("returns score 0 for archive without word/document.xml", async () => {
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
    const result = await documentDescriptor.detect(payload);
    expect(result.score).toBe(0);
  });

  it("creates a DocumentClient instance", () => {
    const client = documentDescriptor.createClient();
    expect(client).toBeDefined();
    expect(client.getProject).toBeDefined();
  });
});
