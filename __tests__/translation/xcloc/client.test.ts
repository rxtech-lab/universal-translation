import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { UploadPayload, VirtualFile } from "@/lib/translation/types";
import { XclocClient } from "@/lib/translation/xcloc/client";
import { parseXliff } from "@/lib/translation/xcloc/xliff-parser";

function loadTestPayload(): UploadPayload {
  const zipPath = resolve(__dirname, "../../../test-assets/zh-Hans.xcloc.zip");
  const zipBuffer = new Uint8Array(readFileSync(zipPath));
  const entries = unzipSync(zipBuffer);

  const files: VirtualFile[] = [];
  for (const [path, content] of Object.entries(entries)) {
    if (path.endsWith("/")) continue;
    files.push({ path, content });
  }

  return {
    kind: "archive",
    tree: { files },
    originalFileName: "zh-Hans.xcloc.zip",
  };
}

describe("XclocClient", () => {
  describe("load", () => {
    it("loads an xcloc archive successfully", async () => {
      const client = new XclocClient();
      const result = await client.load(loadTestPayload());
      expect(result.hasError).toBe(false);
    });

    it("rejects single-file payloads", async () => {
      const client = new XclocClient();
      const result = await client.load({
        kind: "single-file",
        file: new File([""], "test.txt"),
      });
      expect(result.hasError).toBe(true);
    });

    it("parses source language from contents.json", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      expect(client.getSourceLanguage()).toBe("en");
    });

    it("parses target languages from contents.json", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      expect(client.getTargetLanguages()).toEqual(["zh-Hans"]);
    });

    it("creates resources from XLIFF file elements", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      const project = client.getProject();

      expect(project.resources).toHaveLength(2);
      expect(project.resources[0].id).toBe(
        "ArgoTradingSwift/InfoPlist.xcstrings",
      );
      expect(project.resources[1].id).toBe(
        "ArgoTradingSwift/Localizable.xcstrings",
      );
    });

    it("normalizes trans-units into entries", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      const project = client.getProject();

      const totalEntries = project.resources.reduce(
        (sum, r) => sum + r.entries.length,
        0,
      );
      expect(totalEntries).toBe(246);
    });

    it("sets human-readable labels on resources", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      const project = client.getProject();

      expect(project.resources[0].label).toBe("InfoPlist.xcstrings");
      expect(project.resources[1].label).toBe("Localizable.xcstrings");
    });
  });

  describe("getResource", () => {
    it("returns a resource by ID", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      const resource = client.getResource(
        "ArgoTradingSwift/InfoPlist.xcstrings",
      );
      expect(resource).toBeDefined();
      expect(resource?.entries).toHaveLength(5);
    });

    it("returns undefined for unknown resource", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());
      expect(client.getResource("nonexistent")).toBeUndefined();
    });
  });

  describe("updateEntry", () => {
    it("updates an entry's target text", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const resourceId = "ArgoTradingSwift/Localizable.xcstrings";
      const result = client.updateEntry(resourceId, "All", {
        targetText: "全部",
      });

      expect(result.hasError).toBe(false);

      const entry = client
        .getResource(resourceId)
        ?.entries.find((e) => e.id === "All");
      expect(entry?.targetText).toBe("全部");
    });

    it("returns error for unknown resource", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const result = client.updateEntry("nonexistent", "All", {
        targetText: "全部",
      });
      expect(result.hasError).toBe(true);
    });

    it("returns error for unknown entry", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const result = client.updateEntry(
        "ArgoTradingSwift/Localizable.xcstrings",
        "nonexistent",
        { targetText: "test" },
      );
      expect(result.hasError).toBe(true);
    });
  });

  describe("updateEntries", () => {
    it("bulk-updates multiple entries", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const resourceId = "ArgoTradingSwift/Localizable.xcstrings";
      const result = client.updateEntries([
        {
          resourceId,
          entryId: "All",
          update: { targetText: "全部" },
        },
        {
          resourceId,
          entryId: "Back",
          update: { targetText: "返回" },
        },
      ]);

      expect(result.hasError).toBe(false);

      const resource = client.getResource(resourceId)!;
      expect(resource.entries.find((e) => e.id === "All")?.targetText).toBe(
        "全部",
      );
      expect(resource.entries.find((e) => e.id === "Back")?.targetText).toBe(
        "返回",
      );
    });
  });

  describe("exportFile", () => {
    it("exports a zip blob", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const result = await client.exportFile();
      expect(result.hasError).toBe(false);
      if (result.hasError) return;

      expect(result.data.blob).toBeInstanceOf(Blob);
      expect(result.data.fileName).toBe("zh-Hans.xcloc.zip");
    });

    it("includes target elements in exported XLIFF after updates", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      client.updateEntry("ArgoTradingSwift/Localizable.xcstrings", "All", {
        targetText: "全部",
      });

      const result = await client.exportFile();
      if (result.hasError) return;

      // Decompress the exported zip and parse the XLIFF
      const zipBuffer = new Uint8Array(await result.data.blob?.arrayBuffer());
      const entries = unzipSync(zipBuffer);
      const xliffContent =
        entries["zh-Hans.xcloc/Localized Contents/zh-Hans.xliff"];
      const xliffXml = new TextDecoder().decode(xliffContent);

      const doc = parseXliff(xliffXml);
      const localizable = doc.files.find(
        (f) => f.original === "ArgoTradingSwift/Localizable.xcstrings",
      )!;
      const allUnit = localizable.transUnits.find((t) => t.id === "All")!;
      expect(allUnit.target).toBe("全部");
    });

    it("round-trips: load → update → export → reload preserves data", async () => {
      // Load original
      const client1 = new XclocClient();
      await client1.load(loadTestPayload());

      // Update some entries
      const resourceId = "ArgoTradingSwift/Localizable.xcstrings";
      client1.updateEntry(resourceId, "All", { targetText: "全部" });
      client1.updateEntry(resourceId, "Back", { targetText: "返回" });
      client1.updateEntry(resourceId, "Version", {
        targetText: "版本",
      });

      // Export
      const exportResult = await client1.exportFile();
      if (exportResult.hasError) return;

      // Reload from exported zip
      const zipBuffer = new Uint8Array(
        await exportResult.data.blob?.arrayBuffer(),
      );
      const entries = unzipSync(zipBuffer);

      const files: VirtualFile[] = [];
      for (const [path, content] of Object.entries(entries)) {
        if (path.endsWith("/")) continue;
        files.push({ path, content });
      }

      const client2 = new XclocClient();
      const loadResult = await client2.load({
        kind: "archive",
        tree: { files },
        originalFileName: "zh-Hans.xcloc.zip",
      });
      expect(loadResult.hasError).toBe(false);

      // Verify translations survived
      const resource = client2.getResource(resourceId)!;
      expect(resource.entries.find((e) => e.id === "All")?.targetText).toBe(
        "全部",
      );
      expect(resource.entries.find((e) => e.id === "Back")?.targetText).toBe(
        "返回",
      );
      expect(resource.entries.find((e) => e.id === "Version")?.targetText).toBe(
        "版本",
      );

      // Verify total entry count unchanged
      const totalEntries = client2
        .getProject()
        .resources.reduce((sum, r) => sum + r.entries.length, 0);
      expect(totalEntries).toBe(246);
    });
  });

  describe("updateFromXcloc", () => {
    function loadUpdatedPayload(): UploadPayload {
      const zipPath = resolve(
        __dirname,
        "../../../test-assets/zh-Hans-updated.xcloc.zip",
      );
      const zipBuffer = new Uint8Array(readFileSync(zipPath));
      const entries = unzipSync(zipBuffer);

      const files: VirtualFile[] = [];
      for (const [path, content] of Object.entries(entries)) {
        if (path.endsWith("/")) continue;
        files.push({ path, content });
      }

      return {
        kind: "archive",
        tree: { files },
        originalFileName: "zh-Hans-updated.xcloc.zip",
      };
    }

    it("merges new entries and preserves translations", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      // Translate some entries first
      const resourceId = "ArgoTradingSwift/Localizable.xcstrings";
      client.updateEntry(resourceId, "All", { targetText: "全部" });
      client.updateEntry(resourceId, "Cancel", { targetText: "取消" });
      client.updateEntry(resourceId, "Back", { targetText: "返回" });

      // Update with new xcloc (removes All, Back; adds New Feature, Dashboard Settings)
      const result = client.updateFromXcloc(loadUpdatedPayload());
      expect(result.hasError).toBe(false);
      if (result.hasError) return;

      // Verify stats
      expect(result.data.removed).toBe(3); // ArgoTrading, All, Back
      expect(result.data.added).toBe(2); // New Feature, Dashboard Settings
      expect(result.data.total).toBe(245);

      // Verify preserved translation for Cancel
      const resource = client.getResource(resourceId)!;
      const cancelEntry = resource.entries.find((e) => e.id === "Cancel");
      expect(cancelEntry?.targetText).toBe("取消");

      // Verify removed entries no longer exist
      expect(resource.entries.find((e) => e.id === "All")).toBeUndefined();
      expect(resource.entries.find((e) => e.id === "Back")).toBeUndefined();

      // Verify new entries added
      const newFeature = resource.entries.find((e) => e.id === "New Feature");
      expect(newFeature).toBeDefined();
      expect(newFeature?.targetText).toBe("");
      expect(newFeature?.comment).toBe("A newly added feature label");

      const dashSettings = resource.entries.find(
        (e) => e.id === "Dashboard Settings",
      );
      expect(dashSettings).toBeDefined();
      expect(dashSettings?.targetText).toBe("");
    });

    it("preserves translations for entries in InfoPlist resource too", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const infoResourceId = "ArgoTradingSwift/InfoPlist.xcstrings";
      client.updateEntry(infoResourceId, "Argo Trading App", {
        targetText: "Argo 交易应用",
      });

      const result = client.updateFromXcloc(loadUpdatedPayload());
      expect(result.hasError).toBe(false);

      const resource = client.getResource(infoResourceId)!;
      const entry = resource.entries.find((e) => e.id === "Argo Trading App");
      expect(entry?.targetText).toBe("Argo 交易应用");

      // ArgoTrading was removed in updated version
      expect(
        resource.entries.find((e) => e.id === "ArgoTrading"),
      ).toBeUndefined();
    });

    it("syncs xliff doc for export after update", async () => {
      const client = new XclocClient();
      await client.load(loadTestPayload());

      const resourceId = "ArgoTradingSwift/Localizable.xcstrings";
      client.updateEntry(resourceId, "Cancel", { targetText: "取消" });

      const result = client.updateFromXcloc(loadUpdatedPayload());
      expect(result.hasError).toBe(false);

      // Export and verify the XLIFF contains preserved translation
      const exportResult = await client.exportFile();
      expect(exportResult.hasError).toBe(false);
      if (exportResult.hasError) return;

      const zipBuffer = new Uint8Array(
        await exportResult.data.blob?.arrayBuffer(),
      );
      const entries = unzipSync(zipBuffer);
      const xliffContent =
        entries["zh-Hans.xcloc/Localized Contents/zh-Hans.xliff"];
      const xliffXml = new TextDecoder().decode(xliffContent);

      const doc = parseXliff(xliffXml);
      const localizable = doc.files.find(
        (f) => f.original === "ArgoTradingSwift/Localizable.xcstrings",
      )!;
      const cancelUnit = localizable.transUnits.find((t) => t.id === "Cancel")!;
      expect(cancelUnit.target).toBe("取消");

      // New entries should exist in exported XLIFF
      expect(
        localizable.transUnits.find((t) => t.id === "New Feature"),
      ).toBeDefined();
    });

    it("rejects non-archive payloads", () => {
      const client = new XclocClient();
      const result = client.updateFromXcloc({
        kind: "single-file",
        file: new File([""], "test.txt"),
      });
      expect(result.hasError).toBe(true);
    });
  });
});
