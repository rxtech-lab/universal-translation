import type { Channel } from "amqplib";
import { createAmqpChannel } from "./connection";
import { appendRunEventToCache } from "./stream-cache";
import type { RunEventEnvelope, TranslationTask } from "./types";
import {
  routingKeyForRun,
  TRANSLATION_EVENTS_EXCHANGE,
  TRANSLATION_TASK_QUEUE,
} from "./types";

let publisherChannelPromise: Promise<Channel> | null = null;

async function getPublisherChannel() {
  if (!publisherChannelPromise) {
    publisherChannelPromise = createAmqpChannel();
  }

  return publisherChannelPromise;
}

export async function publishTask(task: TranslationTask) {
  const channel = await getPublisherChannel();
  channel.sendToQueue(
    TRANSLATION_TASK_QUEUE,
    Buffer.from(JSON.stringify(task)),
    {
      persistent: true,
      contentType: "application/json",
    },
  );
}

export async function publishRunEvent(event: RunEventEnvelope) {
  await appendRunEventToCache(event);
  const channel = await getPublisherChannel();
  channel.publish(
    TRANSLATION_EVENTS_EXCHANGE,
    routingKeyForRun(event.runId),
    Buffer.from(JSON.stringify(event)),
    {
      persistent: false,
      contentType: "application/json",
    },
  );
}
