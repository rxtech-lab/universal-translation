import type { EntryWithResource } from "../tools/context-tools";
import { translateEntries } from "../xcloc/agent";
import type { DocumentTranslationEvent } from "./events";
import { DEFAULT_MODEL } from "../config";

export { resolveTermTemplates } from "../xcloc/agent";

/**
 * Translate document entries using the shared translation pipeline
 * with document-specific system prompts.
 */
export async function* translateDocumentEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<DocumentTranslationEvent> {
  yield* translateEntries({
    ...params,
    model: params.model ?? DEFAULT_MODEL,
    formatContext: "document",
  }) as AsyncGenerator<DocumentTranslationEvent>;
}
