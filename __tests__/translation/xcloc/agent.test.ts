import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Term } from "@/lib/translation/tools/term-tools";
import type { UploadPayload, VirtualFile } from "@/lib/translation/types";
import { resolveTermTemplates } from "@/lib/translation/xcloc/agent";
import { XclocClient } from "@/lib/translation/xcloc/client";
import type { XclocTranslationEvent } from "@/lib/translation/xcloc/events";

// ---- Mock AI SDK -----------------------------------------------

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

vi.mock("ai", () => ({
  createGateway: () => () => "mock-model",
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  streamText: (...args: unknown[]) => mockStreamText(...args),
  Output: {
    array: ({ element }: { element: unknown }) => ({
      type: "array",
      element,
    }),
    object: ({ schema }: { schema: unknown }) => ({
      type: "object",
      schema,
    }),
  },
  stepCountIs: (n: number) => ({ type: "stepCount", count: n }),
  tool: (def: unknown) => def,
}));

// ---- Test helpers ----------------------------------------------

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

async function collectEvents(
  iterable: AsyncIterable<XclocTranslationEvent>,
): Promise<XclocTranslationEvent[]> {
  const events: XclocTranslationEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

// ---- Tests -----------------------------------------------------

describe("resolveTermTemplates", () => {
  const termsMap = new Map<string, Term>([
    [
      "argo-trading",
      {
        id: "argo-trading",
        originalText: "Argo Trading",
        translation: "Argo Trading",
      },
    ],
    [
      "backtest",
      {
        id: "backtest",
        originalText: "Backtest",
        translation: "回测",
      },
    ],
  ]);

  it("replaces term templates with translations", () => {
    const input = "关于 ${{argo-trading}}";
    expect(resolveTermTemplates(input, termsMap)).toBe("关于 Argo Trading");
  });

  it("replaces multiple templates in one string", () => {
    const input = "${{argo-trading}} ${{backtest}} 结果";
    expect(resolveTermTemplates(input, termsMap)).toBe(
      "Argo Trading 回测 结果",
    );
  });

  it("preserves unrecognized templates", () => {
    const input = "关于 ${{unknown-term}}";
    expect(resolveTermTemplates(input, termsMap)).toBe(
      "关于 ${{unknown-term}}",
    );
  });

  it("handles text with no templates", () => {
    const input = "普通文本";
    expect(resolveTermTemplates(input, termsMap)).toBe("普通文本");
  });

  it("handles empty string", () => {
    expect(resolveTermTemplates("", termsMap)).toBe("");
  });
});

describe("translateProject (mocked AI)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields terminology-scan-start and terminology-found events", async () => {
    // Mock Agent 1: terminology scanner
    mockGenerateText.mockResolvedValue({
      output: [
        {
          id: "argo-trading",
          originalText: "Argo Trading",
          translation: "Argo Trading",
          comment: "Brand name",
        },
      ],
    });

    // Mock Agent 2: translator
    const mockTranslationJson = JSON.stringify({
      translations: [
        { id: "All", targetText: "全部" },
        { id: "Back", targetText: "返回" },
      ],
    });
    mockStreamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield mockTranslationJson;
      })(),
    }));

    const client = new XclocClient();
    await client.load(loadTestPayload());

    const { translateProject } = await import("@/lib/translation/xcloc/agent");
    const events = await collectEvents(
      translateProject({
        client,
        projectId: "test-project",
        model: "test-model",
      }),
    );

    const eventTypes = events.map((e) => e.type);

    // Phase 1 events
    expect(eventTypes).toContain("terminology-scan-start");
    expect(eventTypes).toContain("terminology-found");

    const termEvent = events.find((e) => e.type === "terminology-found");
    expect(termEvent).toBeDefined();
    if (termEvent?.type === "terminology-found") {
      expect(termEvent.terms).toHaveLength(1);
      expect(termEvent.terms[0].id).toBe("argo-trading");
    }
  });

  it("yields translate-start and entry-translated events", async () => {
    mockGenerateText.mockResolvedValue({ output: [] });

    const mockTranslations = {
      translations: [
        { id: "All", targetText: "全部" },
        { id: "Back", targetText: "返回" },
      ],
    };
    mockStreamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield JSON.stringify(mockTranslations);
      })(),
    }));

    const client = new XclocClient();
    await client.load(loadTestPayload());

    const { translateProject } = await import("@/lib/translation/xcloc/agent");
    const events = await collectEvents(
      translateProject({
        client,
        projectId: "test-project",
      }),
    );

    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toContain("translate-start");
    expect(eventTypes).toContain("entry-translated");
    expect(eventTypes).toContain("batch-complete");
    expect(eventTypes).toContain("term-resolution-complete");
    expect(eventTypes).toContain("complete");
  });

  it("applies resolved translations to the client", async () => {
    mockGenerateText.mockResolvedValue({
      output: [
        {
          id: "argo-trading",
          originalText: "Argo Trading",
          translation: "Argo交易",
        },
      ],
    });

    const mockTranslations = {
      translations: [
        {
          id: "Argo Trading",
          targetText: "${{argo-trading}}",
        },
      ],
    };
    mockStreamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield JSON.stringify(mockTranslations);
      })(),
    }));

    const client = new XclocClient();
    await client.load(loadTestPayload());

    const { translateProject } = await import("@/lib/translation/xcloc/agent");
    await collectEvents(
      translateProject({
        client,
        projectId: "test-project",
      }),
    );

    // Term templates are preserved (resolved at render/export time)
    const resource = client.getResource(
      "ArgoTradingSwift/Localizable.xcstrings",
    );
    const entry = resource?.entries.find((e) => e.id === "Argo Trading");

    expect(entry?.targetText).toBe("${{argo-trading}}");
  });

  it("splits entries into batches of 20", async () => {
    mockGenerateText.mockResolvedValue({ output: [] });
    mockStreamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield '{"translations": []}';
      })(),
    }));

    const client = new XclocClient();
    await client.load(loadTestPayload());

    const { translateProject } = await import("@/lib/translation/xcloc/agent");
    const events = await collectEvents(
      translateProject({
        client,
        projectId: "test-project",
      }),
    );

    const batchCompleteEvents = events.filter(
      (e) => e.type === "batch-complete",
    );
    // 246 entries / 20 per batch = 13 batches (12 full + 1 partial)
    expect(batchCompleteEvents).toHaveLength(13);

    // Verify streamText was called 13 times (once per batch)
    expect(mockStreamText).toHaveBeenCalledTimes(13);
  });

  it("handles streamText returning invalid JSON gracefully", async () => {
    mockGenerateText.mockResolvedValue({ output: [] });
    mockStreamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield "This is not valid JSON at all";
      })(),
    }));

    const client = new XclocClient();
    await client.load(loadTestPayload());

    const { translateProject } = await import("@/lib/translation/xcloc/agent");
    const events = await collectEvents(
      translateProject({
        client,
        projectId: "test-project",
      }),
    );

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents.length).toBeGreaterThan(0);

    // Should still complete
    expect(events[events.length - 1].type).toBe("complete");
  });
});
