import type { EntryWithResource } from "../tools/context-tools";
import { translateEntries } from "../xcloc/agent";
import type { PoTranslationEvent } from "./events";
import { DEFAULT_MODEL } from "../config";

export { resolveTermTemplates } from "../xcloc/agent";

/**
 * Translate PO localization entries using the shared translation pipeline
 * with PO-specific system prompts.
 */
export async function* translatePoEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<PoTranslationEvent> {
  yield* translateEntries({
    ...params,
    model: params.model ?? DEFAULT_MODEL,
    formatContext: "po-localization",
  }) as AsyncGenerator<PoTranslationEvent>;
}
