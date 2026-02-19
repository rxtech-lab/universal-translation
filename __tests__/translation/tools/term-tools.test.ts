import { describe, it, expect } from "vitest";
import {
	createTermTools,
	slugifyTermId,
	uniqueTermId,
	type Term,
} from "@/lib/translation/tools/term-tools";

const sampleTerms: Term[] = [
	{
		id: "argo-trading",
		originalText: "Argo Trading",
		translation: "Argo Trading",
		comment: "Brand name, keep as-is",
	},
	{
		id: "backtest",
		originalText: "Backtest",
		translation: "回测",
		comment: "Financial term",
	},
	{
		id: "win-rate",
		originalText: "Win Rate",
		translation: "胜率",
	},
];

describe("createTermTools", () => {
	const tools = createTermTools(sampleTerms);

	describe("lookupTerm", () => {
		it("finds a term by exact ID", async () => {
			const result = await tools.lookupTerm.execute(
				{ query: "argo-trading" },
				{ toolCallId: "test", messages: [], abortSignal: undefined as never },
			);
			expect(result).toHaveProperty("id", "argo-trading");
			expect(result).toHaveProperty("originalText", "Argo Trading");
		});

		it("finds a term by exact original text", async () => {
			const result = await tools.lookupTerm.execute(
				{ query: "Backtest" },
				{ toolCallId: "test", messages: [], abortSignal: undefined as never },
			);
			expect(result).toHaveProperty("id", "backtest");
		});

		it("finds a term by partial text match", async () => {
			const result = await tools.lookupTerm.execute(
				{ query: "win" },
				{ toolCallId: "test", messages: [], abortSignal: undefined as never },
			);
			expect(result).toHaveProperty("id", "win-rate");
		});

		it("returns notFound for non-existent term", async () => {
			const result = await tools.lookupTerm.execute(
				{ query: "nonexistent-term" },
				{ toolCallId: "test", messages: [], abortSignal: undefined as never },
			);
			expect(result).toHaveProperty("notFound", true);
		});
	});
});

describe("slugifyTermId", () => {
	it("converts to kebab-case", () => {
		expect(slugifyTermId("Argo Trading")).toBe("argo-trading");
	});

	it("handles special characters", () => {
		expect(slugifyTermId("Buy & Hold PnL")).toBe("buy-hold-pnl");
	});

	it("truncates to 60 characters", () => {
		const long = "a".repeat(100);
		expect(slugifyTermId(long).length).toBeLessThanOrEqual(60);
	});

	it("trims leading/trailing hyphens", () => {
		expect(slugifyTermId("---hello---")).toBe("hello");
	});
});

describe("uniqueTermId", () => {
	it("returns base ID when no collision", () => {
		expect(uniqueTermId("argo-trading", new Set())).toBe("argo-trading");
	});

	it("appends -2 on first collision", () => {
		expect(uniqueTermId("argo-trading", new Set(["argo-trading"]))).toBe(
			"argo-trading-2",
		);
	});

	it("appends -3 when -2 is also taken", () => {
		expect(
			uniqueTermId(
				"argo-trading",
				new Set(["argo-trading", "argo-trading-2"]),
			),
		).toBe("argo-trading-3");
	});
});
