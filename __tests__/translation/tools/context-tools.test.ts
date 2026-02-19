import { describe, it, expect } from "vitest";
import {
	createContextTools,
	type EntryWithResource,
} from "@/lib/translation/tools/context-tools";

function makeSampleEntries(count: number): EntryWithResource[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `entry-${i}`,
		sourceText: `Source text ${i}`,
		targetText: i < 5 ? `Translated ${i}` : "",
		resourceId: "resource-1",
	}));
}

const executeOptions = {
	toolCallId: "test",
	messages: [],
	abortSignal: undefined as never,
};

describe("createContextTools", () => {
	const entries = makeSampleEntries(20);
	const tools = createContextTools(entries);

	describe("lookupPrevLines", () => {
		it("returns previous entries", async () => {
			const result = await tools.lookupPrevLines.execute(
				{ currentIndex: 5, count: 3 },
				executeOptions,
			);
			expect(result).toHaveLength(3);
			expect(result[0].index).toBe(2);
			expect(result[2].index).toBe(4);
		});

		it("handles boundary at index 0", async () => {
			const result = await tools.lookupPrevLines.execute(
				{ currentIndex: 0, count: 5 },
				executeOptions,
			);
			expect(result).toHaveLength(0);
		});

		it("clamps when count exceeds available entries", async () => {
			const result = await tools.lookupPrevLines.execute(
				{ currentIndex: 2, count: 10 },
				executeOptions,
			);
			expect(result).toHaveLength(2);
			expect(result[0].index).toBe(0);
		});

		it("shows existing translations", async () => {
			const result = await tools.lookupPrevLines.execute(
				{ currentIndex: 3, count: 3 },
				executeOptions,
			);
			expect(result[0].targetText).toBe("Translated 0");
		});
	});

	describe("lookupNextLines", () => {
		it("returns next entries", async () => {
			const result = await tools.lookupNextLines.execute(
				{ currentIndex: 5, count: 3 },
				executeOptions,
			);
			expect(result).toHaveLength(3);
			expect(result[0].index).toBe(6);
			expect(result[0].sourceText).toBe("Source text 6");
		});

		it("handles boundary at last index", async () => {
			const result = await tools.lookupNextLines.execute(
				{ currentIndex: 19, count: 5 },
				executeOptions,
			);
			expect(result).toHaveLength(0);
		});

		it("clamps when count exceeds remaining entries", async () => {
			const result = await tools.lookupNextLines.execute(
				{ currentIndex: 18, count: 5 },
				executeOptions,
			);
			expect(result).toHaveLength(1);
		});
	});

	describe("searchEntries", () => {
		it("finds entries by partial text match", async () => {
			const result = await tools.searchEntries.execute(
				{ query: "Source text 1" },
				executeOptions,
			);
			// Matches "Source text 1", "Source text 10"..."Source text 19"
			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].sourceText).toContain("Source text 1");
		});

		it("returns empty for no match", async () => {
			const result = await tools.searchEntries.execute(
				{ query: "zzz_nonexistent_zzz" },
				executeOptions,
			);
			expect(result).toHaveLength(0);
		});

		it("limits results to 10", async () => {
			const result = await tools.searchEntries.execute(
				{ query: "Source text" },
				executeOptions,
			);
			expect(result).toHaveLength(10);
		});

		it("includes resource ID in results", async () => {
			const result = await tools.searchEntries.execute(
				{ query: "Source text 0" },
				executeOptions,
			);
			expect(result[0].resourceId).toBe("resource-1");
		});
	});
});
