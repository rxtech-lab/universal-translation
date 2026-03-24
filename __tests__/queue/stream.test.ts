import { describe, expect, test } from "vitest";
import { mergeRunEvents } from "@/lib/queue/stream";
import {
  isChatTerminalChunk,
  isTranslationTerminalEvent,
  type RunEventEnvelope,
} from "@/lib/queue/types";

describe("queue stream helpers", () => {
  test("mergeRunEvents sorts and dedupes by seq", () => {
    const cached: RunEventEnvelope[] = [
      {
        runId: "run-1",
        projectId: "project-1",
        userId: "user-1",
        seq: 2,
        kind: "translation-event",
        payload: { type: "translate-start", total: 2 },
        timestamp: "2026-03-14T00:00:00.000Z",
      },
      {
        runId: "run-1",
        projectId: "project-1",
        userId: "user-1",
        seq: 1,
        kind: "translation-event",
        payload: { type: "terminology-scan-start" },
        timestamp: "2026-03-14T00:00:00.000Z",
      },
    ];

    const buffered: RunEventEnvelope[] = [
      {
        runId: "run-1",
        projectId: "project-1",
        userId: "user-1",
        seq: 2,
        kind: "translation-event",
        payload: { type: "translate-start", total: 2 },
        timestamp: "2026-03-14T00:00:00.000Z",
      },
      {
        runId: "run-1",
        projectId: "project-1",
        userId: "user-1",
        seq: 3,
        kind: "translation-event",
        payload: {
          type: "entry-translated",
          resourceId: "r1",
          entryId: "e1",
          targetText: "Hello",
          current: 1,
          total: 2,
        },
        timestamp: "2026-03-14T00:00:00.000Z",
      },
    ];

    expect(mergeRunEvents(cached, buffered).map((event) => event.seq)).toEqual([
      1, 2, 3,
    ]);
  });

  test("terminal event helpers classify completion correctly", () => {
    expect(isTranslationTerminalEvent({ type: "complete" })).toBe(true);
    expect(isTranslationTerminalEvent({ type: "stopped" })).toBe(true);
    expect(
      isTranslationTerminalEvent({
        type: "entry-translated",
        resourceId: "r1",
        entryId: "e1",
        targetText: "Hi",
        current: 1,
        total: 1,
      }),
    ).toBe(false);

    expect(isChatTerminalChunk({ type: "finish" })).toBe(true);
    expect(
      isChatTerminalChunk({
        type: "text-delta",
        id: "msg-1",
        delta: "hello",
      }),
    ).toBe(false);
  });
});
