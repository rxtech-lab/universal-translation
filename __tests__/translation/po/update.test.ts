import { describe, expect, it } from "vitest";
import { PoClient } from "@/lib/translation/po/client";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

async function loadClient(poText: string): Promise<PoClient> {
  const client = new PoClient();
  const file = new File([poText], "zh.po", { type: "text/plain" });
  const result = await client.load({ kind: "single-file", file });
  expect(result.hasError).toBe(false);
  return client;
}

function getEntries(client: PoClient) {
  return client.getProject().resources[0].entries;
}

// -------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------

const BASE_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "Hello"
msgstr "你好"

msgid "Settings"
msgstr "设置"

msgid "About Us"
msgstr ""
`.trim();

// Same as BASE_PO but keeps Hello + Settings, removes About Us, adds Logout
const UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "Hello"
msgstr ""

msgid "Settings"
msgstr ""

msgid "Logout"
msgstr ""
`.trim();

const PLURAL_BASE_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "%d file"
msgid_plural "%d files"
msgstr[0] "%d 个文件"
msgstr[1] "%d 个文件"
`.trim();

const PLURAL_UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "%d file"
msgid_plural "%d files"
msgstr[0] ""
msgstr[1] ""
`.trim();

const MSGCTXT_BASE_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgctxt "menu"
msgid "Settings"
msgstr "菜单设置"

msgctxt "page"
msgid "Settings"
msgstr "页面设置"
`.trim();

const MSGCTXT_UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgctxt "menu"
msgid "Settings"
msgstr ""

msgctxt "page"
msgid "Settings"
msgstr ""
`.trim();

// Singular entry becomes plural in new PO
const STRUCTURE_CHANGE_BASE_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "%d file"
msgstr "%d 个文件"
`.trim();

const STRUCTURE_CHANGE_UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "%d file"
msgid_plural "%d files"
msgstr[0] ""
msgstr[1] ""
`.trim();

const HASH_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "hzSNj4"
msgstr "仪表盘"

msgid "tWcRaD"
msgstr "新项目"
`.trim();

const HASH_UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "hzSNj4"
msgstr ""

msgid "tWcRaD"
msgstr ""

msgid "xKnQ9z"
msgstr ""
`.trim();

const HASH_REFERENCE_PO = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "hzSNj4"
msgstr "User dashboard overview"

msgid "tWcRaD"
msgstr "Create a new project"

msgid "xKnQ9z"
msgstr "Application settings panel"
`.trim();

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe("PoClient.updateFromPo", () => {
  it("preserves existing translations for matching entries", async () => {
    const client = await loadClient(BASE_PO);
    const result = client.updateFromPo(UPDATED_PO);

    expect(result.hasError).toBe(false);
    const entries = getEntries(client);
    const hello = entries.find((e) => e.sourceText === "Hello");
    const settings = entries.find((e) => e.sourceText === "Settings");

    expect(hello?.targetText).toBe("你好");
    expect(settings?.targetText).toBe("设置");
  });

  it("adds new entries with empty targetText", async () => {
    const client = await loadClient(BASE_PO);
    client.updateFromPo(UPDATED_PO);

    const entries = getEntries(client);
    const logout = entries.find((e) => e.sourceText === "Logout");
    expect(logout).toBeDefined();
    expect(logout?.targetText).toBe("");
  });

  it("removes entries not in new PO", async () => {
    const client = await loadClient(BASE_PO);
    client.updateFromPo(UPDATED_PO);

    const entries = getEntries(client);
    const aboutUs = entries.find((e) => e.sourceText === "About Us");
    expect(aboutUs).toBeUndefined();
  });

  it("returns correct stats", async () => {
    const client = await loadClient(BASE_PO);
    const result = client.updateFromPo(UPDATED_PO);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;
    // Hello (translated) + Settings (translated) = 2 preserved
    // About Us removed = 1
    // Logout added = 1
    // total = 3 (Hello, Settings, Logout)
    expect(result.data.preserved).toBe(2);
    expect(result.data.removed).toBe(1);
    expect(result.data.added).toBe(1);
    expect(result.data.total).toBe(3);
  });

  it("preserves plural translations for matching plural entries", async () => {
    const client = await loadClient(PLURAL_BASE_PO);
    const result = client.updateFromPo(PLURAL_UPDATED_PO);

    expect(result.hasError).toBe(false);
    const entries = getEntries(client);
    const singular = entries.find((e) => e.sourceText === "%d file");
    const plural = entries.find((e) => e.sourceText === "%d files");
    expect(singular?.targetText).toBe("%d 个文件");
    expect(plural?.targetText).toBe("%d 个文件");
  });

  it("handles msgctxt-scoped entries independently", async () => {
    const client = await loadClient(MSGCTXT_BASE_PO);
    client.updateFromPo(MSGCTXT_UPDATED_PO);

    const entries = getEntries(client);
    expect(entries).toHaveLength(2);
    // Both entries have msgid "Settings" but different msgctxt
    expect(entries[0].targetText).toBe("菜单设置");
    expect(entries[1].targetText).toBe("页面设置");
  });

  it("does not copy incompatible translation when entry changes singular→plural", async () => {
    const client = await loadClient(STRUCTURE_CHANGE_BASE_PO);
    client.updateFromPo(STRUCTURE_CHANGE_UPDATED_PO);

    const entries = getEntries(client);
    // Old was singular, new is plural — should not copy
    for (const entry of entries) {
      expect(entry.targetText).toBe("");
    }
  });

  it("returns error for empty new PO", async () => {
    const emptyPo = `
msgid ""
msgstr ""
"Language: zh-Hans\\n"
`.trim();
    const client = await loadClient(BASE_PO);
    const result = client.updateFromPo(emptyPo);

    expect(result.hasError).toBe(true);
    expect(result.hasError && result.errorMessage).toContain(
      "No translatable entries",
    );
  });

  it("works with hash-based msgids and reference file", async () => {
    const client = await loadClient(HASH_PO);
    const result = client.updateFromPo(HASH_UPDATED_PO, HASH_REFERENCE_PO);

    expect(result.hasError).toBe(false);
    const entries = getEntries(client);

    // Existing translations should be preserved
    const dashboard = entries.find(
      (e) => e.sourceText === "User dashboard overview",
    );
    const newProject = entries.find(
      (e) => e.sourceText === "Create a new project",
    );
    const settings = entries.find(
      (e) => e.sourceText === "Application settings panel",
    );

    expect(dashboard?.targetText).toBe("仪表盘");
    expect(newProject?.targetText).toBe("新项目");
    // New entry — empty
    expect(settings?.targetText).toBe("");
  });

  it("preserves entry order from new PO", async () => {
    const rearrangedPo = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "Settings"
msgstr ""

msgid "Hello"
msgstr ""
`.trim();
    const client = await loadClient(BASE_PO);
    client.updateFromPo(rearrangedPo);

    const entries = getEntries(client);
    // "About Us" removed, order follows new PO: Settings first, then Hello
    expect(entries[0].sourceText).toBe("Settings");
    expect(entries[1].sourceText).toBe("Hello");
  });

  it("handles identical PO (no changes)", async () => {
    // Clone BASE_PO but strip translations to simulate same structure
    const identicalPo = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "Hello"
msgstr ""

msgid "Settings"
msgstr ""

msgid "About Us"
msgstr ""
`.trim();
    const client = await loadClient(BASE_PO);
    const result = client.updateFromPo(identicalPo);

    expect(result.hasError).toBe(false);
    if (result.hasError) return;
    expect(result.data.added).toBe(0);
    expect(result.data.removed).toBe(0);
    // Hello and Settings had translations → 2 preserved
    expect(result.data.preserved).toBe(2);
    expect(result.data.total).toBe(3);
  });
});
