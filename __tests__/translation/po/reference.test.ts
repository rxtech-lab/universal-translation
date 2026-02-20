import { describe, expect, it } from "vitest";
import { PoClient } from "@/lib/translation/po/client";

const HASH_PO = `
msgid ""
msgstr ""
"Language: zh\\n"
"Content-Type: text/plain; charset=utf-8\\n"

msgid "hzSNj4"
msgstr ""

msgid "tWcRaD"
msgstr ""

msgid "YBY/lc"
msgstr ""

msgid "+hb4i3"
msgstr ""
`.trim();

const REFERENCE_PO = `
msgid ""
msgstr ""
"Language: en\\n"
"Content-Type: text/plain; charset=utf-8\\n"

msgid "hzSNj4"
msgstr "Dashboard"

msgid "tWcRaD"
msgstr "Overview of your translation projects"

msgid "YBY/lc"
msgstr "New Project"

msgid "+hb4i3"
msgstr "AI-powered translation platform"
`.trim();

async function loadClient(poText: string): Promise<PoClient> {
  const client = new PoClient();
  const file = new File([poText], "zh.po", { type: "text/plain" });
  const result = await client.load({ kind: "single-file", file });
  expect(result.hasError).toBe(false);
  return client;
}

describe("PoClient.hasHashMsgids", () => {
  it("returns true for hash-based PO file", async () => {
    const client = await loadClient(HASH_PO);
    expect(client.hasHashMsgids()).toBe(true);
  });

  it("returns false for standard PO file", async () => {
    const standardPo = `
msgid ""
msgstr ""
"Language: zh\\n"

msgid "Hello World"
msgstr "你好世界"

msgid "About Us"
msgstr "关于我们"

msgid "New Project"
msgstr "新项目"
`.trim();
    const client = await loadClient(standardPo);
    expect(client.hasHashMsgids()).toBe(false);
  });
});

describe("PoClient.applyReferenceDocument", () => {
  it("remaps sourceText from reference msgstr", async () => {
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(REFERENCE_PO);

    expect(result.hasError).toBe(false);

    const entries = client.getProject().resources[0].entries;
    expect(entries[0].sourceText).toBe("Dashboard");
    expect(entries[1].sourceText).toBe("Overview of your translation projects");
    expect(entries[2].sourceText).toBe("New Project");
    expect(entries[3].sourceText).toBe("AI-powered translation platform");
  });

  it("preserves hash msgid in underlying document for export", async () => {
    const client = await loadClient(HASH_PO);
    client.applyReferenceDocument(REFERENCE_PO);

    const formatData = client.getFormatData();
    expect(formatData.document.entries[0].msgid).toBe("hzSNj4");
    expect(formatData.document.entries[1].msgid).toBe("tWcRaD");
  });

  it("preserves targetText (existing translations)", async () => {
    const poWithTranslations = `
msgid ""
msgstr ""
"Language: zh\\n"

msgid "hzSNj4"
msgstr "仪表盘"

msgid "tWcRaD"
msgstr ""

msgid "YBY/lc"
msgstr "新项目"

msgid "+hb4i3"
msgstr ""
`.trim();
    const client = await loadClient(poWithTranslations);
    client.applyReferenceDocument(REFERENCE_PO);

    const entries = client.getProject().resources[0].entries;
    expect(entries[0].sourceText).toBe("Dashboard");
    expect(entries[0].targetText).toBe("仪表盘");
    expect(entries[1].sourceText).toBe("Overview of your translation projects");
    expect(entries[1].targetText).toBe("");
  });

  it("returns error when uploading the same file as reference", async () => {
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(HASH_PO);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain(
      "same as the uploaded file",
    );
  });

  it("returns error when reference file msgstr values are also hash-like", async () => {
    const hashMsgstrPo = `
msgid ""
msgstr ""
"Language: xx\\n"

msgid "hzSNj4"
msgstr "xK9mQ2"

msgid "tWcRaD"
msgstr "pL3nR7"

msgid "YBY/lc"
msgstr "wM5vT1"

msgid "+hb4i3"
msgstr "jN8bF4"
`.trim();
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(hashMsgstrPo);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain(
      "also appear to be hash-based",
    );
  });

  it("returns error when reference has no entries", async () => {
    const emptyPo = `
msgid ""
msgstr ""
"Language: en\\n"
`.trim();
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(emptyPo);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain("no entries");
  });

  it("returns error when reference has all empty msgstr", async () => {
    const emptyMsgstrPo = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "hzSNj4"
msgstr ""

msgid "tWcRaD"
msgstr ""
`.trim();
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(emptyMsgstrPo);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain(
      "no translated entries",
    );
  });

  it("returns error when no msgids match between files", async () => {
    const unmatchedRef = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Completely Different Key"
msgstr "Some text"

msgid "Another Unrelated Key"
msgstr "Other text"

msgid "Yet Another Key"
msgstr "More text"
`.trim();
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(unmatchedRef);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain(
      "No matching entries",
    );
  });

  it("handles partial matches gracefully", async () => {
    const partialRef = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "hzSNj4"
msgstr "Dashboard"

msgid "unknown"
msgstr "Not in target"
`.trim();
    const client = await loadClient(HASH_PO);
    const result = client.applyReferenceDocument(partialRef);

    // Should succeed — at least one entry matched
    expect(result.hasError).toBe(false);

    const entries = client.getProject().resources[0].entries;
    expect(entries[0].sourceText).toBe("Dashboard");
    // Unmatched entries keep their hash as sourceText
    expect(entries[1].sourceText).toBe("tWcRaD");
  });

  it("sets hashBasedMsgids flag in format data", async () => {
    const client = await loadClient(HASH_PO);
    const formatData = client.getFormatData();
    expect(formatData.hashBasedMsgids).toBe(true);
  });
});
