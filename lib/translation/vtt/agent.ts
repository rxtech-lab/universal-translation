import type { EntryWithResource } from "../tools/context-tools";
import { translateEntries } from "../xcloc/agent";
import type { VttTranslationEvent } from "./events";
import { DEFAULT_MODEL } from "../config";

export { resolveTermTemplates } from "../xcloc/agent";

/**
 * Translate WebVTT subtitle entries using the shared translation pipeline
 * with subtitle-specific system prompts.
 */
export async function* translateVttEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<VttTranslationEvent> {
  yield* translateEntries({
    ...params,
    model: params.model ?? DEFAULT_MODEL,
    formatContext: "subtitle",
  }) as AsyncGenerator<VttTranslationEvent>;
}
