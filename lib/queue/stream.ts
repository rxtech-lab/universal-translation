import { createUIMessageStreamResponse } from "ai";
import { getCachedRunEvents } from "./stream-cache";
import { subscribeToRunEvents } from "./consumer";
import type {
  ChatRunEvent,
  RunEventEnvelope,
  TranslationRunEvent,
} from "./types";
import { isChatTerminalChunk, isTranslationTerminalEvent } from "./types";

export function mergeRunEvents(
  cached: RunEventEnvelope[],
  buffered: RunEventEnvelope[],
) {
  const merged = [...cached, ...buffered].sort((a, b) => a.seq - b.seq);
  const deduped: RunEventEnvelope[] = [];
  let lastSeq = -1;

  for (const event of merged) {
    if (event.seq <= lastSeq) continue;
    deduped.push(event);
    lastSeq = event.seq;
  }

  return deduped;
}

export function createTranslationEventStream(runId: string) {
  let unsubscribe: (() => Promise<void>) | undefined;

  return new ReadableStream<string>({
    async start(controller) {
      let closed = false;
      let replaying = true;
      let lastSeq = 0;
      const buffered: RunEventEnvelope[] = [];

      const close = async (unsubscribe?: () => Promise<void>) => {
        if (closed) return;
        closed = true;
        await unsubscribe?.();
        controller.close();
      };

      const handleEvent = async (
        envelope: RunEventEnvelope,
        unsubscribe?: () => Promise<void>,
      ) => {
        if (closed || envelope.kind !== "translation-event") return;
        if (envelope.seq <= lastSeq) return;

        lastSeq = envelope.seq;
        controller.enqueue(`data: ${JSON.stringify(envelope.payload)}\n\n`);

        if (isTranslationTerminalEvent(envelope.payload)) {
          await close(unsubscribe);
        }
      };

      unsubscribe = await subscribeToRunEvents(runId, async (envelope) => {
        if (closed) return;
        if (replaying) {
          buffered.push(envelope);
          return;
        }

        await handleEvent(envelope, unsubscribe);
      });

      try {
        const cached = await getCachedRunEvents(runId);
        const merged = mergeRunEvents(cached, buffered);
        replaying = false;

        for (const envelope of merged) {
          await handleEvent(envelope, unsubscribe);
          if (closed) return;
        }
      } catch (error) {
        await unsubscribe();
        controller.error(error);
      }
    },
    async cancel() {
      await unsubscribe?.();
    },
  });
}

export function createChatStreamResponse(runId: string) {
  let unsubscribe: (() => Promise<void>) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let replaying = true;
      let lastSeq = 0;
      const buffered: RunEventEnvelope[] = [];

      const close = async (unsubscribe?: () => Promise<void>) => {
        if (closed) return;
        closed = true;
        await unsubscribe?.();
        controller.close();
      };

      const handleEvent = async (
        envelope: RunEventEnvelope,
        unsubscribe?: () => Promise<void>,
      ) => {
        if (closed || envelope.kind !== "chat-ui-chunk") return;
        if (envelope.seq <= lastSeq) return;

        lastSeq = envelope.seq;
        controller.enqueue((envelope as ChatRunEvent).payload);

        if (isChatTerminalChunk((envelope as ChatRunEvent).payload)) {
          await close(unsubscribe);
        }
      };

      unsubscribe = await subscribeToRunEvents(runId, async (envelope) => {
        if (closed) return;
        if (replaying) {
          buffered.push(envelope);
          return;
        }

        await handleEvent(envelope, unsubscribe);
      });

      try {
        const cached = await getCachedRunEvents(runId);
        const merged = mergeRunEvents(cached, buffered);
        replaying = false;

        for (const envelope of merged) {
          await handleEvent(envelope, unsubscribe);
          if (closed) return;
        }
      } catch (error) {
        await unsubscribe();
        controller.error(error);
      }
    },
    async cancel() {
      await unsubscribe?.();
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export function isTranslationRunEvent(
  event: RunEventEnvelope,
): event is TranslationRunEvent {
  return event.kind === "translation-event";
}
