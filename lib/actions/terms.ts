"use server";

import { db } from "@/lib/db";
import { terms } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface TermInput {
	id: string;
	originalText: string;
	translation?: string;
	comment?: string;
}

export async function getTerms(projectId: string) {
	return db.select().from(terms).where(eq(terms.projectId, projectId));
}

export async function getTerm(termId: string) {
	const rows = await db.select().from(terms).where(eq(terms.id, termId));
	return rows[0] ?? null;
}

export async function createTerm(projectId: string, term: TermInput) {
	const now = new Date();
	await db.insert(terms).values({
		id: term.id,
		projectId,
		originalText: term.originalText,
		translation: term.translation ?? "",
		comment: term.comment ?? null,
		createdAt: now,
		updatedAt: now,
	});
}

export async function updateTerm(
	termId: string,
	update: Partial<Pick<TermInput, "translation" | "comment">>,
) {
	await db
		.update(terms)
		.set({
			...update,
			updatedAt: new Date(),
		})
		.where(eq(terms.id, termId));
}

export async function deleteTerm(termId: string) {
	await db.delete(terms).where(eq(terms.id, termId));
}

export async function bulkCreateTerms(
	projectId: string,
	termList: TermInput[],
) {
	if (termList.length === 0) return;

	const now = new Date();
	await db.insert(terms).values(
		termList.map((term) => ({
			id: term.id,
			projectId,
			originalText: term.originalText,
			translation: term.translation ?? "",
			comment: term.comment ?? null,
			createdAt: now,
			updatedAt: now,
		})),
	);
}
