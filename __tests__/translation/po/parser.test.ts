import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePo, serializePo } from "@/lib/translation/po/parser";

function loadTestPo(): string {
  const poPath = resolve(__dirname, "../../../test-assets/test.po");
  return readFileSync(poPath, "utf-8");
}

describe("parsePo", () => {
  const text = loadTestPo();
  const doc = parsePo(text);

  it("parses the correct number of entries (excluding header)", () => {
    // 9 entries: Hello, Settings, About Us, Settings(ctx), Profile(fuzzy),
    // plural(%d file), multiline Welcome, escape sequences, New label
    expect(doc.entries).toHaveLength(9);
  });

  it("parses header metadata", () => {
    expect(doc.header.raw["Content-Type"]).toBe("text/plain; charset=UTF-8");
    expect(doc.header.raw["Language"]).toBe("zh-Hans");
    expect(doc.header.raw["MIME-Version"]).toBe("1.0");
  });

  it("parses nplurals from Plural-Forms header", () => {
    expect(doc.header.nplurals).toBe(2);
  });

  it("parses translator comments", () => {
    const entry = doc.entries[0]; // "Hello, %s!"
    expect(entry.translatorComments).toContain(
      "Translator comment for greeting",
    );
  });

  it("parses extracted comments", () => {
    const entry = doc.entries[0];
    expect(entry.extractedComments).toContain(
      "Extracted comment: shown on home page",
    );
  });

  it("parses references", () => {
    const entry = doc.entries[0];
    expect(entry.references).toContain("src/components/Header.tsx:42");
  });

  it("parses flags", () => {
    const entry = doc.entries[0]; // has c-format
    expect(entry.flags).toContain("c-format");
  });

  it("parses msgid and msgstr", () => {
    const entry = doc.entries[0];
    expect(entry.msgid).toBe("Hello, %s!");
    expect(entry.msgstr).toBe("你好，%s！");
  });

  it("parses untranslated entries with empty msgstr", () => {
    const entry = doc.entries[2]; // "About Us"
    expect(entry.msgid).toBe("About Us");
    expect(entry.msgstr).toBe("");
  });

  it("parses msgctxt", () => {
    const entry = doc.entries[3]; // Settings with context
    expect(entry.msgctxt).toBe("menu");
    expect(entry.msgid).toBe("Settings");
    expect(entry.msgstr).toBe("菜单设置");
  });

  it("parses fuzzy flag", () => {
    const entry = doc.entries[4]; // Profile (fuzzy)
    expect(entry.flags).toContain("fuzzy");
  });

  it("parses plural forms", () => {
    const entry = doc.entries[5]; // %d file / %d files
    expect(entry.msgid).toBe("%d file");
    expect(entry.msgidPlural).toBe("%d files");
    expect(entry.msgstrPlural).toBeDefined();
    expect(entry.msgstrPlural![0]).toBe("%d 个文件");
    expect(entry.msgstrPlural![1]).toBe("%d 个文件");
  });

  it("parses multiline strings", () => {
    const entry = doc.entries[6]; // Welcome multiline
    expect(entry.msgid).toBe(
      "Welcome to our application.\nPlease log in to continue.",
    );
    expect(entry.msgstr).toBe("欢迎使用我们的应用。\n请登录以继续。");
  });

  it("parses escape sequences", () => {
    const entry = doc.entries[7]; // escape sequences
    expect(entry.msgid).toBe(
      'He said "hello" and left.\nThen came back\\again.',
    );
  });

  it("parses previous msgid", () => {
    const entry = doc.entries[8]; // New label with #| msgid
    expect(entry.previousMsgid).toBe("Old label");
    expect(entry.msgid).toBe("New label");
  });
});

describe("serializePo", () => {
  const text = loadTestPo();
  const doc = parsePo(text);

  it("produces valid PO that can be re-parsed", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);
    expect(reparsed.entries).toHaveLength(doc.entries.length);
  });

  it("round-trips header metadata", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);
    expect(reparsed.header.raw["Content-Type"]).toBe(
      doc.header.raw["Content-Type"],
    );
    expect(reparsed.header.nplurals).toBe(doc.header.nplurals);
  });

  it("round-trips all entries losslessly", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);

    for (let i = 0; i < doc.entries.length; i++) {
      const original = doc.entries[i];
      const roundTripped = reparsed.entries[i];
      expect(roundTripped.msgid).toBe(original.msgid);
      expect(roundTripped.msgstr).toBe(original.msgstr);
      expect(roundTripped.msgctxt).toBe(original.msgctxt);
      expect(roundTripped.msgidPlural).toBe(original.msgidPlural);
      expect(roundTripped.flags).toEqual(original.flags);
      expect(roundTripped.references).toEqual(original.references);
      expect(roundTripped.extractedComments).toEqual(
        original.extractedComments,
      );
    }
  });

  it("round-trips plural forms", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);
    const original = doc.entries[5];
    const roundTripped = reparsed.entries[5];
    expect(roundTripped.msgstrPlural).toEqual(original.msgstrPlural);
  });

  it("round-trips multiline strings", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);
    const original = doc.entries[6];
    const roundTripped = reparsed.entries[6];
    expect(roundTripped.msgid).toBe(original.msgid);
    expect(roundTripped.msgstr).toBe(original.msgstr);
  });

  it("round-trips escape sequences", () => {
    const serialized = serializePo(doc);
    const reparsed = parsePo(serialized);
    const original = doc.entries[7];
    const roundTripped = reparsed.entries[7];
    expect(roundTripped.msgid).toBe(original.msgid);
  });

  it("serializes header entries", () => {
    const serialized = serializePo(doc);
    expect(serialized).toContain('msgid ""');
    expect(serialized).toContain('msgstr ""');
    expect(serialized).toContain("Content-Type");
  });
});

describe("poDescriptor", () => {
  it("detects .po files with valid content", async () => {
    const { poDescriptor } = await import("@/lib/translation/po/descriptor");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });
    const result = await poDescriptor.detect({
      kind: "single-file",
      file,
    });
    expect(result.score).toBe(1.0);
  });

  it("returns 0 for non-.po files", async () => {
    const { poDescriptor } = await import("@/lib/translation/po/descriptor");
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const result = await poDescriptor.detect({
      kind: "single-file",
      file,
    });
    expect(result.score).toBe(0);
  });

  it("returns 0 for archive payloads", async () => {
    const { poDescriptor } = await import("@/lib/translation/po/descriptor");
    const result = await poDescriptor.detect({
      kind: "archive",
      tree: { files: [] },
      originalFileName: "test.zip",
    });
    expect(result.score).toBe(0);
  });
});

describe("PoClient", () => {
  it("builds a project from a PO file", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    const result = await client.load({ kind: "single-file", file });
    expect(result.hasError).toBe(false);

    const project = client.getProject();
    expect(project.resources).toHaveLength(1);

    const resource = project.resources[0];
    // 9 entries: 7 non-plural + 1 plural (2 forms) = 9 total entries + 1 extra for plural = 10
    // Actually: entries 0-4 are non-plural (5), entry 5 is plural with 2 forms (2),
    // entries 6-8 are non-plural (3) = 5+2+3 = 10
    expect(resource.entries).toHaveLength(10);
  });

  it("maps sourceText and targetText correctly", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    await client.load({ kind: "single-file", file });
    const project = client.getProject();
    const entries = project.resources[0].entries;

    // First entry: Hello, %s!
    expect(entries[0].sourceText).toBe("Hello, %s!");
    expect(entries[0].targetText).toBe("你好，%s！");

    // Untranslated entry
    const aboutUs = entries[2];
    expect(aboutUs.sourceText).toBe("About Us");
    expect(aboutUs.targetText).toBe("");
  });

  it("maps comments and context", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    await client.load({ kind: "single-file", file });
    const entries = client.getProject().resources[0].entries;

    // First entry has extracted comment and reference
    expect(entries[0].comment).toBe("Extracted comment: shown on home page");
    expect(entries[0].context).toBe("src/components/Header.tsx:42");
  });

  it("maps plural forms to pluralForm field", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    await client.load({ kind: "single-file", file });
    const entries = client.getProject().resources[0].entries;

    // Plural entries are at index 5 and 6 (the plural expands to 2 entries)
    const singularEntry = entries.find((e) => e.id === "5:plural:0");
    const pluralEntry = entries.find((e) => e.id === "5:plural:1");

    expect(singularEntry).toBeDefined();
    expect(singularEntry!.pluralForm).toBe("one");
    expect(singularEntry!.sourceText).toBe("%d file");

    expect(pluralEntry).toBeDefined();
    expect(pluralEntry!.pluralForm).toBe("other");
    expect(pluralEntry!.sourceText).toBe("%d files");
  });

  it("sets languages correctly", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    await client.load({ kind: "single-file", file });
    client.setLanguages("en", "zh-Hans");

    expect(client.getSourceLanguage()).toBe("en");
    expect(client.getTargetLanguages()).toEqual(["zh-Hans"]);
  });

  it("updates entries and syncs to document", async () => {
    const { PoClient } = await import("@/lib/translation/po/client");
    const text = loadTestPo();
    const file = new File([text], "messages.po", { type: "text/plain" });

    const client = new PoClient();
    await client.load({ kind: "single-file", file });

    // Update the untranslated "About Us" entry
    const result = client.updateEntry("po-main", "2", {
      targetText: "关于我们",
    });
    expect(result.hasError).toBe(false);

    const entries = client.getProject().resources[0].entries;
    expect(entries[2].targetText).toBe("关于我们");

    // Verify it synced to the PO document
    const formatData = client.getFormatData();
    expect(formatData.document.entries[2].msgstr).toBe("关于我们");
  });
});
