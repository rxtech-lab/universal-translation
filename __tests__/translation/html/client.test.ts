import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HtmlClient, type HtmlFormatData } from "@/lib/translation/html/client";
import type {
  TranslationProject,
  UploadPayload,
} from "@/lib/translation/types";

// ============================================================
// Test helpers
// ============================================================

function createHtmlPayload(content: string, name = "test.html"): UploadPayload {
  return {
    kind: "single-file",
    file: new File([content], name, { type: "text/html" }),
  };
}

function createArchivePayload(): UploadPayload {
  return {
    kind: "archive",
    tree: {
      files: [
        {
          path: "index.html",
          content: new TextEncoder().encode(
            "<html><body><h1>Home</h1><p>Welcome to our site.</p></body></html>",
          ),
        },
        {
          path: "about.html",
          content: new TextEncoder().encode(
            "<html><body><h1>About</h1><p>Learn more about us.</p></body></html>",
          ),
        },
      ],
    },
    originalFileName: "site.zip",
  };
}

function loadHtmlAsset(): UploadPayload {
  const filePath = resolve(__dirname, "../../../test-assets/sample.html");
  const content = readFileSync(filePath, "utf-8");
  return createHtmlPayload(content, "sample.html");
}

// ============================================================
// Loading single HTML files
// ============================================================

describe("HtmlClient - single file", () => {
  it("loads a simple HTML file and produces correct project structure", async () => {
    const client = new HtmlClient();
    const result = await client.load(
      createHtmlPayload("<p>Hello World</p><p>Goodbye World</p>"),
    );

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(1);
    expect(project.resources[0].id).toBe("html-main");
    expect(project.resources[0].entries.length).toBeGreaterThanOrEqual(2);

    const texts = project.resources[0].entries.map((e) => e.sourceText);
    expect(texts).toContain("Hello World");
    expect(texts).toContain("Goodbye World");
  });

  it("loads sample.html test asset", async () => {
    const client = new HtmlClient();
    const result = await client.load(loadHtmlAsset());
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources[0].entries.length).toBeGreaterThan(5);
  });

  it("returns error for empty HTML", async () => {
    const client = new HtmlClient();
    const result = await client.load(createHtmlPayload(""));
    expect(result.hasError).toBe(true);
  });

  it("returns error for HTML with no translatable content", async () => {
    const client = new HtmlClient();
    const result = await client.load(
      createHtmlPayload("<script>var x = 1;</script>"),
    );
    expect(result.hasError).toBe(true);
  });

  it("stores segment metadata on entries", async () => {
    const client = new HtmlClient();
    await client.load(
      createHtmlPayload('<p>Text content</p><img alt="An image description">'),
    );

    const project = client.getProject();
    const entries = project.resources[0].entries;

    const textEntry = entries.find((e) => e.sourceText === "Text content");
    expect(textEntry).toBeDefined();
    expect((textEntry!.metadata as Record<string, unknown>).kind).toBe("text");

    const attrEntry = entries.find(
      (e) => e.sourceText === "An image description",
    );
    expect(attrEntry).toBeDefined();
    expect((attrEntry!.metadata as Record<string, unknown>).kind).toBe(
      "attribute",
    );
    expect((attrEntry!.metadata as Record<string, unknown>).attributeName).toBe(
      "alt",
    );
  });
});

// ============================================================
// Loading archives
// ============================================================

describe("HtmlClient - archive", () => {
  it("loads archive with multiple HTML files", async () => {
    const client = new HtmlClient();
    const result = await client.load(createArchivePayload());

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(2);
    expect(project.resources.map((r) => r.id)).toContain("index.html");
    expect(project.resources.map((r) => r.id)).toContain("about.html");
  });

  it("creates entries for each HTML file in archive", async () => {
    const client = new HtmlClient();
    await client.load(createArchivePayload());

    const project = client.getProject();
    for (const resource of project.resources) {
      expect(resource.entries.length).toBeGreaterThan(0);
    }
  });

  it("returns error for archive with no HTML files", async () => {
    const client = new HtmlClient();
    const result = await client.load({
      kind: "archive",
      tree: {
        files: [
          {
            path: "readme.txt",
            content: new TextEncoder().encode("hello"),
          },
        ],
      },
      originalFileName: "archive.zip",
    });
    expect(result.hasError).toBe(true);
  });
});

// ============================================================
// Language management
// ============================================================

describe("HtmlClient - setLanguages", () => {
  it("updates project languages", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p>"));

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

describe("HtmlClient - updateEntry", () => {
  it("modifies entry targetText", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p><p>World</p>"));

    const project = client.getProject();
    const firstEntry = project.resources[0].entries[0];
    const result = client.updateEntry("html-main", firstEntry.id, {
      targetText: "你好",
    });
    expect(result.hasError).toBe(false);
    expect(client.getProject().resources[0].entries[0].targetText).toBe("你好");
  });

  it("returns error for non-existent resource", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p>"));

    const result = client.updateEntry("nonexistent", "1", {
      targetText: "test",
    });
    expect(result.hasError).toBe(true);
  });

  it("returns error for non-existent entry", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p>"));

    const result = client.updateEntry("html-main", "999", {
      targetText: "test",
    });
    expect(result.hasError).toBe(true);
  });
});

describe("HtmlClient - updateEntries", () => {
  it("bulk updates work", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p><p>World</p>"));

    const entries = client.getProject().resources[0].entries;
    const result = client.updateEntries([
      {
        resourceId: "html-main",
        entryId: entries[0].id,
        update: { targetText: "你好" },
      },
      {
        resourceId: "html-main",
        entryId: entries[1].id,
        update: { targetText: "世界" },
      },
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

describe("HtmlClient - getFormatData", () => {
  it("returns correct structure for single file", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p>"));
    client.setLanguages("en", "zh-Hans");

    const data = client.getFormatData();
    expect(data.originalFileName).toBe("test.html");
    expect(data.sourceLanguage).toBe("en");
    expect(data.targetLanguage).toBe("zh-Hans");
    expect(data.rawHtml).toContain("<p>Hello</p>");
    expect(data.segments.length).toBeGreaterThan(0);
  });

  it("returns fileHtmlMap for archive", async () => {
    const client = new HtmlClient();
    await client.load(createArchivePayload());

    const data = client.getFormatData();
    expect(data.fileHtmlMap).toBeDefined();
    expect(Object.keys(data.fileHtmlMap!)).toContain("index.html");
    expect(Object.keys(data.fileHtmlMap!)).toContain("about.html");
  });
});

describe("HtmlClient - loadFromJson", () => {
  it("restores state correctly", async () => {
    const original = new HtmlClient();
    await original.load(createHtmlPayload("<p>Hello</p><p>World</p>"));
    original.setLanguages("en", "ja");

    const entries = original.getProject().resources[0].entries;
    original.updateEntry("html-main", entries[0].id, {
      targetText: "こんにちは",
    });

    const content = original.getProject();
    const formatData = original.getFormatData();

    const restored = new HtmlClient();
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

describe("HtmlClient - exportFile", () => {
  it("exports single HTML file correctly", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p><p>World</p>"));
    client.setLanguages("en", "zh-Hans");

    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, { targetText: "你好" });
    client.updateEntry("html-main", entries[1].id, { targetText: "世界" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.fileName).toBe("test_zh-Hans.html");
    expect(result.data.blob).toBeDefined();

    const text = await result.data.blob!.text();
    expect(text).toContain("你好");
    expect(text).toContain("世界");
  });

  it("exports archive as zip blob", async () => {
    const client = new HtmlClient();
    await client.load(createArchivePayload());
    client.setLanguages("en", "zh-Hans");

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    expect(result.data.fileName).toContain(".zip");
    expect(result.data.blob).toBeDefined();
    expect(result.data.blob!.size).toBeGreaterThan(0);
  });
});

// ============================================================
// Preview
// ============================================================

describe("HtmlClient - getPreviewHtml", () => {
  it("returns HTML with current translations applied", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload("<p>Hello</p><p>World</p>"));

    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, { targetText: "你好" });

    const preview = client.getPreviewHtml();
    expect(preview).toContain("你好");
    // Untranslated entry should use source text
    expect(preview).toContain("World");
  });

  it("returns empty string when no resources", () => {
    const client = new HtmlClient();
    const preview = client.getPreviewHtml();
    expect(preview).toBe("");
  });

  it("rewrites relative URLs to absolute for URL-sourced content", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><head><link rel="stylesheet" href="/styles/main.css"><title>Test</title></head><body><p>Hello</p><img src="/images/photo.jpg"></body></html>',
      "https://example.com/page",
      "example.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain('href="https://example.com/styles/main.css"');
    expect(preview).toContain('src="https://example.com/images/photo.jpg"');
  });

  it("rewrites protocol-relative URLs for URL-sourced content", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><head><link rel="stylesheet" href="//cdn.example.com/style.css"></head><body><p>Hello</p></body></html>',
      "https://example.com/page",
      "example.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain('href="https://cdn.example.com/style.css"');
  });
});

// ============================================================
// URL loading
// ============================================================

describe("HtmlClient - loadFromUrl", () => {
  it("loads HTML from URL source", () => {
    const client = new HtmlClient();
    const result = client.loadFromUrl(
      "<html><body><p>Hello from URL</p></body></html>",
      "https://example.com/page",
      "example.html",
    );

    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(1);
    const texts = project.resources[0].entries.map((e) => e.sourceText);
    expect(texts).toContain("Hello from URL");

    const formatData = client.getFormatData();
    expect(formatData.sourceUrl).toBe("https://example.com/page");
    expect(formatData.baseUrl).toBe("https://example.com");
  });
});

// ============================================================
// URL rewriting in preview and export
// ============================================================

describe("HtmlClient - URL rewriting", () => {
  it("rewrites root-relative CSS link hrefs to absolute", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><head><link rel="stylesheet" href="/w/load.php?lang=en&amp;modules=site.styles&amp;only=styles&amp;skin=vector-2022"></head><body><p>Hello</p></body></html>',
      "https://en.wikipedia.org/wiki/Main_Page",
      "wikipedia.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain(
      'href="https://en.wikipedia.org/w/load.php?lang=en&amp;modules=site.styles&amp;only=styles&amp;skin=vector-2022"',
    );
    expect(preview).not.toContain('href="/w/load.php');
  });

  it("rewrites root-relative image srcs to absolute", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Hello</p><img src="/static/images/icons/enwiki.svg"></body></html>',
      "https://en.wikipedia.org/wiki/Main_Page",
      "wikipedia.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain(
      'src="https://en.wikipedia.org/static/images/icons/enwiki.svg"',
    );
  });

  it("rewrites protocol-relative URLs to https", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Hello</p><img src="//upload.wikimedia.org/photo.jpg"></body></html>',
      "https://en.wikipedia.org/wiki/Main_Page",
      "wikipedia.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain('src="https://upload.wikimedia.org/photo.jpg"');
  });

  it("rewrites srcset URLs to absolute", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Hello</p><img src="//upload.wikimedia.org/photo-330px.jpg" srcset="//upload.wikimedia.org/photo-495px.jpg 1.5x, //upload.wikimedia.org/photo-660px.jpg 2x"></body></html>',
      "https://en.wikipedia.org/wiki/Main_Page",
      "wikipedia.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain("https://upload.wikimedia.org/photo-495px.jpg");
    expect(preview).toContain("https://upload.wikimedia.org/photo-660px.jpg");
  });

  it("rewrites CSS url() references to absolute", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      "<html><head><style>body { background: url(/images/bg.png); }</style></head><body><p>Hello</p></body></html>",
      "https://example.com/page",
      "example.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain("url(https://example.com/images/bg.png)");
  });

  it("preserves already-absolute URLs", () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Hello</p><img src="https://cdn.example.com/photo.jpg"><a href="mailto:test@example.com">mail</a></body></html>',
      "https://example.com/page",
      "example.html",
    );

    const preview = client.getPreviewHtml();
    expect(preview).toContain('src="https://cdn.example.com/photo.jpg"');
    expect(preview).toContain('href="mailto:test@example.com"');
  });

  it("rewrites URLs in exported file", async () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><head><link rel="stylesheet" href="/styles.css"></head><body><p>Hello</p></body></html>',
      "https://example.com/page",
      "example.html",
    );
    client.setLanguages("en", "zh-Hans");

    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, { targetText: "你好" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    const text = await result.data.blob!.text();
    expect(text).toContain('href="https://example.com/styles.css"');
    expect(text).toContain("你好");
  });

  it("rewrites URLs after loadFromJson round-trip", async () => {
    const original = new HtmlClient();
    original.loadFromUrl(
      '<html><head><link rel="stylesheet" href="/styles.css"></head><body><p>Hello</p></body></html>',
      "https://example.com/page",
      "example.html",
    );
    original.setLanguages("en", "zh-Hans");

    const content = original.getProject();
    const formatData = original.getFormatData();

    const restored = new HtmlClient();
    restored.loadFromJson(content as TranslationProject, formatData, {
      projectId: "test-id",
    });

    const preview = restored.getPreviewHtml();
    expect(preview).toContain('href="https://example.com/styles.css"');

    const exportResult = await restored.exportFile();
    expect(exportResult.hasError).toBe(false);
    if (exportResult.hasError) return;

    const text = await exportResult.data.blob!.text();
    expect(text).toContain('href="https://example.com/styles.css"');
  });
});

// ============================================================
// Sanitization - preview
// ============================================================

describe("HtmlClient - preview sanitization", () => {
  it("strips script tags from preview HTML", async () => {
    const client = new HtmlClient();
    await client.load(
      createHtmlPayload('<p>Hello</p><script>alert("xss")</script>'),
    );
    const preview = client.getPreviewHtml();
    expect(preview).not.toContain("<script>");
    expect(preview).toContain("Hello");
  });

  it("strips event handlers from preview HTML", async () => {
    const client = new HtmlClient();
    await client.load(createHtmlPayload('<p onmouseover="alert(1)">Hello</p>'));
    const preview = client.getPreviewHtml();
    expect(preview).not.toContain("onmouseover");
    expect(preview).toContain("Hello");
  });

  it("strips javascript: URIs from preview HTML", async () => {
    const client = new HtmlClient();
    await client.load(
      createHtmlPayload('<p>Click <a href="javascript:alert(1)">here</a></p>'),
    );
    const preview = client.getPreviewHtml();
    expect(preview).not.toContain("javascript:");
  });

  it("strips iframe tags from preview HTML", async () => {
    const client = new HtmlClient();
    await client.load(
      createHtmlPayload('<p>Hello</p><iframe src="https://evil.com"></iframe>'),
    );
    const preview = client.getPreviewHtml();
    expect(preview).not.toContain("<iframe");
  });
});

// ============================================================
// Sanitization - export
// ============================================================

describe("HtmlClient - export sanitization", () => {
  it("strips event handlers from exported HTML (URL-sourced)", async () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p onclick="alert(1)">Hello</p></body></html>',
      "https://example.com/page",
      "example.html",
    );
    client.setLanguages("en", "zh-Hans");
    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, { targetText: "你好" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    const text = await result.data.blob!.text();
    expect(text).not.toContain("onclick");
    expect(text).toContain("你好");
  });

  it("strips script tags from exported HTML (URL-sourced)", async () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Hello</p><script>alert("xss")</script></body></html>',
      "https://example.com/page",
      "example.html",
    );
    client.setLanguages("en", "zh-Hans");
    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, { targetText: "你好" });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    const text = await result.data.blob!.text();
    expect(text).not.toContain("<script>");
    expect(text).toContain("你好");
  });

  it("strips javascript: URIs from exported HTML (URL-sourced)", async () => {
    const client = new HtmlClient();
    client.loadFromUrl(
      '<html><body><p>Click <a href="javascript:alert(1)">here</a></p></body></html>',
      "https://example.com/page",
      "example.html",
    );
    client.setLanguages("en", "zh-Hans");
    const entries = client.getProject().resources[0].entries;
    client.updateEntry("html-main", entries[0].id, {
      targetText: '点击 <a href="javascript:alert(1)">这里</a>',
    });

    const result = await client.exportFile();
    expect(result.hasError).toBe(false);
    if (result.hasError) return;

    const text = await result.data.blob!.text();
    expect(text).not.toContain("javascript:");
  });
});
