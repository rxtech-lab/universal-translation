import type { EntryWithResource } from "../tools/context-tools";
import { translateEntries } from "../xcloc/agent";
import type { SrtTranslationEvent } from "./events";

export { resolveTermTemplates } from "../xcloc/agent";

/**
 * Translate SRT subtitle entries using the shared translation pipeline
 * with subtitle-specific system prompts.
 */
export async function* translateSrtEntries(params: {
  entries: EntryWithResource[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId: string;
  model?: string;
}): AsyncGenerator<SrtTranslationEvent> {
  yield* translateEntries({
    ...params,
    formatContext: "subtitle",
  }) as AsyncGenerator<SrtTranslationEvent>;
}
