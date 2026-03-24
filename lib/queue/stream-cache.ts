import type { RunEventEnvelope } from "./types";
import { getRedis } from "./redis";

const CHUNKS_TTL_SECONDS = 60 * 60;
const ACTIVE_TTL_SECONDS = 60 * 5;

function chunksKey(runId: string) {
  return `stream:chunks:${runId}`;
}

function activeKey(projectId: string) {
  return `stream:active:${projectId}`;
}

function cancelKey(runId: string) {
  return `stream:cancel:${runId}`;
}

export async function appendRunEventToCache(event: RunEventEnvelope) {
  const redis = getRedis();
  await redis
    .multi()
    .rpush(chunksKey(event.runId), JSON.stringify(event))
    .expire(chunksKey(event.runId), CHUNKS_TTL_SECONDS)
    .exec();
}

export async function getCachedRunEvents(runId: string) {
  const redis = getRedis();
  const entries = await redis.lrange(chunksKey(runId), 0, -1);
  return entries
    .map((value) => {
      try {
        return JSON.parse(value) as RunEventEnvelope;
      } catch {
        return null;
      }
    })
    .filter((value): value is RunEventEnvelope => value !== null)
    .sort((a, b) => a.seq - b.seq);
}

export async function clearRunEventCache(runId: string) {
  await getRedis().del(chunksKey(runId));
}

export async function acquireActiveRun(projectId: string, runId: string) {
  const redis = getRedis();
  const key = activeKey(projectId);
  const result = await redis.set(
    activeKey(projectId),
    runId,
    "EX",
    ACTIVE_TTL_SECONDS,
    "NX",
  );
  if (result === "OK") {
    return "acquired" as const;
  }

  const current = await redis.get(key);
  if (current === runId) {
    await redis.expire(key, ACTIVE_TTL_SECONDS);
    return "resumed" as const;
  }

  return "rejected" as const;
}

export async function renewActiveRun(projectId: string, runId: string) {
  const redis = getRedis();
  const key = activeKey(projectId);
  const current = await redis.get(key);
  if (current !== runId) return false;
  await redis.expire(key, ACTIVE_TTL_SECONDS);
  return true;
}

export async function releaseActiveRun(projectId: string, runId: string) {
  const redis = getRedis();
  const key = activeKey(projectId);
  const current = await redis.get(key);
  if (current === runId) {
    await redis.del(key);
  }
}

export async function getActiveRunId(projectId: string) {
  return getRedis().get(activeKey(projectId));
}

export async function setRunCancelled(runId: string) {
  await getRedis().set(cancelKey(runId), "1", "EX", CHUNKS_TTL_SECONDS);
}

export async function clearRunCancelled(runId: string) {
  await getRedis().del(cancelKey(runId));
}

export async function isRunCancelled(runId: string) {
  const result = await getRedis().exists(cancelKey(runId));
  return result === 1;
}
