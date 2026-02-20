import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHtml, serializeHtml } from "@/lib/translation/html/parser";

// ============================================================
// Test helpers
// ============================================================

function loadTestAsset(filename: string): string {
  const filePath = resolve(__dirname, "../../../test-assets", filename);
  return readFileSync(filePath, "utf-8");
}

// ============================================================
// parseHtml - basic extraction
// ============================================================

describe("parseHtml", () => {
  it("extracts text from paragraph elements", () => {
    const html = "<p>Hello World</p><p>Second paragraph</p>";
    const result = parseHtml(html);
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).toContain("Hello World");
    expect(texts).toContain("Second paragraph");
  });

  it("extracts text from heading elements", () => {
    const html = "<h1>Main Title</h1><h2>Subtitle</h2><h3>Section</h3>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).toContain("Main Title");
    expect(texts).toContain("Subtitle");
    expect(texts).toContain("Section");
  });

  it("extracts text from list items", () => {
    const html = "<ul><li>Item one</li><li>Item two</li></ul>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).toContain("Item one");
    expect(texts).toContain("Item two");
  });

  it("extracts text from table cells", () => {
    const html = "<table><tr><td>Cell one</td><td>Cell two</td></tr></table>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).toContain("Cell one");
    expect(texts).toContain("Cell two");
  });

  it("extracts text from blockquote", () => {
    const html = "<blockquote><p>A famous quote</p></blockquote>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).toContain("A famous quote");
  });

  it("preserves inline elements in sourceText", () => {
    const html = "<p>Hello <b>world</b> and <em>everyone</em></p>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    expect(textSegments.length).toBeGreaterThanOrEqual(1);
    const pText = textSegments.find((s) => s.sourceText.includes("Hello"));
    expect(pText).toBeDefined();
    expect(pText!.sourceText).toContain("<b>world</b>");
    expect(pText!.sourceText).toContain("<em>everyone</em>");
  });

  it("preserves links in sourceText", () => {
    const html = '<p>Click <a href="/foo">here</a> to proceed</p>';
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const pText = textSegments.find((s) => s.sourceText.includes("Click"));
    expect(pText).toBeDefined();
    expect(pText!.sourceText).toContain('<a href="/foo">here</a>');
  });

  // Attribute extraction
  it("extracts alt attributes", () => {
    const html = '<img src="/photo.jpg" alt="A beautiful photo">';
    const result = parseHtml(html);
    const attrSegments = result.segments.filter((s) => s.kind === "attribute");
    const altSeg = attrSegments.find((s) => s.attributeName === "alt");
    expect(altSeg).toBeDefined();
    expect(altSeg!.sourceText).toBe("A beautiful photo");
  });

  it("extracts title attributes", () => {
    const html = '<img src="/photo.jpg" title="Click to enlarge">';
    const result = parseHtml(html);
    const attrSegments = result.segments.filter((s) => s.kind === "attribute");
    const titleSeg = attrSegments.find((s) => s.attributeName === "title");
    expect(titleSeg).toBeDefined();
    expect(titleSeg!.sourceText).toBe("Click to enlarge");
  });

  it("extracts placeholder attributes", () => {
    const html = '<input type="text" placeholder="Enter your name">';
    const result = parseHtml(html);
    const attrSegments = result.segments.filter((s) => s.kind === "attribute");
    const placeholderSeg = attrSegments.find(
      (s) => s.attributeName === "placeholder",
    );
    expect(placeholderSeg).toBeDefined();
    expect(placeholderSeg!.sourceText).toBe("Enter your name");
  });

  it("extracts aria-label attributes", () => {
    const html = '<button aria-label="Close dialog">X</button>';
    const result = parseHtml(html);
    const attrSegments = result.segments.filter((s) => s.kind === "attribute");
    const ariaLabelSeg = attrSegments.find(
      (s) => s.attributeName === "aria-label",
    );
    expect(ariaLabelSeg).toBeDefined();
    expect(ariaLabelSeg!.sourceText).toBe("Close dialog");
  });

  // Skip tags
  it("skips script content", () => {
    const html =
      '<p>Visible text</p><script>var hidden = "should not appear";</script>';
    const result = parseHtml(html);
    const allText = result.segments.map((s) => s.sourceText).join(" ");
    expect(allText).not.toContain("should not appear");
    expect(allText).toContain("Visible text");
  });

  it("skips style content", () => {
    const html = "<p>Visible</p><style>body { color: red; }</style>";
    const result = parseHtml(html);
    const allText = result.segments.map((s) => s.sourceText).join(" ");
    expect(allText).not.toContain("color: red");
  });

  it("skips pre content", () => {
    const html = "<p>Visible</p><pre>code block content</pre>";
    const result = parseHtml(html);
    const allText = result.segments.map((s) => s.sourceText).join(" ");
    expect(allText).not.toContain("code block content");
  });

  // Document structure detection
  it("detects full HTML documents", () => {
    const html =
      "<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>";
    const result = parseHtml(html);
    expect(result.isFullDocument).toBe(true);
  });

  it("detects HTML fragments", () => {
    const html = "<p>Just a paragraph</p>";
    const result = parseHtml(html);
    expect(result.isFullDocument).toBe(false);
  });

  it("extracts head content", () => {
    const html =
      '<html><head><title>My Page</title><link rel="stylesheet" href="/style.css"></head><body><p>Hello</p></body></html>';
    const result = parseHtml(html);
    expect(result.headContent).toBeDefined();
    expect(result.headContent).toContain("<title>My Page</title>");
  });

  // Edge cases
  it("returns empty segments for empty input", () => {
    expect(parseHtml("").segments).toHaveLength(0);
    expect(parseHtml("   ").segments).toHaveLength(0);
  });

  it("handles BOM", () => {
    const html = "\uFEFF<p>Hello</p>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    expect(textSegments.length).toBeGreaterThanOrEqual(1);
  });

  it("skips block elements with only whitespace", () => {
    const html = "<p>  </p><p>Actual text</p>";
    const result = parseHtml(html);
    const textSegments = result.segments.filter((s) => s.kind === "text");
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts).not.toContain("");
    expect(texts).toContain("Actual text");
  });

  it("uses 1-based indexing", () => {
    const html = "<p>First</p><p>Second</p>";
    const result = parseHtml(html);
    expect(result.segments[0].index).toBe(1);
    if (result.segments.length > 1) {
      expect(result.segments[1].index).toBe(2);
    }
  });

  it("preserves originalHtml", () => {
    const html = "<p>Hello</p>";
    const result = parseHtml(html);
    expect(result.originalHtml).toBe(html);
  });

  // Integration test with sample asset
  it("parses sample.html test asset", () => {
    const html = loadTestAsset("sample.html");
    const result = parseHtml(html);

    expect(result.isFullDocument).toBe(true);
    expect(result.headContent).toBeDefined();

    const textSegments = result.segments.filter((s) => s.kind === "text");
    const attrSegments = result.segments.filter((s) => s.kind === "attribute");

    // Should extract multiple text segments
    expect(textSegments.length).toBeGreaterThan(5);

    // Should extract alt, title, placeholder, aria-label attributes
    expect(attrSegments.length).toBeGreaterThan(0);

    // Check specific expected content
    const texts = textSegments.map((s) => s.sourceText);
    expect(texts.some((t) => t.includes("Welcome to Our Website"))).toBe(true);
    expect(texts.some((t) => t.includes("Our Mission"))).toBe(true);

    // Check attribute extraction
    const attrTexts = attrSegments.map((s) => s.sourceText);
    expect(attrTexts.some((t) => t.includes("beautiful landscape"))).toBe(true);
  });
});

// ============================================================
// serializeHtml - round-trip
// ============================================================

describe("serializeHtml", () => {
  it("applies text translations to output", () => {
    const html = "<p>Hello World</p><p>Goodbye World</p>";
    const parsed = parseHtml(html);

    const helloSeg = parsed.segments.find(
      (s) => s.sourceText === "Hello World",
    );
    const goodbyeSeg = parsed.segments.find(
      (s) => s.sourceText === "Goodbye World",
    );

    const translations = new Map<number, string>();
    if (helloSeg) translations.set(helloSeg.index, "你好世界");
    if (goodbyeSeg) translations.set(goodbyeSeg.index, "再见世界");

    const result = serializeHtml(parsed, translations);
    expect(result).toContain("你好世界");
    expect(result).toContain("再见世界");
    expect(result).toContain("<p>");
    expect(result).toContain("</p>");
  });

  it("applies attribute translations", () => {
    const html = '<img src="/photo.jpg" alt="A photo">';
    const parsed = parseHtml(html);
    const altSeg = parsed.segments.find(
      (s) => s.kind === "attribute" && s.attributeName === "alt",
    );

    const translations = new Map<number, string>();
    if (altSeg) translations.set(altSeg.index, "一张照片");

    const result = serializeHtml(parsed, translations);
    expect(result).toContain("一张照片");
    expect(result).toContain('src="/photo.jpg"');
  });

  it("preserves untranslated segments", () => {
    const html = "<p>Translated</p><p>Not translated</p>";
    const parsed = parseHtml(html);

    const firstSeg = parsed.segments.find((s) => s.sourceText === "Translated");

    const translations = new Map<number, string>();
    if (firstSeg) translations.set(firstSeg.index, "已翻译");

    const result = serializeHtml(parsed, translations);
    expect(result).toContain("已翻译");
    expect(result).toContain("Not translated");
  });

  it("preserves HTML structure and attributes", () => {
    const html = '<div class="container"><p id="intro">Hello</p></div>';
    const parsed = parseHtml(html);

    const pSeg = parsed.segments.find((s) => s.sourceText === "Hello");
    const translations = new Map<number, string>();
    if (pSeg) translations.set(pSeg.index, "你好");

    const result = serializeHtml(parsed, translations);
    expect(result).toContain('class="container"');
    expect(result).toContain('id="intro"');
    expect(result).toContain("你好");
  });

  it("preserves script and style tags unchanged", () => {
    const html =
      "<p>Text</p><script>var x = 1;</script><style>.cls { color: red; }</style>";
    const parsed = parseHtml(html);

    const pSeg = parsed.segments.find((s) => s.sourceText === "Text");
    const translations = new Map<number, string>();
    if (pSeg) translations.set(pSeg.index, "文本");

    const result = serializeHtml(parsed, translations);
    expect(result).toContain("var x = 1;");
    expect(result).toContain(".cls { color: red; }");
    expect(result).toContain("文本");
  });

  it("handles empty translation map", () => {
    const html = "<p>Hello</p>";
    const parsed = parseHtml(html);
    const result = serializeHtml(parsed, new Map());
    // Should return original unchanged
    expect(result).toBe(html);
  });

  it("handles HTML entities in attribute translations", () => {
    const html = '<img alt="Photo &amp; Image">';
    const parsed = parseHtml(html);
    const altSeg = parsed.segments.find(
      (s) => s.kind === "attribute" && s.attributeName === "alt",
    );

    if (altSeg) {
      const translations = new Map<number, string>();
      translations.set(altSeg.index, 'Photos & "Images"');
      const result = serializeHtml(parsed, translations);
      expect(result).toContain("Photos &amp; &quot;Images&quot;");
    }
  });
});

// ============================================================
// serializeHtml - XSS prevention
// ============================================================

describe("serializeHtml - XSS prevention", () => {
  it("strips script tags from text translations", () => {
    const html = "<p>Hello</p>";
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText === "Hello");
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, '<script>alert("xss")</script>');
    const result = serializeHtml(parsed, translations);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(");
  });

  it("strips event handlers from text translations", () => {
    const html = "<p>Hello</p>";
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText === "Hello");
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, '<img src=x onerror="alert(1)">');
    const result = serializeHtml(parsed, translations);
    expect(result).not.toContain("onerror");
  });

  it("strips iframe injection from text translations", () => {
    const html = "<p>Hello</p>";
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText === "Hello");
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, '<iframe src="https://evil.com"></iframe>');
    const result = serializeHtml(parsed, translations);
    expect(result).not.toContain("<iframe");
  });

  it("preserves safe inline HTML in translations", () => {
    const html = "<p>Hello <b>world</b></p>";
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText.includes("Hello"));
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, "你好 <b>世界</b>");
    const result = serializeHtml(parsed, translations);
    expect(result).toContain("<b>世界</b>");
  });

  it("preserves safe links in translations", () => {
    const html = '<p>Click <a href="/foo">here</a></p>';
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText.includes("Click"));
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, '点击 <a href="https://example.com">这里</a>');
    const result = serializeHtml(parsed, translations);
    expect(result).toContain('<a href="https://example.com">这里</a>');
  });

  it("strips javascript: URIs from links in translations", () => {
    const html = '<p>Click <a href="/foo">here</a></p>';
    const parsed = parseHtml(html);
    const seg = parsed.segments.find((s) => s.sourceText.includes("Click"));
    expect(seg).toBeDefined();

    const translations = new Map<number, string>();
    translations.set(seg!.index, '<a href="javascript:alert(1)">evil link</a>');
    const result = serializeHtml(parsed, translations);
    expect(result).not.toContain("javascript:");
  });
});
