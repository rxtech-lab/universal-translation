import type { ConsumeMessage } from "amqplib";
import { createAmqpChannel } from "./connection";
import { logQueue, taskDetails } from "./log";
import type { RunEventEnvelope, TranslationTask } from "./types";
import {
  routingKeyForRun,
  TRANSLATION_EVENTS_EXCHANGE,
  TRANSLATION_TASK_QUEUE,
} from "./types";

function parseJson<T>(message: ConsumeMessage | null) {
  if (!message) return null;

  return JSON.parse(message.content.toString("utf8")) as T;
}

export async function consumeTasks(
  handler: (task: TranslationTask) => Promise<void>,
) {
  const channel = await createAmqpChannel();
  const prefetch = Number(process.env.WORKER_PREFETCH ?? "5");
  await channel.prefetch(prefetch);
  const queueState = await channel.checkQueue(TRANSLATION_TASK_QUEUE);
  logQueue(
    "consumer_ready",
    `queue=${TRANSLATION_TASK_QUEUE} prefetch=${prefetch} ready=${queueState.messageCount} consumers=${queueState.consumerCount}`,
  );

  await channel.consume(
    TRANSLATION_TASK_QUEUE,
    async (message: ConsumeMessage | null) => {
      if (!message) return;

      try {
        logQueue(
          "message_received",
          `deliveryTag=${message.fields.deliveryTag} redelivered=${message.fields.redelivered}`,
        );
        if (message.fields.redelivered) {
          logQueue(
            "message_redelivered",
            `deliveryTag=${message.fields.deliveryTag}`,
          );
        }
        const task = parseJson<TranslationTask>(message);
        if (!task) {
          logQueue(
            "message_invalid",
            `deliveryTag=${message.fields.deliveryTag}`,
          );
          channel.nack(message, false, false);
          return;
        }

        logQueue("task_received", taskDetails(task));
        await handler(task);
        channel.ack(message);
        logQueue("message_acked", taskDetails(task));
      } catch (error) {
        console.error("[worker] task failed", error);
        logQueue(
          "message_nacked",
          `deliveryTag=${message.fields.deliveryTag} error=${error instanceof Error ? error.message : String(error)}`,
        );
        channel.nack(message, false, false);
      }
    },
  );

  return channel;
}

export async function subscribeToRunEvents(
  runId: string,
  onEvent: (event: RunEventEnvelope) => void | Promise<void>,
) {
  const channel = await createAmqpChannel();
  const asserted = await channel.assertQueue("", {
    exclusive: true,
    autoDelete: true,
  });

  await channel.bindQueue(
    asserted.queue,
    TRANSLATION_EVENTS_EXCHANGE,
    routingKeyForRun(runId),
  );

  const consumed = await channel.consume(
    asserted.queue,
    async (message: ConsumeMessage | null) => {
      if (!message) return;
      const event = parseJson<RunEventEnvelope>(message);
      if (!event) return;
      await onEvent(event);
    },
    { noAck: true },
  );

  return async () => {
    await channel.cancel(consumed.consumerTag).catch(() => undefined);
    await channel.close().catch(() => undefined);
  };
}
