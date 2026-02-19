import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseDocxXml,
  parseMd,
  parseTxt,
  serializeDocxXml,
  serializeMd,
  serializeTxt,
} from "@/lib/translation/document/parser";

// ============================================================
// Test helpers
// ============================================================

function loadTestAsset(filename: string): string {
  const filePath = resolve(__dirname, "../../../test-assets", filename);
  return readFileSync(filePath, "utf-8");
}

// Minimal OOXML document.xml for testing
const SAMPLE_DOCX_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Hello World</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t xml:space="preserve">This is a </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>test document</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Third paragraph with content.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

// ============================================================
// parseTxt
// ============================================================

describe("parseTxt", () => {
  it("parses paragraphs from plain text", () => {
    const result = parseTxt("First paragraph.\n\nSecond paragraph.");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ index: 1, text: "First paragraph." });
    expect(result[1]).toEqual({ index: 2, text: "Second paragraph." });
  });

  it("handles BOM", () => {
    const result = parseTxt("\uFEFFHello\n\nWorld");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello");
  });

  it("handles \\r\\n line endings", () => {
    const result = parseTxt("First\r\n\r\nSecond");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("First");
    expect(result[1].text).toBe("Second");
  });

  it("filters empty blocks", () => {
    const result = parseTxt("First\n\n\n\n\nSecond");
    expect(result).toHaveLength(2);
  });

  it("handles single paragraph", () => {
    const result = parseTxt("Only one paragraph here.");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Only one paragraph here.");
  });

  it("returns empty array for empty input", () => {
    expect(parseTxt("")).toHaveLength(0);
    expect(parseTxt("   ")).toHaveLength(0);
    expect(parseTxt("\n\n")).toHaveLength(0);
  });

  it("parses sample.txt test asset", () => {
    const text = loadTestAsset("sample.txt");
    const result = parseTxt(text);
    expect(result.length).toBeGreaterThan(3);
    expect(result[0].text).toContain("Welcome");
  });

  it("preserves single newlines within paragraphs", () => {
    const result = parseTxt("Line one\nLine two\n\nSecond paragraph");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Line one\nLine two");
  });
});

// ============================================================
// parseMd
// ============================================================

describe("parseMd", () => {
  it("extracts frontmatter", () => {
    const result = parseMd("---\ntitle: Test\n---\n\n# Heading");
    expect(result.frontmatter).toBe("---\ntitle: Test\n---");
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].kind).toBe("heading");
  });

  it("detects headings", () => {
    const result = parseMd("# Heading 1\n\n## Heading 2\n\n### Heading 3");
    expect(result.paragraphs).toHaveLength(3);
    expect(result.paragraphs[0].kind).toBe("heading");
    expect(result.paragraphs[1].kind).toBe("heading");
    expect(result.paragraphs[2].kind).toBe("heading");
  });

  it("detects code blocks", () => {
    const result = parseMd(
      "Some text\n\n```js\nconst x = 1;\n```\n\nMore text",
    );
    expect(result.paragraphs).toHaveLength(3);
    expect(result.paragraphs[1].kind).toBe("code-block");
    expect(result.paragraphs[1].text).toContain("const x = 1;");
  });

  it("handles fenced code blocks with blank lines inside", () => {
    const result = parseMd("Before\n\n```\nline 1\n\nline 3\n```\n\nAfter");
    expect(result.paragraphs).toHaveLength(3);
    expect(result.paragraphs[1].kind).toBe("code-block");
    expect(result.paragraphs[1].text).toContain("line 1\n\nline 3");
  });

  it("detects bullet lists", () => {
    const result = parseMd("- item 1\n- item 2\n- item 3");
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].kind).toBe("list");
  });

  it("detects numbered lists", () => {
    const result = parseMd("1. first\n2. second\n3. third");
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].kind).toBe("list");
  });

  it("classifies regular paragraphs", () => {
    const result = parseMd("Just a regular paragraph with **bold** text.");
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].kind).toBe("paragraph");
  });

  it("returns empty array for empty input", () => {
    const result = parseMd("");
    expect(result.paragraphs).toHaveLength(0);
    expect(result.frontmatter).toBeUndefined();
  });

  it("parses sample.md test asset", () => {
    const text = loadTestAsset("sample.md");
    const result = parseMd(text);
    expect(result.frontmatter).toBeDefined();
    expect(result.paragraphs.length).toBeGreaterThan(5);

    const kinds = result.paragraphs.map((p) => p.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("list");
    expect(kinds).toContain("code-block");
  });

  it("handles markdown without frontmatter", () => {
    const result = parseMd("# Title\n\nSome content.");
    expect(result.frontmatter).toBeUndefined();
    expect(result.paragraphs).toHaveLength(2);
  });
});

// ============================================================
// parseDocxXml
// ============================================================

describe("parseDocxXml", () => {
  it("extracts paragraphs from document.xml", () => {
    const result = parseDocxXml(SAMPLE_DOCX_XML);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("Hello World");
    expect(result[1].text).toBe("This is a test document");
    expect(result[2].text).toBe("Third paragraph with content.");
  });

  it("handles empty document", () => {
    const xml = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body></w:body>
</w:document>`;
    const result = parseDocxXml(xml);
    expect(result).toHaveLength(0);
  });

  it("handles paragraphs with multiple text runs", () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Part </w:t></w:r>
      <w:r><w:t>one </w:t></w:r>
      <w:r><w:t>here</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
    const result = parseDocxXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Part one here");
  });

  it("skips empty paragraphs", () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Text</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:p>
    <w:p><w:r><w:t>More text</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    const result = parseDocxXml(xml);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Text");
    expect(result[1].text).toBe("More text");
  });

  it("uses 1-based indexing", () => {
    const result = parseDocxXml(SAMPLE_DOCX_XML);
    expect(result[0].index).toBe(1);
    expect(result[1].index).toBe(2);
    expect(result[2].index).toBe(3);
  });
});

// ============================================================
// serializeTxt
// ============================================================

describe("serializeTxt", () => {
  it("joins paragraphs with double newlines", () => {
    const result = serializeTxt([{ text: "First" }, { text: "Second" }]);
    expect(result).toBe("First\n\nSecond\n");
  });

  it("round-trips correctly", () => {
    const original = "First paragraph.\n\nSecond paragraph.\n\nThird.";
    const parsed = parseTxt(original);
    const serialized = serializeTxt(parsed);
    const reparsed = parseTxt(serialized);
    expect(reparsed).toEqual(parsed);
  });
});

// ============================================================
// serializeMd
// ============================================================

describe("serializeMd", () => {
  it("preserves frontmatter", () => {
    const parsed = parseMd("---\ntitle: Test\n---\n\n# Heading\n\nContent");
    const serialized = serializeMd(parsed);
    expect(serialized).toContain("---\ntitle: Test\n---");
    expect(serialized).toContain("# Heading");
    expect(serialized).toContain("Content");
  });

  it("preserves structure without frontmatter", () => {
    const parsed = parseMd("# Title\n\nParagraph text\n\n- list item");
    const serialized = serializeMd(parsed);
    expect(serialized).toContain("# Title");
    expect(serialized).toContain("Paragraph text");
    expect(serialized).toContain("- list item");
  });

  it("round-trips markdown correctly", () => {
    const original = "# Title\n\nSome text.\n\n```js\ncode\n```\n\nMore text.";
    const parsed = parseMd(original);
    const serialized = serializeMd(parsed);
    const reparsed = parseMd(serialized);
    expect(reparsed.paragraphs.map((p) => p.text)).toEqual(
      parsed.paragraphs.map((p) => p.text),
    );
  });
});

// ============================================================
// serializeDocxXml
// ============================================================

describe("serializeDocxXml", () => {
  it("replaces text in XML while preserving structure", () => {
    const translations = new Map<number, string>();
    translations.set(1, "Hola Mundo");
    translations.set(2, "Este es un documento de prueba");

    const result = serializeDocxXml(SAMPLE_DOCX_XML, translations);
    expect(result).toContain("Hola Mundo");
    expect(result).toContain("Este es un documento de prueba");
    // Formatting should be preserved
    expect(result).toContain("<w:b/>");
    expect(result).toContain("<w:rPr>");
  });

  it("preserves untranslated paragraphs", () => {
    const translations = new Map<number, string>();
    translations.set(1, "Translated");
    // Paragraph 2 and 3 are not in the map

    const result = serializeDocxXml(SAMPLE_DOCX_XML, translations);
    expect(result).toContain("Translated");
    expect(result).toContain("test document"); // paragraph 2 unchanged
    expect(result).toContain("Third paragraph with content."); // paragraph 3 unchanged
  });

  it("handles XML special characters in translations", () => {
    const translations = new Map<number, string>();
    translations.set(1, 'Hello <World> & "Friends"');

    const result = serializeDocxXml(SAMPLE_DOCX_XML, translations);
    expect(result).toContain("Hello &lt;World&gt; &amp; &quot;Friends&quot;");
  });
});
