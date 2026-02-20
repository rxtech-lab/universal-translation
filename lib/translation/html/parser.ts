// ============================================================
// HTML parser and serializer
// Uses cheerio for proper DOM-based parsing and serialization
// ============================================================

import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import sanitizeHtml from "sanitize-html";

export interface HtmlSegment {
  /** 1-based index, used as TranslationEntry.id */
  index: number;
  /** The translatable text. Inline HTML tags are preserved. */
  sourceText: string;
  /** Segment type: text content or attribute value */
  kind: "text" | "attribute";
  /** For attribute segments: the attribute name */
  attributeName?: string;
  /** Tag name of the element containing this segment */
  tagName?: string;
  /** Unique marker ID used for round-trip serialization */
  markerId: string;
}

export interface ParsedHtml {
  /** The full original HTML string for lossless round-trip */
  originalHtml: string;
  /** Extracted translatable segments */
  segments: HtmlSegment[];
  /** Content within <head> tags (for preview) */
  headContent?: string;
  /** Whether the source has <!DOCTYPE> or <html> tag */
  isFullDocument: boolean;
}

// Block-level elements whose text content is a translatable segment
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "td",
  "th",
  "dt",
  "dd",
  "figcaption",
  "blockquote",
  "caption",
  "summary",
  "label",
  "option",
  "title",
  "button",
]);

// Tags whose content should be skipped entirely
const SKIP_TAGS = new Set([
  "script",
  "style",
  "svg",
  "pre",
  "code",
  "noscript",
]);

// Inline tags that are preserved inside sourceText
const INLINE_TAGS = new Set([
  "b",
  "i",
  "em",
  "strong",
  "a",
  "span",
  "code",
  "sub",
  "sup",
  "mark",
  "small",
  "abbr",
  "time",
  "cite",
  "q",
  "u",
  "s",
  "del",
  "ins",
  "br",
]);

// Attributes that should be extracted as translatable segments
const TRANSLATABLE_ATTRS = ["alt", "title", "placeholder", "aria-label"];

// Sanitize-html config for translation text: only allow safe inline tags
const INLINE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...INLINE_TAGS],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    span: ["class", "style"],
    abbr: ["title"],
    time: ["datetime"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

/**
 * Parse HTML into translatable segments using cheerio.
 * Works in both Node and browser environments.
 */
export function parseHtml(html: string): ParsedHtml {
  const cleaned = html.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  if (!cleaned.trim()) {
    return { originalHtml: html, segments: [], isFullDocument: false };
  }

  const isFullDocument =
    /<!doctype\s/i.test(cleaned) || /<html[\s>]/i.test(cleaned);

  const $ = cheerio.load(cleaned, { xml: false });

  // Extract <head> content for preview
  const headEl = $("head");
  const headContent = headEl.length ? (headEl.html() ?? undefined) : undefined;

  const segments: HtmlSegment[] = [];
  let index = 1;

  // Build a selector for skip tag ancestors
  const skipSelector = [...SKIP_TAGS].join(",");

  // Walk all block-level elements in document order
  const blockSelector = [...BLOCK_TAGS].join(",");
  $(blockSelector).each((_i, el) => {
    const $el = $(el);
    const tagName =
      "tagName" in el ? (el as Element).tagName.toLowerCase() : "";

    // Skip if inside a SKIP_TAG ancestor
    if ($el.parents(skipSelector).length > 0) return;

    // Skip if has nested block children (their text will be extracted separately)
    let hasNestedBlock = false;
    for (const bt of BLOCK_TAGS) {
      if ($el.find(bt).length > 0) {
        hasNestedBlock = true;
        break;
      }
    }
    if (hasNestedBlock) return;

    // Get innerHTML
    const innerHtml = $el.html();
    if (!innerHtml) return;

    // Check if there's actual text content (not just tags/whitespace)
    const textOnly = $el.text().trim();
    if (!textOnly) return;

    const cleanedHtml = cleanInnerHtml(innerHtml);
    const markerId = `seg-${index}`;

    segments.push({
      index,
      sourceText: cleanedHtml,
      kind: "text",
      tagName,
      markerId,
    });
    index++;
  });

  // Extract translatable attributes
  for (const attr of TRANSLATABLE_ATTRS) {
    $(`[${attr}]`).each((_i, el) => {
      const $el = $(el);
      const value = $el.attr(attr);
      if (!value || !value.trim()) return;

      const elTagName =
        "tagName" in el ? (el as Element).tagName.toLowerCase() : "";
      const markerId = `attr-${index}`;

      segments.push({
        index,
        sourceText: decodeHtmlEntities(value),
        kind: "attribute",
        attributeName: attr,
        tagName: elTagName,
        markerId,
      });
      index++;
    });
  }

  return {
    originalHtml: html,
    segments,
    headContent,
    isFullDocument,
  };
}

/**
 * Apply translations to the original HTML.
 * Uses cheerio for proper DOM manipulation and sanitizes translation text
 * to prevent XSS injection.
 */
export function serializeHtml(
  parsed: ParsedHtml,
  translations: Map<number, string>,
): string {
  // Fast path: no changes needed
  if (translations.size === 0) return parsed.originalHtml;

  const $ = cheerio.load(parsed.originalHtml, { xml: false });

  // Apply text segment translations
  const textSegments = parsed.segments.filter((s) => s.kind === "text");
  for (const segment of textSegments) {
    const translation = translations.get(segment.index);
    if (translation === undefined || !segment.tagName) continue;

    // Sanitize translation: only allow safe inline tags
    const safeTranslation = sanitizeHtml(translation, INLINE_SANITIZE_OPTIONS);

    // Find the matching element by tag name + source text
    $(segment.tagName).each((_i, el) => {
      const $el = $(el);
      const currentHtml = cleanInnerHtml($el.html() ?? "");
      if (currentHtml === segment.sourceText) {
        $el.html(safeTranslation);
        return false; // stop after first match
      }
    });
  }

  // Apply attribute translations
  const attrSegments = parsed.segments.filter((s) => s.kind === "attribute");
  for (const segment of attrSegments) {
    const translation = translations.get(segment.index);
    if (translation === undefined || !segment.attributeName) continue;

    const attrName = segment.attributeName;
    $(`[${attrName}]`).each((_i, el) => {
      const $el = $(el);
      const currentVal = decodeHtmlEntities($el.attr(attrName) ?? "");
      if (currentVal === segment.sourceText) {
        $el.attr(attrName, translation);
        return false; // stop after first match
      }
    });
  }

  return $.html();
}

// ============================================================
// Utility functions
// ============================================================

/**
 * Clean up innerHTML for use as sourceText.
 * Trims whitespace, normalizes internal spaces, but preserves inline HTML tags.
 */
function cleanInnerHtml(html: string): string {
  return html
    .replace(/\n\s*/g, " ") // collapse newlines and leading whitespace
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
