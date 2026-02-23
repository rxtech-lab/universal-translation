"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, terms } from "@/lib/db/schema";
import { computeTermMerge } from "@/lib/terms/merge";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

async function verifyProjectOwner(projectId: string, userId: string) {
  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project || project.userId !== userId)
    throw new Error("Project not found");
}

export async function createTerm(
  projectId: string,
  data: {
    slug: string;
    originalText: string;
    translation: string;
    comment?: string;
  },
) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  const now = new Date();
  await db.insert(terms).values({
    id: crypto.randomUUID(),
    slug: data.slug,
    projectId,
    originalText: data.originalText,
    translation: data.translation,
    comment: data.comment ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateTerm(
  termId: string,
  data: { translation?: string; comment?: string },
) {
  await requireUserId();

  await db
    .update(terms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(terms.id, termId));
}

export async function deleteTerm(termId: string) {
  await requireUserId();
  await db.delete(terms).where(eq(terms.id, termId));
}

export async function saveProjectTerms(
  projectId: string,
  newTerms: Array<{
    id: string;
    slug: string;
    originalText: string;
    translation: string;
    comment?: string | null;
  }>,
) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  if (newTerms.length === 0) return;

  // Fetch existing terms to merge instead of replace
  const existingTerms = await db
    .select({ id: terms.id, slug: terms.slug })
    .from(terms)
    .where(eq(terms.projectId, projectId));

  const { toInsert, toUpdate } = computeTermMerge(existingTerms, newTerms);

  const now = new Date();

  // Update existing terms that match by slug
  for (const t of toUpdate) {
    await db
      .update(terms)
      .set({
        originalText: t.originalText,
        translation: t.translation,
        comment: t.comment ?? null,
        updatedAt: now,
      })
      .where(eq(terms.id, t.existingId));
  }

  // Insert new terms
  if (toInsert.length > 0) {
    await db.insert(terms).values(
      toInsert.map((t) => ({
        id: crypto.randomUUID(),
        slug: t.slug,
        projectId,
        originalText: t.originalText,
        translation: t.translation,
        comment: t.comment ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
}

export async function deleteAllTermsByProject(projectId: string) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  await db.delete(terms).where(eq(terms.projectId, projectId));
}

export async function getTermsByProject(projectId: string) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  return db.select().from(terms).where(eq(terms.projectId, projectId));
}
