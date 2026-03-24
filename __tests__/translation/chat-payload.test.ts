import { describe, expect, test } from "vitest";
import { getChatPayload } from "@/lib/translation/worker";

describe("getChatPayload", () => {
  test("returns messages when payload is valid", () => {
    expect(getChatPayload({ messages: [{ role: "user" }] })).toEqual({
      messages: [{ role: "user" }],
    });
  });

  test("throws when messages are missing", () => {
    expect(() => getChatPayload({ nope: true })).toThrow("Invalid chat payload");
  });
});
