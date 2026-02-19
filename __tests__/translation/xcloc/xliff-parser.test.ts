import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  parseXliff,
  serializeXliff,
  type XliffDocument,
} from "@/lib/translation/xcloc/xliff-parser";

function loadTestXliff(): string {
  const zipPath = resolve(__dirname, "../../../test-assets/zh-Hans.xcloc.zip");
  const zipBuffer = new Uint8Array(readFileSync(zipPath));
  const entries = unzipSync(zipBuffer);
  const xliffContent =
    entries["zh-Hans.xcloc/Localized Contents/zh-Hans.xliff"];
  return new TextDecoder().decode(xliffContent);
}

describe("parseXliff", () => {
  const xml = loadTestXliff();
  const doc = parseXliff(xml);

  it("parses the XLIFF version", () => {
    expect(doc.version).toBe("1.2");
  });

  it("parses all <file> elements", () => {
    expect(doc.files).toHaveLength(2);
    expect(doc.files[0].original).toBe("ArgoTradingSwift/InfoPlist.xcstrings");
    expect(doc.files[1].original).toBe(
      "ArgoTradingSwift/Localizable.xcstrings",
    );
  });

  it("parses source and target languages", () => {
    for (const file of doc.files) {
      expect(file.sourceLanguage).toBe("en");
      expect(file.targetLanguage).toBe("zh-Hans");
    }
  });

  it("parses tool info from header", () => {
    const tool = doc.files[0].tool;
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("com.apple.dt.xcode");
    expect(tool?.name).toBe("Xcode");
  });

  it("parses all trans-units across files", () => {
    const totalUnits = doc.files.reduce(
      (sum, f) => sum + f.transUnits.length,
      0,
    );
    expect(totalUnits).toBe(246);
  });

  it("parses InfoPlist trans-units correctly", () => {
    const infoPlist = doc.files[0];
    expect(infoPlist.transUnits).toHaveLength(5);
    expect(infoPlist.transUnits[0].id).toBe("Argo Trading App");
    expect(infoPlist.transUnits[0].source).toBe("Argo Trading App");
  });

  it("parses notes", () => {
    const cfBundle = doc.files[0].transUnits.find(
      (t) => t.id === "CFBundleName",
    );
    expect(cfBundle).toBeDefined();
    expect(cfBundle?.note).toBe("Bundle name");
  });

  it("handles empty source elements", () => {
    const emptyEntry = doc.files[1].transUnits.find((t) => t.id === "");
    expect(emptyEntry).toBeDefined();
    expect(emptyEntry?.source).toBe("");
  });

  it("preserves format specifiers in source text", () => {
    const percentAt = doc.files[1].transUnits.find((t) => t.id === "About %@");
    expect(percentAt).toBeDefined();
    expect(percentAt?.source).toBe("About %@");

    const positional = doc.files[1].transUnits.find(
      (t) => t.id === "App Version %@ (%@)",
    );
    expect(positional).toBeDefined();
    expect(positional?.source).toBe("App Version %1$@ (%2$@)");
  });

  it("handles entities in trans-unit IDs", () => {
    const withQuotes = doc.files[1].transUnits.find(
      (t) =>
        t.id ===
        'Are you sure you want to delete "%@"? This action cannot be undone.',
    );
    expect(withQuotes).toBeDefined();
    expect(withQuotes?.source).toBe(
      'Are you sure you want to delete "%@"? This action cannot be undone.',
    );
  });

  it("handles & in trans-unit IDs", () => {
    const withAmp = doc.files[1].transUnits.find(
      (t) => t.id === "Buy & Hold PnL",
    );
    expect(withAmp).toBeDefined();
    expect(withAmp?.source).toBe("Buy & Hold PnL");
  });

  it("returns undefined target when no <target> element exists", () => {
    // The test file has no translated entries (all targets absent)
    for (const file of doc.files) {
      for (const tu of file.transUnits) {
        expect(tu.target).toBeUndefined();
      }
    }
  });
});

describe("serializeXliff", () => {
  const xml = loadTestXliff();
  const doc = parseXliff(xml);

  it("produces valid XML that can be re-parsed", () => {
    const serialized = serializeXliff(doc);
    const reparsed = parseXliff(serialized);
    expect(reparsed.version).toBe(doc.version);
    expect(reparsed.files).toHaveLength(doc.files.length);
  });

  it("round-trips all trans-units losslessly", () => {
    const serialized = serializeXliff(doc);
    const reparsed = parseXliff(serialized);

    for (let i = 0; i < doc.files.length; i++) {
      expect(reparsed.files[i].transUnits).toHaveLength(
        doc.files[i].transUnits.length,
      );

      for (let j = 0; j < doc.files[i].transUnits.length; j++) {
        const original = doc.files[i].transUnits[j];
        const roundTripped = reparsed.files[i].transUnits[j];
        expect(roundTripped.id).toBe(original.id);
        expect(roundTripped.source).toBe(original.source);
        expect(roundTripped.target).toBe(original.target);
        expect(roundTripped.note).toBe(original.note);
      }
    }
  });

  it("includes <target> elements when target text is set", () => {
    const modified: XliffDocument = {
      ...doc,
      files: doc.files.map((f) => ({
        ...f,
        transUnits: f.transUnits.map((tu) =>
          tu.id === "All" ? { ...tu, target: "全部" } : tu,
        ),
      })),
    };

    const serialized = serializeXliff(modified);
    expect(serialized).toContain("<target>全部</target>");

    const reparsed = parseXliff(serialized);
    const allEntry = reparsed.files[1].transUnits.find((t) => t.id === "All");
    expect(allEntry?.target).toBe("全部");
  });

  it("escapes XML entities in serialized output", () => {
    const serialized = serializeXliff(doc);
    // The ID "Buy & Hold PnL" should be escaped as "Buy &amp; Hold PnL" in XML attribute
    expect(serialized).toContain("Buy &amp; Hold PnL");
  });

  it("preserves tool info through round-trip", () => {
    const serialized = serializeXliff(doc);
    const reparsed = parseXliff(serialized);
    expect(reparsed.files[0].tool).toEqual(doc.files[0].tool);
  });
});
