import {
  createGateway,
  generateText,
  Output,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod";
import type { TranslationClient } from "../client";
import {
  createContextTools,
  type EntryWithResource,
} from "../tools/context-tools";
import {
  createTermTools,
  slugifyTermId,
  type Term,
  uniqueTermSlug,
} from "../tools/term-tools";
import type { XclocTranslationEvent } from "./events";
import { BATCH_SIZE, DEFAULT_MODEL } from "../config";

// ---- Term template resolution ----------------------------------

const TERM_TEMPLATE_RE = /\$\{\{([a-z0-9-]+)\}\}/g;

export function resolveTermTemplates(
  text: string,
  termsMap: Map<string, Term>,
): string {
  return text.replace(TERM_TEMPLATE_RE, (_match, termId: string) => {
    const term = termsMap.get(termId);
    return term?.translation || _match;
  });
}

// ---- Helpers ---------------------------------------------------

function flattenEntries(
  client: TranslationClient<XclocTranslationEvent>,
): EntryWithResource[] {
  const project = client.getProject();
  return project.resources.flatMap((r) =>
    r.entries.map((e) => ({ ...e, resourceId: r.id })),
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function createModel(modelId?: string) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  return gateway(modelId ?? DEFAULT_MODEL);
}

// ---- Agent 1: Terminology Scanner ------------------------------

const termSchema = z.object({
  id: z
    .string()
    .describe("Kebab-case slug ID for the term, e.g. 'argo-trading'"),
  originalText: z
    .string()
    .describe("The exact text as it appears in the source"),
  translation: z
    .string()
    .describe("Recommended translation, or empty if unsure"),
  comment: z
    .string()
    .optional()
    .describe("Why this term needs consistent translation"),
});

async function* scanTerminology(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  model: ReturnType<typeof createModel>;
  formatContext?: string;
}): AsyncGenerator<XclocTranslationEvent> {
  yield { type: "terminology-scan-start" };

  const sourceTexts = params.entries
    .filter((e) => e.sourceText.trim())
    .map((e, i) => `${i + 1}. ${e.sourceText}`)
    .join("\n");

  const domainContext =
    params.formatContext === "subtitle"
      ? "subtitle translation"
      : params.formatContext === "document"
        ? "document translation"
        : params.formatContext === "html"
          ? "HTML content translation"
          : "software localization";

  const result = await generateText({
    model: params.model,
    output: Output.array({ element: termSchema }),
    system: `You are a terminology extraction specialist for ${domainContext}.
Source language: ${params.sourceLanguage}
Target language: ${params.targetLanguage}

Analyze the source texts and identify terms that need consistent translation:
- Brand names and product names
- Technical terms specific to this domain
${params.formatContext === "subtitle" ? "- Character names and recurring phrases\n- Location names mentioned in dialogue" : params.formatContext === "document" ? "- Domain-specific terminology\n- Recurring phrases and key concepts" : "- UI element names appearing in multiple strings"}
- Proper nouns and abbreviations

For each term, provide a kebab-case ID, the original text, a recommended translation, and a brief comment.
Only extract terms that appear in multiple strings or are critical for consistency.`,
    prompt: `Extract terminology from these source texts:\n\n${sourceTexts}`,
  });

  // Ensure unique slugs
  const existingSlugs = new Set<string>();
  const rawTerms = (result.output ?? []) as z.infer<typeof termSchema>[];
  const terms: Term[] = rawTerms.map((t) => {
    const baseSlug = t.id || slugifyTermId(t.originalText);
    const slug = uniqueTermSlug(baseSlug, existingSlugs);
    existingSlugs.add(slug);
    return {
      id: crypto.randomUUID(),
      slug,
      originalText: t.originalText,
      translation: t.translation,
      comment: t.comment ?? undefined,
    };
  });

  yield { type: "terminology-found", terms };

  return terms;
}

// ---- Agent 2: Translator (batched, streaming) ------------------

const translationResultSchema = z.object({
  translations: z.array(
    z.object({
      id: z.string().describe("The entry ID, exactly as given"),
      targetText: z
        .string()
        .describe("The translation, using $\\{\\{term-id\\}\\} for terms"),
    }),
  ),
});

async function* translateBatch(params: {
  batch: EntryWithResource[];
  batchIndex: number;
  totalBatches: number;
  allEntries: EntryWithResource[];
  terms: Term[];
  sourceLanguage: string;
  targetLanguage: string;
  model: ReturnType<typeof createModel>;
  globalOffset: number;
  formatContext?: string;
}): AsyncGenerator<XclocTranslationEvent> {
  for (const entry of params.batch) {
    yield {
      type: "translate-line-start",
      resourceId: entry.resourceId,
      entryId: entry.id,
    };
  }

  const termListLines = params.terms.map(
    (t) =>
      "- ${{" +
      t.slug +
      '}} = "' +
      t.originalText +
      '" → "' +
      t.translation +
      '"',
  );
  const termList = termListLines.join("\n");

  const entryList = params.batch
    .map(
      (e, i) =>
        `[${params.globalOffset + i}] id="${e.id}" source="${e.sourceText}"${e.comment ? ` note="${e.comment}"` : ""}`,
    )
    .join("\n");

  const contextTools = createContextTools(params.allEntries);
  const termTools = createTermTools(params.terms);

  const templateFormat = "${{term-id}}";
  const exampleTemplate = "${{argo-trading}}";

  const isSubtitle = params.formatContext === "subtitle";
  const isPo = params.formatContext === "po-localization";

  let systemRole: string;
  let formatRules: string;

  if (isSubtitle) {
    systemRole = "You are a professional subtitle translator.";
    formatRules = `1. For recognized terminology, use the template format ${templateFormat} instead of translating directly.
   Example: if "Argo Trading" has ID "argo-trading", translate "About Argo Trading" as "关于 ${exampleTemplate}".
2. Keep translations concise — subtitles must be readable within the cue's time window.
3. Preserve line breaks within cues when present.
4. Maintain the tone and register of spoken dialogue.
5. Use lookup tools if you need context about surrounding subtitle cues.`;
  } else if (isPo) {
    systemRole =
      "You are a professional translator for software and website localization.";
    formatRules = `1. For recognized terminology, use the template format ${templateFormat} instead of translating directly.
   Example: if "Argo Trading" has ID "argo-trading", translate "About Argo Trading" as "关于 ${exampleTemplate}".
2. Preserve printf-style format specifiers exactly: %s, %d, %f, %ld, %1$s, %2$d, %%, etc.
3. Preserve Python-style format specifiers: {0}, {name}, %(name)s, etc.
4. Preserve markdown formatting (**bold**, etc.).
5. Use lookup tools if you need context about surrounding strings.
6. Keep translations natural and appropriate for app/website UI.
7. For strings that are only format specifiers or symbols, keep them as-is.
8. Preserve literal \\n newline sequences in translations.`;
  } else if (params.formatContext === "document") {
    systemRole = "You are a professional document translator.";
    formatRules = `1. For recognized terminology, use the template format ${templateFormat} instead of translating directly.
   Example: if "Argo Trading" has ID "argo-trading", translate "About Argo Trading" as "关于 ${exampleTemplate}".
2. Preserve markdown formatting (headings, bold, italic, links, code spans) exactly as-is.
3. Preserve paragraph structure — do not merge or split paragraphs.
4. Maintain the tone, register, and style of the original document.
5. Use lookup tools if you need context about surrounding paragraphs.`;
  } else if (params.formatContext === "html") {
    systemRole = "You are a professional HTML content translator.";
    formatRules = `1. For recognized terminology, use the template format ${templateFormat} instead of translating directly.
   Example: if "Argo Trading" has ID "argo-trading", translate "About Argo Trading" as "关于 ${exampleTemplate}".
2. Preserve all HTML tags and their attributes exactly as-is. Only translate the text content.
3. For inline elements like <b>, <i>, <em>, <a>, <span>, keep the tags intact and translate text within them.
4. Preserve HTML entities (e.g., &amp;, &nbsp;) unless they represent translatable content.
5. Do not add or remove HTML tags.
6. Use lookup tools if you need context about surrounding content blocks.`;
  } else {
    systemRole = "You are a professional translator for software localization.";
    formatRules = `1. For recognized terminology, use the template format ${templateFormat} instead of translating directly.
   Example: if "Argo Trading" has ID "argo-trading", translate "About Argo Trading" as "关于 ${exampleTemplate}".
2. Preserve format specifiers exactly: %@, %lld, %1$@, %2$@, %%, etc.
3. Preserve markdown formatting (**bold**, etc.).
4. Use lookup tools if you need context about surrounding strings.
5. Keep translations natural and appropriate for a mobile/desktop app UI.
6. For strings that are only format specifiers or symbols (like "%@", "|", "•"), keep them as-is.`;
  }

  const result = streamText({
    model: params.model,
    tools: { ...contextTools, ...termTools },
    stopWhen: stepCountIs(5),
    system: `${systemRole}

Source language: ${params.sourceLanguage}
Target language: ${params.targetLanguage}

RULES:
${formatRules}

Available terms:
${termList || "(none)"}

After using any tools for context, output your translations as a JSON object with this exact structure:
{"translations": [{"id": "entry-id", "targetText": "translated text"}, ...]}

You MUST include all entries in the output. Use the exact entry IDs as given.`,
    prompt: `Translate these entries:\n\n${entryList}`,
  });

  // Collect the full text response while emitting agent events
  let fullText = "";
  let lastEmitTime = 0;
  const THROTTLE_MS = 300;

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      fullText += part.text;

      const now = Date.now();
      if (now - lastEmitTime >= THROTTLE_MS) {
        lastEmitTime = now;
        yield {
          type: "agent-text-delta" as const,
          batchIndex: params.batchIndex,
          text: fullText.slice(-200),
        };
      }
    } else if (part.type === "tool-call") {
      yield {
        type: "agent-tool-call" as const,
        batchIndex: params.batchIndex,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input as Record<string, unknown>,
      };
    } else if (part.type === "tool-result") {
      yield {
        type: "agent-tool-result" as const,
        batchIndex: params.batchIndex,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
      };
    }
  }

  // Final text delta so the frontend always gets the latest state
  yield {
    type: "agent-text-delta" as const,
    batchIndex: params.batchIndex,
    text: fullText.slice(-200),
  };

  // Parse the JSON from the response
  const jsonMatch = fullText.match(/\{[\s\S]*"translations"[\s\S]*\}/);
  if (!jsonMatch) {
    yield {
      type: "error",
      message: `Failed to parse translation response for batch ${params.batchIndex + 1}`,
    };
    return;
  }

  try {
    const parsed = translationResultSchema.parse(JSON.parse(jsonMatch[0]));

    for (const translation of parsed.translations) {
      const entry = params.batch.find((e) => e.id === translation.id);
      if (!entry) continue;

      yield {
        type: "entry-translated",
        resourceId: entry.resourceId,
        entryId: translation.id,
        targetText: translation.targetText,
        current: params.globalOffset + params.batch.indexOf(entry) + 1,
        total: params.allEntries.length,
      };
    }
  } catch (err) {
    yield {
      type: "error",
      message: `Failed to parse batch ${params.batchIndex + 1} translations: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  yield {
    type: "batch-complete",
    batchIndex: params.batchIndex,
    totalBatches: params.totalBatches,
  };
}

// ---- Standalone entry translator (no client dependency) --------

/**
 * Translate entries without needing a full TranslationClient instance.
 * Used by the SSE API route — accepts raw data and streams events back.
 * Term templates (${{term-id}}) are preserved in targetText for client-side resolution.
 */
export async function* translateEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
  formatContext?: string;
}): AsyncGenerator<XclocTranslationEvent> {
  const model = createModel(params.model);

  // Phase 1: Scan terminology
  let terms: Term[] = [];
  const scanner = scanTerminology({
    entries: params.entries,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    model,
    formatContext: params.formatContext,
  });

  for await (const event of scanner) {
    yield event;
    if (event.type === "terminology-found") {
      terms = event.terms;
    }
  }

  // Phase 2: Translate in batches (templates kept as-is)
  const batches = chunk(params.entries, BATCH_SIZE);
  yield { type: "translate-start", total: params.entries.length };

  for (let i = 0; i < batches.length; i++) {
    const batchGen = translateBatch({
      batch: batches[i],
      batchIndex: i,
      totalBatches: batches.length,
      allEntries: params.entries,
      terms,
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      model,
      globalOffset: i * BATCH_SIZE,
      formatContext: params.formatContext,
    });

    for await (const event of batchGen) {
      yield event;
    }
  }

  yield { type: "term-resolution-complete" };
  yield { type: "complete" };
}

// ---- Full orchestrator (with client) ---------------------------

export async function* translateProject(params: {
  client: TranslationClient<XclocTranslationEvent>;
  projectId: string;
  model?: string;
}): AsyncGenerator<XclocTranslationEvent> {
  const model = createModel(params.model);
  const allEntries = flattenEntries(params.client);
  const sourceLanguage = params.client.getSourceLanguage() ?? "en";
  const targetLanguages = params.client.getTargetLanguages();
  const targetLanguage = targetLanguages[0] ?? "zh-Hans";

  // Phase 1: Scan terminology
  let terms: Term[] = [];
  const scanner = scanTerminology({
    entries: allEntries,
    sourceLanguage,
    targetLanguage,
    model,
  });

  for await (const event of scanner) {
    yield event;
    if (event.type === "terminology-found") {
      terms = event.terms;
    }
  }

  // Phase 2: Translate in batches
  const batches = chunk(allEntries, BATCH_SIZE);
  yield { type: "translate-start", total: allEntries.length };

  const updates: Array<{
    resourceId: string;
    entryId: string;
    update: { targetText: string };
  }> = [];

  for (let i = 0; i < batches.length; i++) {
    const batchGen = translateBatch({
      batch: batches[i],
      batchIndex: i,
      totalBatches: batches.length,
      allEntries,
      terms,
      sourceLanguage,
      targetLanguage,
      model,
      globalOffset: i * BATCH_SIZE,
    });

    for await (const event of batchGen) {
      yield event;
      if (event.type === "entry-translated") {
        updates.push({
          resourceId: event.resourceId,
          entryId: event.entryId,
          update: { targetText: event.targetText },
        });
      }
    }
  }

  // Phase 3: Apply updates (templates kept as-is for client-side resolution)
  params.client.updateEntries(updates);

  yield { type: "term-resolution-complete" };
  yield { type: "complete" };
}
