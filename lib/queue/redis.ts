import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis() {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required");
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  return redis;
}
