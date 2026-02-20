import { strToU8, zipSync } from "fflate";
import sanitizeHtml from "sanitize-html";
import type { TranslationClient } from "../client";
import type { Term } from "../tools/term-tools";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
  VirtualFileTree,
} from "../types";
import { resolveTermTemplates } from "./agent";
import type { HtmlTranslationEvent } from "./events";
import {
  type HtmlSegment,
  type ParsedHtml,
  parseHtml,
  serializeHtml,
} from "./parser";

/** Shape of the format-specific data stored in the DB. */
export interface HtmlFormatData {
  segments: HtmlSegment[];
  originalFileName: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** The original HTML content for lossless round-trip */
  rawHtml: string;
  /** For archives: map of filePath -> rawHtml */
  fileHtmlMap?: Record<string, string>;
  /** Whether this was sourced from a URL */
  sourceUrl?: string;
  /** Head content for preview rendering */
  headContent?: string;
  /** Base URL for resolving relative assets in preview */
  baseUrl?: string;
  /** Whether the source is a full document */
  isFullDocument?: boolean;
}

export class HtmlClient implements TranslationClient<HtmlTranslationEvent> {
  private project: TranslationProject = { resources: [] };
  private sourceLanguage = "";
  private targetLanguage = "";
  private originalFileName = "";
  private projectId: string | null = null;
  private blobUrl: string | null = null;

  // Single-file state
  private parsedHtml: ParsedHtml | null = null;

  // Archive state: one ParsedHtml per file
  private parsedHtmlMap = new Map<string, ParsedHtml>();

  // URL state
  private sourceUrl?: string;
  private baseUrl?: string;

  async load(payload: UploadPayload): Promise<OperationResult> {
    if (payload.kind === "single-file") {
      return this.loadSingleFile(payload.file);
    }

    if (payload.kind === "archive") {
      return this.loadArchive(payload);
    }

    return { hasError: true, errorMessage: "Unsupported payload kind" };
  }

  private async loadSingleFile(file: File): Promise<OperationResult> {
    this.originalFileName = file.name;
    const text = await file.text();
    return this.loadHtmlString(text, "html-main", file.name);
  }

  private loadArchive(payload: {
    tree: VirtualFileTree;
    originalFileName: string;
  }): OperationResult {
    this.originalFileName = payload.originalFileName;

    const htmlFiles = payload.tree.files.filter(
      (f) => /\.(html|htm)$/i.test(f.path) && !f.path.includes("__MACOSX"),
    );

    if (htmlFiles.length === 0) {
      return {
        hasError: true,
        errorMessage: "No HTML files found in the archive",
      };
    }

    const resources: TranslationResource[] = [];

    for (const file of htmlFiles) {
      const text = new TextDecoder().decode(file.content);
      const parsed = parseHtml(text);

      if (parsed.segments.length === 0) continue;

      this.parsedHtmlMap.set(file.path, parsed);

      const entries: TranslationEntry[] = parsed.segments.map((seg) => ({
        id: String(seg.index),
        sourceText: seg.sourceText,
        targetText: "",
        metadata: {
          kind: seg.kind,
          attributeName: seg.attributeName,
          tagName: seg.tagName,
          markerId: seg.markerId,
        },
      }));

      const fileName = file.path.split("/").pop() ?? file.path;
      resources.push({
        id: file.path,
        label: fileName,
        entries,
        sourceLanguage: this.sourceLanguage || undefined,
        targetLanguage: this.targetLanguage || undefined,
      });
    }

    if (resources.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable content found in HTML files",
      };
    }

    this.project = {
      resources,
      sourceLanguage: this.sourceLanguage || undefined,
      targetLanguages: this.targetLanguage ? [this.targetLanguage] : undefined,
    };

    return { hasError: false, data: undefined };
  }

  private loadHtmlString(
    html: string,
    resourceId: string,
    label: string,
  ): OperationResult {
    const parsed = parseHtml(html);

    if (parsed.segments.length === 0) {
      return {
        hasError: true,
        errorMessage: "No translatable content found in the HTML file",
      };
    }

    this.parsedHtml = parsed;

    const entries: TranslationEntry[] = parsed.segments.map((seg) => ({
      id: String(seg.index),
      sourceText: seg.sourceText,
      targetText: "",
      metadata: {
        kind: seg.kind,
        attributeName: seg.attributeName,
        tagName: seg.tagName,
        markerId: seg.markerId,
      },
    }));

    const resource: TranslationResource = {
      id: resourceId,
      label,
      entries,
      sourceLanguage: this.sourceLanguage || undefined,
      targetLanguage: this.targetLanguage || undefined,
    };

    this.project = {
      resources: [resource],
      sourceLanguage: this.sourceLanguage || undefined,
      targetLanguages: this.targetLanguage ? [this.targetLanguage] : undefined,
    };

    return { hasError: false, data: undefined };
  }

  /**
   * Load from URL-sourced HTML (pre-fetched server-side).
   */
  loadFromUrl(html: string, url: string, fileName: string): OperationResult {
    this.sourceUrl = url;
    try {
      const parsed = new URL(url);
      this.baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      this.baseUrl = url;
    }
    this.originalFileName = fileName;
    return this.loadHtmlString(html, "html-main", fileName);
  }

  /** Set source and target languages. */
  setLanguages(sourceLanguage: string, targetLanguage: string): void {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.project.sourceLanguage = sourceLanguage;
    this.project.targetLanguages = [targetLanguage];
    for (const resource of this.project.resources) {
      resource.sourceLanguage = sourceLanguage;
      resource.targetLanguage = targetLanguage;
    }
  }

  getProject(): TranslationProject {
    return this.project;
  }

  getResource(resourceId: string): TranslationResource | undefined {
    return this.project.resources.find((r) => r.id === resourceId);
  }

  getSourceLanguage(): string | undefined {
    return this.sourceLanguage || undefined;
  }

  getTargetLanguages(): string[] {
    return this.targetLanguage ? [this.targetLanguage] : [];
  }

  updateEntry(
    resourceId: string,
    entryId: string,
    update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
  ): OperationResult {
    const resource = this.project.resources.find((r) => r.id === resourceId);
    if (!resource) {
      return {
        hasError: true,
        errorMessage: `Resource not found: ${resourceId}`,
      };
    }

    const entry = resource.entries.find((e) => e.id === entryId);
    if (!entry) {
      return { hasError: true, errorMessage: `Entry not found: ${entryId}` };
    }

    if (update.targetText !== undefined) entry.targetText = update.targetText;
    if (update.comment !== undefined) entry.comment = update.comment;

    return { hasError: false, data: undefined };
  }

  updateEntries(
    updates: Array<{
      resourceId: string;
      entryId: string;
      update: Partial<Pick<TranslationEntry, "targetText" | "comment">>;
    }>,
  ): OperationResult {
    for (const u of updates) {
      const result = this.updateEntry(u.resourceId, u.entryId, u.update);
      if (result.hasError) return result;
    }
    return { hasError: false, data: undefined };
  }

  async *translate(options: {
    model?: string;
    projectId: string;
  }): AsyncGenerator<HtmlTranslationEvent> {
    const { translateHtmlEntries } = await import("./agent");
    const allEntries = this.project.resources.flatMap((r) =>
      r.entries.map((e) => ({ ...e, resourceId: r.id })),
    );
    yield* translateHtmlEntries({
      entries: allEntries,
      sourceLanguage: this.sourceLanguage || "en",
      targetLanguage: this.targetLanguage || "zh-Hans",
      projectId: options.projectId,
      model: options.model,
    });
  }

  render(): React.ReactNode {
    return null;
  }

  /**
   * Get translated HTML for preview rendering.
   * When terms are provided, resolves ${{term}} templates in translations.
   */
  getPreviewHtml(resourceId?: string, terms?: Term[]): string {
    const resId = resourceId ?? this.project.resources[0]?.id;
    if (!resId) return "";

    const resource = this.project.resources.find((r) => r.id === resId);
    if (!resource) return "";

    // Get the parsed HTML for this resource
    const parsed =
      resId === "html-main" ? this.parsedHtml : this.parsedHtmlMap.get(resId);
    if (!parsed) return "";

    const termsMap =
      terms && terms.length > 0 ? new Map(terms.map((t) => [t.id, t])) : null;

    // Build translation map from current entries
    const translations = new Map<number, string>();
    for (const entry of resource.entries) {
      let text = entry.targetText || entry.sourceText;
      if (termsMap) {
        text = resolveTermTemplates(text, termsMap);
      }
      translations.set(Number(entry.id), text);
    }

    let html = serializeHtml(parsed, translations);

    // Sanitize: strip script tags and inline event handlers for safe preview
    html = sanitizePreviewHtml(html);

    // Rewrite relative URLs to absolute for URL-sourced content
    const previewRewriteBase = this.sourceUrl || this.baseUrl;
    if (previewRewriteBase) {
      html = rewriteRelativeUrls(html, previewRewriteBase);
    }

    return html;
  }

  /**
   * Load from DB-stored JSON content.
   */
  loadFromJson(
    content: TranslationProject,
    formatData: HtmlFormatData,
    opts?: { blobUrl?: string; projectId?: string },
  ): OperationResult {
    this.project = content;
    this.originalFileName = formatData.originalFileName;
    this.sourceLanguage = formatData.sourceLanguage;
    this.targetLanguage = formatData.targetLanguage;
    this.sourceUrl = formatData.sourceUrl;
    this.baseUrl = formatData.baseUrl;
    this.blobUrl = opts?.blobUrl ?? null;
    this.projectId = opts?.projectId ?? null;

    // Reconstruct parsed HTML from stored data
    if (formatData.fileHtmlMap) {
      // Archive: reconstruct parsedHtmlMap
      for (const [path, rawHtml] of Object.entries(formatData.fileHtmlMap)) {
        this.parsedHtmlMap.set(path, parseHtml(rawHtml));
      }
    } else if (formatData.rawHtml) {
      // Single file
      this.parsedHtml = parseHtml(formatData.rawHtml);
    }

    return { hasError: false, data: undefined };
  }

  /** Get the format-specific data needed for DB persistence. */
  getFormatData(): HtmlFormatData {
    const data: HtmlFormatData = {
      segments: this.parsedHtml?.segments ?? [],
      originalFileName: this.originalFileName,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      rawHtml: this.parsedHtml?.originalHtml ?? "",
      headContent: this.parsedHtml?.headContent,
      isFullDocument: this.parsedHtml?.isFullDocument,
      sourceUrl: this.sourceUrl,
      baseUrl: this.baseUrl,
    };

    // For archives, store all file HTML
    if (this.parsedHtmlMap.size > 0) {
      const fileHtmlMap: Record<string, string> = {};
      for (const [path, parsed] of this.parsedHtmlMap) {
        fileHtmlMap[path] = parsed.originalHtml;
      }
      data.fileHtmlMap = fileHtmlMap;
    }

    return data;
  }

  async exportFile(
    terms?: Term[],
  ): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  > {
    const termsMap =
      terms && terms.length > 0 ? new Map(terms.map((t) => [t.id, t])) : null;

    const getTranslatedText = (entry: TranslationEntry): string => {
      let text = entry.targetText || entry.sourceText;
      if (termsMap) {
        text = resolveTermTemplates(text, termsMap);
      }
      return text;
    };

    // Single-file export
    if (this.parsedHtml && this.project.resources.length === 1) {
      const resource = this.project.resources[0];
      const translations = new Map<number, string>();
      for (const entry of resource.entries) {
        translations.set(Number(entry.id), getTranslatedText(entry));
      }

      let content = serializeHtml(this.parsedHtml, translations);

      // For URL-sourced content: strip scripts (they won't work outside
      // the original website and break styling when opened locally) and
      // rewrite relative URLs to absolute.
      const exportRewriteBase = this.sourceUrl || this.baseUrl;
      if (exportRewriteBase) {
        content = sanitizeForExport(content);
        content = rewriteRelativeUrls(content, exportRewriteBase);
      }

      const blob = new Blob([content], { type: "text/html;charset=utf-8" });
      const baseName = this.originalFileName.replace(/\.(html|htm)$/i, "");
      const fileName = `${baseName}_${this.targetLanguage || "translated"}.html`;
      return { hasError: false, data: { blob, fileName } };
    }

    // Archive export
    if (this.parsedHtmlMap.size > 0) {
      const zipEntries: Record<string, Uint8Array> = {};

      for (const resource of this.project.resources) {
        const parsed = this.parsedHtmlMap.get(resource.id);
        if (!parsed) continue;

        const translations = new Map<number, string>();
        for (const entry of resource.entries) {
          translations.set(Number(entry.id), getTranslatedText(entry));
        }

        const content = serializeHtml(parsed, translations);
        zipEntries[resource.id] = strToU8(content);
      }

      const zipped = zipSync(zipEntries);
      const blob = new Blob([zipped.buffer as ArrayBuffer], {
        type: "application/zip",
      });
      const baseName = this.originalFileName.replace(/\.zip$/i, "");
      const fileName = `${baseName}_${this.targetLanguage || "translated"}.zip`;
      return { hasError: false, data: { blob, fileName } };
    }

    return { hasError: true, errorMessage: "No content available for export" };
  }

  async save(): Promise<OperationResult<{ projectId: string }>> {
    if (!this.projectId) {
      return {
        hasError: true,
        errorMessage: "No project ID set. Save via server action instead.",
      };
    }

    const { updateProjectContent, updateProjectFormatData } = await import(
      "@/app/actions/projects"
    );
    await updateProjectContent(this.projectId, this.project);
    await updateProjectFormatData(
      this.projectId,
      this.getFormatData() as unknown as Record<string, unknown>,
    );

    return { hasError: false, data: { projectId: this.projectId } };
  }

  async open(openProjectId: string): Promise<OperationResult> {
    const { getProject } = await import("@/app/actions/projects");
    const dbProject = await getProject(openProjectId);
    if (!dbProject) {
      return { hasError: true, errorMessage: "Project not found" };
    }

    const content = dbProject.content as TranslationProject | null;
    const formatData = dbProject.formatData as unknown as HtmlFormatData | null;

    if (!content || !formatData) {
      return { hasError: true, errorMessage: "Project has no content data" };
    }

    return this.loadFromJson(content, formatData, {
      blobUrl: dbProject.blobUrl ?? undefined,
      projectId: openProjectId,
    });
  }
}

/**
 * Sanitize HTML for safe preview rendering using allowlist-based sanitization.
 * Strips scripts, event handlers, javascript: URIs, iframes, embeds, etc.
 */
const PREVIEW_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // Standard content tags
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "caption",
    "figure",
    "figcaption",
    "picture",
    "source",
    "video",
    "audio",
    "details",
    "summary",
    "main",
    "nav",
    "header",
    "footer",
    "section",
    "article",
    "aside",
    // Styling — needed for preview fidelity
    "style",
    "link",
  ],
  disallowedTagsMode: "discard",
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class", "id", "style", "lang", "dir"],
    img: [
      "src",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "srcset",
      "sizes",
    ],
    a: ["href", "title", "target", "rel"],
    link: ["rel", "href", "type", "media"],
    source: ["src", "srcset", "type", "media"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    video: ["src", "poster", "width", "height", "controls"],
    audio: ["src", "controls"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    a: ["http", "https", "mailto", "tel"],
  },
  // style tag is needed for preview fidelity (CSS styling from original page)
  allowVulnerableTags: true,
};

function sanitizePreviewHtml(html: string): string {
  return sanitizeHtml(html, PREVIEW_SANITIZE_OPTIONS);
}

/**
 * Rewrite relative URLs in HTML to absolute URLs using the source page URL.
 * Handles: /path, //host/path, ./path, ../path, and bare paths in
 * href, src, action, srcset, poster, and CSS url() references.
 */
function rewriteRelativeUrls(html: string, sourceUrl: string): string {
  let origin: string;
  let basePath: string;
  try {
    const parsed = new URL(sourceUrl);
    origin = `${parsed.protocol}//${parsed.host}`;
    // Get the directory path (e.g., /wiki/Main_Page → /wiki/)
    const pathParts = parsed.pathname.split("/");
    pathParts.pop(); // remove the filename
    basePath = pathParts.join("/") || "/";
  } catch {
    return html;
  }

  const resolveUrl = (url: string): string => {
    const trimmed = url.trim();
    // Already absolute
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }
    // Protocol-relative: //cdn.example.com/...
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
    // Root-relative: /path/to/resource
    if (trimmed.startsWith("/")) {
      return `${origin}${trimmed}`;
    }
    // Relative: path/to/resource or ./path or ../path
    return `${origin}${basePath}/${trimmed}`;
  };

  let result = html;

  // Rewrite href, src, action, poster attributes
  result = result.replace(
    /(\s(?:href|src|action|poster)\s*=\s*)(["'])((?:(?!\2).)+)\2/gi,
    (_match, prefix: string, quote: string, url: string) => {
      // Skip anchors, mailto, tel, javascript
      if (/^(?:#|mailto:|tel:|javascript:)/i.test(url.trim())) {
        return `${prefix}${quote}${url}${quote}`;
      }
      return `${prefix}${quote}${resolveUrl(url)}${quote}`;
    },
  );

  // Rewrite srcset attribute (comma-separated URLs with optional size descriptors)
  result = result.replace(
    /(\ssrcset\s*=\s*)(["'])((?:(?!\2).)+)\2/gi,
    (_match, prefix: string, quote: string, value: string) => {
      const resolved = value
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const spaceIdx = trimmed.indexOf(" ");
          if (spaceIdx === -1) return resolveUrl(trimmed);
          const url = trimmed.substring(0, spaceIdx);
          const descriptor = trimmed.substring(spaceIdx);
          return resolveUrl(url) + descriptor;
        })
        .join(", ");
      return `${prefix}${quote}${resolved}${quote}`;
    },
  );

  // Rewrite CSS url() in style attributes and <style> blocks
  result = result.replace(
    /url\(\s*(["']?)((?:(?!\1\)).)+)\1\s*\)/gi,
    (_match, quote: string, url: string) => {
      if (/^(?:data:|https?:|#)/i.test(url.trim())) return _match;
      return `url(${quote}${resolveUrl(url)}${quote})`;
    },
  );

  return result;
}

/**
 * Sanitize HTML for export. More permissive than preview (keeps forms, inputs, etc.)
 * but strips scripts, event handlers, and javascript: URIs.
 */
const EXPORT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // All standard tags except script/noscript
    ...sanitizeHtml.defaults.allowedTags,
    "html",
    "head",
    "body",
    "title",
    "link",
    "meta",
    "style",
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "caption",
    "colgroup",
    "col",
    "figure",
    "figcaption",
    "picture",
    "source",
    "video",
    "audio",
    "details",
    "summary",
    "main",
    "nav",
    "header",
    "footer",
    "section",
    "article",
    "aside",
    "form",
    "input",
    "textarea",
    "select",
    "option",
    "button",
    "label",
    "fieldset",
    "legend",
  ],
  disallowedTagsMode: "discard",
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class", "id", "style", "lang", "dir", "title", "role", "tabindex"],
    a: ["href", "target", "rel", "download"],
    img: ["src", "alt", "width", "height", "loading", "srcset", "sizes"],
    link: ["rel", "href", "type", "media", "crossorigin"],
    meta: ["charset", "name", "content", "viewport"],
    source: ["src", "srcset", "type", "media"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    video: ["src", "poster", "width", "height", "controls"],
    audio: ["src", "controls"],
    form: ["method", "action", "enctype"],
    input: ["type", "name", "value", "placeholder", "required", "disabled"],
    textarea: ["name", "placeholder", "rows", "cols", "required"],
    select: ["name", "required"],
    option: ["value", "selected"],
    button: ["type", "name", "value", "disabled"],
    label: ["for"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    a: ["http", "https", "mailto", "tel"],
  },
  // style tag is needed for export fidelity (CSS styling from original page)
  allowVulnerableTags: true,
};

function sanitizeForExport(html: string): string {
  return sanitizeHtml(html, EXPORT_SANITIZE_OPTIONS);
}
