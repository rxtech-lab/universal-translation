import type { Term } from "../tools/term-tools";

export type XclocTranslationEvent =
	| { type: "terminology-scan-start" }
	| {
			type: "terminology-found";
			terms: Term[];
		}
	| { type: "translate-start"; total: number }
	| {
			type: "entry-translated";
			resourceId: string;
			entryId: string;
			targetText: string;
			current: number;
			total: number;
		}
	| { type: "batch-complete"; batchIndex: number; totalBatches: number }
	| { type: "term-resolution-complete" }
	| { type: "complete" }
	| { type: "error"; message: string };
