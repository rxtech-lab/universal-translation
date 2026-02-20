import { describe, expect, it } from "vitest";
import {
  hasHashBasedMsgids,
  hasHashBasedMsgstrs,
  isHashLikeMsgid,
} from "@/lib/translation/po/hash-detection";
import type { PoDocument } from "@/lib/translation/po/parser";

function makeDoc(msgids: string[], msgstrs?: string[]): PoDocument {
  return {
    header: { raw: {}, nplurals: 2 },
    entries: msgids.map((msgid, i) => ({
      translatorComments: [],
      extractedComments: [],
      references: [],
      flags: [],
      msgid,
      msgstr: msgstrs?.[i] ?? "",
    })),
  };
}

describe("isHashLikeMsgid", () => {
  it("returns true for typical next-intl hashes", () => {
    expect(isHashLikeMsgid("hzSNj4")).toBe(true);
    expect(isHashLikeMsgid("tWcRaD")).toBe(true);
    expect(isHashLikeMsgid("YBY/lc")).toBe(true);
    expect(isHashLikeMsgid("+hb4i3")).toBe(true);
    expect(isHashLikeMsgid("Cz+sg6")).toBe(true);
    expect(isHashLikeMsgid("85SC0+")).toBe(true);
    expect(isHashLikeMsgid("SA+PbI")).toBe(true);
  });

  it("returns false for human-readable English phrases", () => {
    expect(isHashLikeMsgid("Hello, %s!")).toBe(false); // contains space
    expect(isHashLikeMsgid("About Us")).toBe(false); // contains space
    expect(isHashLikeMsgid("Upload a translation file")).toBe(false); // long with spaces
    expect(isHashLikeMsgid("New Project")).toBe(false); // contains space
  });

  it("returns false for empty or single-char strings", () => {
    expect(isHashLikeMsgid("")).toBe(false);
    expect(isHashLikeMsgid("a")).toBe(false);
  });

  it("returns false for strings longer than 12 chars", () => {
    expect(isHashLikeMsgid("abcdefghijklm")).toBe(false); // 13 chars
    expect(isHashLikeMsgid("VeryLongHashId")).toBe(false);
  });

  it("returns false for strings with special characters outside allowed set", () => {
    expect(isHashLikeMsgid("foo.bar")).toBe(false);
    expect(isHashLikeMsgid("foo@bar")).toBe(false);
    expect(isHashLikeMsgid("foo#bar")).toBe(false);
  });

  it("returns true for strings with allowed special characters", () => {
    expect(isHashLikeMsgid("abc+def")).toBe(true);
    expect(isHashLikeMsgid("abc/def")).toBe(true);
    expect(isHashLikeMsgid("abc=def")).toBe(true);
    expect(isHashLikeMsgid("abc-def")).toBe(true);
    expect(isHashLikeMsgid("abc_def")).toBe(true);
  });
});

describe("hasHashBasedMsgids", () => {
  it("returns true when all msgids are hash-like", () => {
    const doc = makeDoc(["hzSNj4", "tWcRaD", "YBY/lc", "+hb4i3"]);
    expect(hasHashBasedMsgids(doc)).toBe(true);
  });

  it("returns false when all msgids are human-readable", () => {
    const doc = makeDoc([
      "Hello World",
      "About Us",
      "New Project",
      "Upload File",
    ]);
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });

  it("returns true when >50% of msgids are hashes", () => {
    const doc = makeDoc(["hzSNj4", "tWcRaD", "YBY/lc", "Hello World"]);
    // 3 of 4 = 75% hashes
    expect(hasHashBasedMsgids(doc)).toBe(true);
  });

  it("returns false when <=50% of msgids are hashes", () => {
    const doc = makeDoc(["hzSNj4", "tWcRaD", "Hello World", "About Us"]);
    // 2 of 4 = 50%, not > 50%
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });

  it("returns false for fewer than 3 entries", () => {
    const doc = makeDoc(["hzSNj4", "tWcRaD"]);
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });

  it("returns false for single entry", () => {
    const doc = makeDoc(["hzSNj4"]);
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });

  it("returns false for empty document", () => {
    const doc = makeDoc([]);
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });

  it("ignores entries with empty msgid", () => {
    // 2 non-empty hashes + 2 empty = only 2 non-empty, below minimum of 3
    const doc = makeDoc(["hzSNj4", "tWcRaD", "", ""]);
    expect(hasHashBasedMsgids(doc)).toBe(false);
  });
});

describe("hasHashBasedMsgstrs", () => {
  it("returns true when msgstr values are hash-like", () => {
    const doc = makeDoc(
      ["hzSNj4", "tWcRaD", "YBY/lc"],
      ["xK9mQ2", "pL3nR7", "wM5vT1"],
    );
    expect(hasHashBasedMsgstrs(doc)).toBe(true);
  });

  it("returns false when msgstr values are human-readable (valid en.po reference)", () => {
    const doc = makeDoc(
      ["hzSNj4", "tWcRaD", "YBY/lc"],
      ["Dashboard", "Overview of your projects", "New Project"],
    );
    expect(hasHashBasedMsgstrs(doc)).toBe(false);
  });

  it("returns false when all msgstr are empty", () => {
    const doc = makeDoc(["hzSNj4", "tWcRaD", "YBY/lc"], ["", "", ""]);
    expect(hasHashBasedMsgstrs(doc)).toBe(false);
  });

  it("returns false for fewer than 3 non-empty msgstr", () => {
    const doc = makeDoc(
      ["hzSNj4", "tWcRaD", "YBY/lc"],
      ["xK9mQ2", "pL3nR7", ""],
    );
    expect(hasHashBasedMsgstrs(doc)).toBe(false);
  });
});
