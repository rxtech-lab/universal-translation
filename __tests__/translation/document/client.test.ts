import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import {
  DocumentClient,
  type DocumentFormatData,
} from "@/lib/translation/document/client";
import type {
  TranslationProject,
  UploadPayload,
} from "@/lib/translation/types";

// ============================================================
// Test helpers
// ============================================================

function createTxtPayload(content: string, name = "test.txt"): UploadPayload {
  return {
    kind: "single-file",
    file: new File([content], name, { type: "text/plain" }),
  };
}

function createMdPayload(content: string, name = "test.md"): UploadPayload {
  return {
    kind: "single-file",
    file: new File([content], name, { type: "text/markdown" }),
  };
}

const SAMPLE_DOCX_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
    <w:p><w:r><w:t>Third paragraph</w:t></w:r></w:p>
  </w:body>
</w:document>`;

function createDocxPayload(): UploadPayload {
  return {
    kind: "archive",
    tree: {
      files: [
        {
          path: "word/document.xml",
          content: strToU8(SAMPLE_DOCX_XML),
        },
        {
          path: "[Content_Types].xml",
          content: strToU8("<Types></Types>"),
        },
        {
          path: "_rels/.rels",
          content: strToU8("<Relationships></Relationships>"),
        },
      ],
    },
    originalFileName: "test.docx",
  };
}

function loadTxtAsset(): UploadPayload {
  const filePath = resolve(__dirname, "../../../test-assets/sample.txt");
  const content = readFileSync(filePath, "utf-8");
  return createTxtPayload(content, "sample.txt");
}

function loadMdAsset(): UploadPayload {
  const filePath = resolve(__dirname, "../../../test-assets/sample.md");
  const content = readFileSync(filePath, "utf-8");
  return createMdPayload(content, "sample.md");
}

// ============================================================
// Loading TXT files
// ============================================================

describe("DocumentClient - TXT", () => {
  it("loads a txt file and produces correct project structure", async () => {
    const client = new DocumentClient();
    const result = await client.load(
      createTxtPayload("First paragraph.\n\nSecond paragraph."),
    );

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(1);
    expect(project.resources[0].id).toBe("doc-main");
    expect(project.resources[0].entries).toHaveLength(2);
    expect(project.resources[0].entries[0].sourceText).toBe("First paragraph.");
    expect(project.resources[0].entries[1].sourceText).toBe(
      "Second paragraph.",
    );
  });

  it("loads sample.txt test asset", async () => {
    const client = new DocumentClient();
    const result = await client.load(loadTxtAsset());
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources[0].entries.length).toBeGreaterThan(3);
  });

  it("returns error for empty file", async () => {
    const client = new DocumentClient();
    const result = await client.load(createTxtPayload(""));
    expect(result.hasError).toBe(true);
  });
});

// ============================================================
// Loading MD files
// ============================================================

describe("DocumentClient - MD", () => {
  it("loads a md file and identifies paragraph kinds", async () => {
    const client = new DocumentClient();
    const result = await client.load(
      createMdPayload("# Title\n\nSome text.\n\n- list item"),
    );

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    const entries = project.resources[0].entries;
    expect(entries).toHaveLength(3);

    const kinds = entries.map((e) => (e.metadata as { kind?: string })?.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("list");
  });

  it("skips code blocks from translatable entries", async () => {
    const client = new DocumentClient();
    const result = await client.load(
      createMdPayload("Text\n\n```js\nconst x = 1;\n```\n\nMore text"),
    );

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    const entries = project.resources[0].entries;
    // Code block should be filtered out
    expect(entries).toHaveLength(2);
    expect(
      entries.every(
        (e) => (e.metadata as { kind?: string })?.kind !== "code-block",
      ),
    ).toBe(true);
  });

  it("loads sample.md test asset", async () => {
    const client = new DocumentClient();
    const result = await client.load(loadMdAsset());
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources[0].entries.length).toBeGreaterThan(5);
  });
});

// ============================================================
// Loading DOCX files
// ============================================================

describe("DocumentClient - DOCX", () => {
  it("loads a docx archive and extracts paragraphs", async () => {
    const client = new DocumentClient();
    const result = await client.load(createDocxPayload());

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(1);
    expect(project.resources[0].entries).toHaveLength(3);
    expect(project.resources[0].entries[0].sourceText).toBe("First paragraph");
  });

  it("returns error for archive without word/document.xml", async () => {
    const client = new DocumentClient();
    const result = await client.load({
      kind: "archive",
      tree: {
        files: [
          {
            path: "random.xml",
            content: strToU8("<root/>"),
          },
        ],
      },
      originalFileName: "test.docx",
    });
    expect(result.hasError).toBe(true);
  });
});

// ============================================================
// Language management
// ============================================================

describe("DocumentClient - setLanguages", () => {
  it("updates project languages", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));

    client.setLanguages("en", "zh-Hans");

    expect(client.getSourceLanguage()).toBe("en");
    expect(client.getTargetLanguages()).toEqual(["zh-Hans"]);

    const project = client.getProject();
    expect(project.sourceLanguage).toBe("en");
    expect(project.targetLanguages).toEqual(["zh-Hans"]);
    expect(project.resources[0].sourceLanguage).toBe("en");
    expect(project.resources[0].targetLanguage).toBe("zh-Hans");
  });
});

// ============================================================
// Entry updates
// ============================================================

describe("DocumentClient - updateEntry", () => {
  it("modifies entry targetText", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));

    const result = client.updateEntry("doc-main", "1", {
      targetText: "你好",
    });
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources[0].entries[0].targetText).toBe("你好");
  });

  it("returns error for non-existent resource", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));

    const result = client.updateEntry("nonexistent", "1", {
      targetText: "test",
    });
    expect(result.hasError).toBe(true);
  });

  it("returns error for non-existent entry", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));

    const result = client.updateEntry("doc-main", "999", {
      targetText: "test",
    });
    expect(result.hasError).toBe(true);
  });
});

describe("DocumentClient - updateEntries", () => {
  it("bulk updates work", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));

    const result = client.updateEntries([
      { resourceId: "doc-main", entryId: "1", update: { targetText: "你好" } },
      { resourceId: "doc-main", entryId: "2", update: { targetText: "世界" } },
    ]);
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources[0].entries[0].targetText).toBe("你好");
    expect(project.resources[0].entries[1].targetText).toBe("世界");
  });
});

// ============================================================
// Format data and persistence
// ============================================================

describe("DocumentClient - getFormatData", () => {
  it("returns correct subType for txt", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));
    client.setLanguages("en", "zh-Hans");

    const data = client.getFormatData();
    expect(data.subType).toBe("txt");
    expect(data.originalFileName).toBe("test.txt");
    expect(data.sourceLanguage).toBe("en");
    expect(data.targetLanguage).toBe("zh-Hans");
    expect(data.paragraphs.length).toBe(2);
  });

  it("returns correct subType for md", async () => {
    const client = new DocumentClient();
    await client.load(createMdPayload("# Title\n\nContent"));

    const data = client.getFormatData();
    expect(data.subType).toBe("md");
  });

  it("returns correct subType for docx", async () => {
    const client = new DocumentClient();
    await client.load(createDocxPayload());

    const data = client.getFormatData();
    expect(data.subType).toBe("docx");
    expect(data.rawMetadata).toBeDefined();
  });
});

describe("DocumentClient - loadFromJson", () => {
  it("restores state correctly", async () => {
    // First: create and populate a client
    const original = new DocumentClient();
    await original.load(createTxtPayload("Hello\n\nWorld"));
    original.setLanguages("en", "ja");
    original.updateEntry("doc-main", "1", { targetText: "こんにちは" });

    const content = original.getProject();
    const formatData = original.getFormatData();

    // Then: restore to a new client
    const restored = new DocumentClient();
    const result = restored.loadFromJson(
      content as TranslationProject,
      formatData,
      { projectId: "test-id" },
    );
    expect(result.hasError).toBe(false);

    expect(restored.getSourceLanguage()).toBe("en");
    expect(restored.getTargetLanguages()).toEqual(["ja"]);
    expect(restored.getProject().resources[0].entries[0].targetText).toBe(
      "こんにちは",
    );
  });
});

// ============================================================
// Export
// ============================================================

describe("DocumentClient - exportFile", () => {
  it("exports txt file correctly", async () => {
    const client = new DocumentClient();
    await client.load(createTxtPayload("Hello\n\nWorld"));
    client.setLanguages("en", "zh-Hans");
    client.updateEntry("doc-main", "1", { targetText: "你好" });
    client.updateEntry("doc-main", "2", { targetText: "世界" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.fileName).toBe("test_zh-Hans.txt");
    expect(result.data.blob).toBeDefined();

    const text = await result.data.blob!.text();
    expect(text).toContain("你好");
    expect(text).toContain("世界");
  });

  it("exports md file with structure preserved", async () => {
    const client = new DocumentClient();
    await client.load(
      createMdPayload("---\ntitle: Test\n---\n\n# Title\n\nContent"),
    );
    client.setLanguages("en", "zh-Hans");
    client.updateEntry("doc-main", "1", { targetText: "# 标题" });
    client.updateEntry("doc-main", "2", { targetText: "内容" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.fileName).toBe("test_zh-Hans.md");
    const text = await result.data.blob!.text();
    expect(text).toContain("---\ntitle: Test\n---");
    expect(text).toContain("# 标题");
    expect(text).toContain("内容");
  });

  it("exports docx file as valid blob", async () => {
    const client = new DocumentClient();
    await client.load(createDocxPayload());
    client.setLanguages("en", "zh-Hans");
    client.updateEntry("doc-main", "1", { targetText: "第一段" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.fileName).toBe("test_zh-Hans.docx");
    expect(result.data.blob).toBeDefined();
    expect(result.data.blob!.size).toBeGreaterThan(0);
  });
});
