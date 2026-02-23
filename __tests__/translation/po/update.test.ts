import { describe, expect, it } from "vitest";
import { PoClient } from "@/lib/translation/po/client";
import { parsePo } from "@/lib/translation/po/parser";

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

// -------------------------------------------------------------------
// Desync & export regression tests
// -------------------------------------------------------------------

// Reordered version of BASE_PO: Settings before Hello, About Us removed, Logout added
const REORDERED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "Settings"
msgstr ""

msgid "Hello"
msgstr ""

msgid "Logout"
msgstr ""
`.trim();

// Hash PO with entries in reversed order + a new entry
const HASH_REORDERED_UPDATED_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Language: zh-Hans\\n"

msgid "xKnQ9z"
msgstr ""

msgid "tWcRaD"
msgstr ""

msgid "hzSNj4"
msgstr ""
`.trim();

const HASH_REORDERED_REFERENCE_PO = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "xKnQ9z"
msgstr "Application settings panel"

msgid "tWcRaD"
msgstr "Create a new project"

msgid "hzSNj4"
msgstr "User dashboard overview"
`.trim();

describe("PoClient desync regression", () => {
  it("preserves translations after loadFromJson with stale formatData", async () => {
    // 1. Load initial PO and translate
    const client1 = await loadClient(BASE_PO);

    // 2. Update with reordered PO (changes entry positions)
    const updateResult = client1.updateFromPo(REORDERED_PO);
    expect(updateResult.hasError).toBe(false);

    // After update: project entries have new IDs based on reordered doc
    const newProject = structuredClone(client1.getProject());
    const newFormatData = structuredClone(client1.getFormatData());

    // Verify in-memory state is correct after update
    const entries1 = newProject.resources[0].entries;
    expect(entries1[0].sourceText).toBe("Settings");
    expect(entries1[0].targetText).toBe("设置");
    expect(entries1[1].sourceText).toBe("Hello");
    expect(entries1[1].targetText).toBe("你好");

    // 3. Simulate DB reload with BOTH content AND formatData saved
    //    (this is the fix — formatData is now persisted)
    const client2 = new PoClient();
    client2.loadFromJson(newProject, newFormatData as never);

    const entries2 = getEntries(client2);
    expect(entries2[0].sourceText).toBe("Settings");
    expect(entries2[0].targetText).toBe("设置");
    expect(entries2[1].sourceText).toBe("Hello");
    expect(entries2[1].targetText).toBe("你好");
  });

  it("detects corruption when formatData is stale (old bug scenario)", async () => {
    // This test documents the old bug: if formatData was NOT saved after
    // updateFromPo, reloading from DB would desync IDs and document positions.
    const client1 = await loadClient(BASE_PO);
    const staleFormatData = structuredClone(client1.getFormatData());

    // Update with reordered PO
    client1.updateFromPo(REORDERED_PO);
    const newProject = structuredClone(client1.getProject());

    // Simulate reload with new project content but STALE formatData
    const client2 = new PoClient();
    client2.loadFromJson(newProject, staleFormatData as never);

    // With stale formatData, entry "0" (Settings/设置) would be indexed
    // against the OLD document position 0 (which was Hello). This means
    // a subsequent export or update would write "设置" to the Hello msgid.
    // The fix ensures formatData is always saved alongside content.
    // Entries from the project are loaded as-is by loadFromJson,
    // so sourceText/targetText appear correct in the project layer.
    // The corruption manifests when syncing back to the document layer.
    const exportResult = await client2.exportFile();
    expect(exportResult.hasError).toBe(false);
    if (exportResult.hasError || !exportResult.data?.blob) return;

    const exportedText = await exportResult.data.blob.text();
    const exportedDoc = parsePo(exportedText);

    // With stale formatData (3 entries: Hello, Settings, About Us)
    // but new project (3 entries: Settings@id=0, Hello@id=1, Logout@id=2),
    // syncAllToDocument would write:
    //   doc.entries[0] (Hello) ← entry "0".targetText (设置) — WRONG
    //   doc.entries[1] (Settings) ← entry "1".targetText (你好) — WRONG
    // Verify this corruption exists (documenting the old bug)
    const helloEntry = exportedDoc.entries.find((e) => e.msgid === "Hello");
    const settingsEntry = exportedDoc.entries.find(
      (e) => e.msgid === "Settings",
    );

    // In the stale scenario, translations are swapped
    expect(helloEntry?.msgstr).toBe("设置"); // WRONG — should be 你好
    expect(settingsEntry?.msgstr).toBe("你好"); // WRONG — should be 设置
  });

  it("export after updateFromPo produces correct msgid-msgstr pairs", async () => {
    const client = await loadClient(BASE_PO);

    // Update with reordered PO (Settings before Hello, removes About Us, adds Logout)
    client.updateFromPo(REORDERED_PO);

    const exportResult = await client.exportFile();
    expect(exportResult.hasError).toBe(false);
    if (exportResult.hasError || !exportResult.data?.blob) return;

    const exportedText = await exportResult.data.blob.text();
    const exportedDoc = parsePo(exportedText);

    // Verify each msgid maps to the correct msgstr
    const hello = exportedDoc.entries.find((e) => e.msgid === "Hello");
    const settings = exportedDoc.entries.find((e) => e.msgid === "Settings");
    const logout = exportedDoc.entries.find((e) => e.msgid === "Logout");

    expect(hello?.msgstr).toBe("你好");
    expect(settings?.msgstr).toBe("设置");
    expect(logout?.msgstr).toBe("");

    // About Us should be gone
    const aboutUs = exportedDoc.entries.find((e) => e.msgid === "About Us");
    expect(aboutUs).toBeUndefined();
  });

  it("preserves translations after updateFromPo with reordered hash-based entries", async () => {
    // Load hash PO with translations
    const client = await loadClient(HASH_PO);
    // Apply reference to get human-readable sourceText
    client.applyReferenceDocument(HASH_REORDERED_REFERENCE_PO);

    // Verify initial state
    let entries = getEntries(client);
    const dashboard = entries.find(
      (e) => e.sourceText === "User dashboard overview",
    );
    const project = entries.find(
      (e) => e.sourceText === "Create a new project",
    );
    expect(dashboard?.targetText).toBe("仪表盘");
    expect(project?.targetText).toBe("新项目");

    // Update with reordered hash PO (reversed order + new entry)
    const result = client.updateFromPo(
      HASH_REORDERED_UPDATED_PO,
      HASH_REORDERED_REFERENCE_PO,
    );
    expect(result.hasError).toBe(false);

    // Verify translations are associated with correct source texts
    entries = getEntries(client);
    const dashboardAfter = entries.find(
      (e) => e.sourceText === "User dashboard overview",
    );
    const projectAfter = entries.find(
      (e) => e.sourceText === "Create a new project",
    );
    const settingsAfter = entries.find(
      (e) => e.sourceText === "Application settings panel",
    );

    expect(dashboardAfter?.targetText).toBe("仪表盘");
    expect(projectAfter?.targetText).toBe("新项目");
    expect(settingsAfter?.targetText).toBe(""); // New entry — empty
  });
});
