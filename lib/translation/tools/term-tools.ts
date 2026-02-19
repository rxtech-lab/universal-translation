import { tool } from "ai";
import { z } from "zod";

export interface Term {
	id: string;
	originalText: string;
	translation: string;
	comment?: string | null;
}

export function createTermTools(terms: Term[]) {
	return {
		lookupTerm: tool({
			description:
				"Look up a terminology entry by its ID or original text. Use this to check how a specific term should be translated.",
			inputSchema: z.object({
				query: z
					.string()
					.describe("Term ID (kebab-case slug) or original text to search for"),
			}),
			execute: async ({ query }) => {
				const lowerQuery = query.toLowerCase();
				const exact = terms.find(
					(t) => t.id === query || t.originalText === query,
				);
				if (exact) return exact;

				const partial = terms.find(
					(t) =>
						t.id.includes(lowerQuery) ||
						t.originalText.toLowerCase().includes(lowerQuery),
				);
				return partial ?? { notFound: true, query };
			},
		}),
	};
}

/** Slugify text into a kebab-case term ID. */
export function slugifyTermId(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

/** Ensure uniqueness by appending -2, -3 etc. if needed. */
export function uniqueTermId(base: string, existingIds: Set<string>): string {
	if (!existingIds.has(base)) return base;
	let counter = 2;
	while (existingIds.has(`${base}-${counter}`)) {
		counter++;
	}
	return `${base}-${counter}`;
}
