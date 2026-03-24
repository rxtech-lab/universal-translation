import amqp, { type Channel, type ChannelModel } from "amqplib";
import {
  TRANSLATION_EVENTS_EXCHANGE,
  TRANSLATION_TASK_QUEUE,
} from "./types";

let connectionPromise: Promise<ChannelModel> | null = null;
let closeHandlersBound = false;

function getAmqpUrl() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error("RABBITMQ_URL is required");
  }
  return url;
}

export async function getAmqpConnection() {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(getAmqpUrl()).then((connection) => {
      if (!closeHandlersBound) {
        closeHandlersBound = true;
        connection.on("close", () => {
          connectionPromise = null;
        });
        connection.on("error", () => {
          connectionPromise = null;
        });
      }

      return connection;
    });
  }

  return connectionPromise;
}

export async function createAmqpChannel() {
  const connection = await getAmqpConnection();
  const channel = await connection.createChannel();
  await ensureTopology(channel);
  return channel;
}

export async function ensureTopology(channel: Channel) {
  await channel.assertQueue(TRANSLATION_TASK_QUEUE, { durable: true });
  await channel.assertExchange(TRANSLATION_EVENTS_EXCHANGE, "topic", {
    durable: true,
  });
}

export async function closeAmqpConnection() {
  if (!connectionPromise) return;

  const connection = await connectionPromise.catch(() => null);
  connectionPromise = null;

  if (connection) {
    await connection.close().catch(() => undefined);
  }
}
