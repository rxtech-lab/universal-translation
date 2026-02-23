import { describe, expect, it } from "vitest";
import { computeTermMerge } from "@/lib/terms/merge";

describe("computeTermMerge", () => {
  it("inserts all terms when no existing terms", () => {
    const result = computeTermMerge(
      [],
      [
        {
          slug: "argo-trading",
          originalText: "Argo Trading",
          translation: "Argo Trading",
        },
        { slug: "backtest", originalText: "Backtest", translation: "回测" },
      ],
    );

    expect(result.toInsert).toHaveLength(2);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toInsert[0].slug).toBe("argo-trading");
    expect(result.toInsert[1].slug).toBe("backtest");
  });

  it("updates existing terms when slugs match", () => {
    const existing = [
      { id: "uuid-1", slug: "argo-trading" },
      { id: "uuid-2", slug: "backtest" },
    ];
    const incoming = [
      {
        slug: "argo-trading",
        originalText: "Argo Trading Co.",
        translation: "Argo Trading 公司",
      },
      { slug: "backtest", originalText: "Backtest", translation: "回测改进" },
    ];

    const result = computeTermMerge(existing, incoming);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(2);
    expect(result.toUpdate[0]).toEqual({
      existingId: "uuid-1",
      originalText: "Argo Trading Co.",
      translation: "Argo Trading 公司",
      comment: undefined,
    });
    expect(result.toUpdate[1]).toEqual({
      existingId: "uuid-2",
      originalText: "Backtest",
      translation: "回测改进",
      comment: undefined,
    });
  });

  it("preserves existing terms not in the new list (no delete)", () => {
    const existing = [
      { id: "uuid-1", slug: "argo-trading" },
      { id: "uuid-2", slug: "backtest" },
      { id: "uuid-3", slug: "win-rate" },
    ];
    // Only send one term — the other two should NOT appear in toInsert or toUpdate
    const incoming = [
      {
        slug: "argo-trading",
        originalText: "Argo Trading",
        translation: "Argo Trading",
      },
    ];

    const result = computeTermMerge(existing, incoming);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existingId).toBe("uuid-1");
    // "backtest" and "win-rate" are not mentioned — they're preserved in DB
  });

  it("handles mix of new and existing terms", () => {
    const existing = [
      { id: "uuid-1", slug: "argo-trading" },
      { id: "uuid-2", slug: "backtest" },
    ];
    const incoming = [
      {
        slug: "argo-trading",
        originalText: "Argo Trading",
        translation: "Argo Trading",
      },
      { slug: "win-rate", originalText: "Win Rate", translation: "胜率" },
      {
        slug: "drawdown",
        originalText: "Drawdown",
        translation: "回撤",
        comment: "Risk metric",
      },
    ];

    const result = computeTermMerge(existing, incoming);

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existingId).toBe("uuid-1");

    expect(result.toInsert).toHaveLength(2);
    expect(result.toInsert.map((t) => t.slug)).toEqual([
      "win-rate",
      "drawdown",
    ]);
    expect(result.toInsert[1].comment).toBe("Risk metric");
  });

  it("returns empty lists when no new terms provided", () => {
    const existing = [{ id: "uuid-1", slug: "argo-trading" }];

    const result = computeTermMerge(existing, []);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("returns empty lists when both inputs are empty", () => {
    const result = computeTermMerge([], []);

    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("propagates comment field correctly", () => {
    const existing = [{ id: "uuid-1", slug: "argo-trading" }];
    const incoming = [
      {
        slug: "argo-trading",
        originalText: "Argo Trading",
        translation: "Argo",
        comment: "Brand name",
      },
      {
        slug: "new-term",
        originalText: "New",
        translation: "新",
        comment: null,
      },
    ];

    const result = computeTermMerge(existing, incoming);

    expect(result.toUpdate[0].comment).toBe("Brand name");
    expect(result.toInsert[0].comment).toBeNull();
  });
});
