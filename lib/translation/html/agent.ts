import type { EntryWithResource } from "../tools/context-tools";
import { translateEntries } from "../xcloc/agent";
import type { HtmlTranslationEvent } from "./events";
import { DEFAULT_MODEL } from "../config";

export { resolveTermTemplates } from "../xcloc/agent";

/**
 * Translate HTML entries using the shared translation pipeline
 * with HTML-specific system prompts.
 */
export async function* translateHtmlEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<HtmlTranslationEvent> {
  yield* translateEntries({
    ...params,
    model: params.model ?? DEFAULT_MODEL,
    formatContext: "html",
  }) as AsyncGenerator<HtmlTranslationEvent>;
}
