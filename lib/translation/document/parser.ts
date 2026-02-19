// ============================================================
// Document parser and serializer for TXT, MD, and DOCX formats
// ============================================================

export type DocumentSubType = "txt" | "md" | "docx";

export interface DocumentParagraph {
  /** 1-based index. */
  index: number;
  /** The text content of this paragraph. */
  text: string;
  /** Kind of block (markdown only). */
  kind?: "heading" | "code-block" | "list" | "paragraph" | "frontmatter";
}

export interface ParsedDocument {
  subType: DocumentSubType;
  paragraphs: DocumentParagraph[];
  /** For markdown: raw frontmatter string; for docx: original XML string. */
  rawMetadata?: string;
}

// ============================================================
// TXT parsing
// ============================================================

export function parseTxt(text: string): DocumentParagraph[] {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return [];

  return cleaned
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, i) => ({
      index: i + 1,
      text: block,
    }));
}

export function serializeTxt(paragraphs: { text: string }[]): string {
  return paragraphs.map((p) => p.text).join("\n\n") + "\n";
}

// ============================================================
// Markdown parsing
// ============================================================

export interface ParsedMarkdown {
  frontmatter?: string;
  paragraphs: DocumentParagraph[];
}

export function parseMd(text: string): ParsedMarkdown {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return { paragraphs: [] };

  let body = cleaned;
  let frontmatter: string | undefined;

  // Extract frontmatter
  if (cleaned.startsWith("---")) {
    const endIdx = cleaned.indexOf("\n---", 3);
    if (endIdx > 0) {
      frontmatter = cleaned.slice(0, endIdx + 4);
      body = cleaned.slice(endIdx + 4).trim();
    }
  }

  if (!body) return { frontmatter, paragraphs: [] };

  // Split into blocks, but handle fenced code blocks as atomic units
  const blocks: string[] = [];
  const lines = body.split("\n");
  let current: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (!inCodeFence && /^```/.test(line)) {
      // Start of code fence — flush current block
      if (current.length > 0) {
        const block = current.join("\n").trim();
        if (block) blocks.push(block);
        current = [];
      }
      inCodeFence = true;
      current.push(line);
    } else if (inCodeFence && /^```\s*$/.test(line)) {
      // End of code fence
      current.push(line);
      blocks.push(current.join("\n"));
      current = [];
      inCodeFence = false;
    } else if (inCodeFence) {
      current.push(line);
    } else if (line.trim() === "") {
      // Blank line — flush current block
      if (current.length > 0) {
        const block = current.join("\n").trim();
        if (block) blocks.push(block);
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  // Flush remaining
  if (current.length > 0) {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
  }

  const paragraphs: DocumentParagraph[] = blocks.map((block, i) => ({
    index: i + 1,
    text: block,
    kind: classifyMdBlock(block),
  }));

  return { frontmatter, paragraphs };
}

function classifyMdBlock(block: string): DocumentParagraph["kind"] {
  if (/^```/.test(block)) return "code-block";
  if (/^#{1,6}\s/.test(block)) return "heading";
  if (/^[-*+]\s/m.test(block) || /^\d+\.\s/m.test(block)) return "list";
  return "paragraph";
}

export function serializeMd(parsed: ParsedMarkdown): string {
  const parts: string[] = [];
  if (parsed.frontmatter) {
    parts.push(parsed.frontmatter);
  }
  for (const p of parsed.paragraphs) {
    parts.push(p.text);
  }
  return parts.join("\n\n") + "\n";
}

// ============================================================
// DOCX parsing (word/document.xml)
// ============================================================

/**
 * Extract paragraphs from OOXML document.xml.
 * Each <w:p> element becomes a paragraph. Text is extracted from <w:t> elements.
 * Empty paragraphs are preserved to maintain structure.
 */
export function parseDocxXml(xml: string): DocumentParagraph[] {
  const paragraphs: DocumentParagraph[] = [];

  // Match all <w:p>...</w:p> elements (including self-closing)
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  let index = 1;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pXml = pMatch[0];

    // Extract all <w:t> text content within this paragraph
    const textParts: string[] = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;

    while ((tMatch = tRegex.exec(pXml)) !== null) {
      textParts.push(tMatch[1]);
    }

    const text = textParts.join("");

    // Only include paragraphs with actual text
    if (text.trim()) {
      paragraphs.push({ index, text });
      index++;
    }
  }

  return paragraphs;
}

/**
 * Replace paragraph text in the original document.xml while preserving all formatting.
 * Maps translated text back into the original XML structure.
 *
 * Strategy: For each <w:p> with text, replace the text content of the first <w:t>
 * with the full translated text and clear subsequent <w:t> elements.
 * This preserves the run structure while replacing content.
 */
export function serializeDocxXml(
  originalXml: string,
  translatedParagraphs: Map<number, string>,
): string {
  let result = originalXml;
  let paragraphIndex = 1;

  // Process each <w:p> element
  result = result.replace(/(<w:p[\s>][\s\S]*?<\/w:p>)/g, (pXml) => {
    // Check if this paragraph has any text
    const tRegex = /<w:t[^>]*>[\s\S]*?<\/w:t>/g;
    const tMatches = [...pXml.matchAll(tRegex)];

    if (tMatches.length === 0) return pXml;

    // Check if this paragraph has actual text content
    const hasText = tMatches.some((m) => {
      const textMatch = m[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
      return textMatch && textMatch[1].trim();
    });

    if (!hasText) return pXml;

    const translated = translatedParagraphs.get(paragraphIndex);
    paragraphIndex++;

    if (translated === undefined) return pXml;

    // Replace: put all text in the first <w:t>, clear the rest
    let firstReplaced = false;
    return pXml.replace(
      /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g,
      (_match, attrs: string, _text: string) => {
        if (!firstReplaced) {
          firstReplaced = true;
          // Ensure xml:space="preserve" to maintain whitespace
          const hasPreserve = attrs.includes('xml:space="preserve"');
          const newAttrs = hasPreserve
            ? attrs
            : ` xml:space="preserve"${attrs}`;
          return `<w:t${newAttrs}>${escapeXml(translated)}</w:t>`;
        }
        // Clear subsequent <w:t> elements
        return `<w:t${attrs}></w:t>`;
      },
    );
  });

  return result;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
