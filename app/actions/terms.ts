"use server";

import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, terms } from "@/lib/db/schema";

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
    id: string;
    originalText: string;
    translation: string;
    comment?: string;
  },
) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  const now = new Date();
  await db.insert(terms).values({
    id: data.id,
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
    originalText: string;
    translation: string;
    comment?: string | null;
  }>,
) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  // Delete existing terms for this project, then insert fresh
  await db.delete(terms).where(eq(terms.projectId, projectId));

  if (newTerms.length > 0) {
    const now = new Date();
    await db
      .insert(terms)
      .values(
        newTerms.map((t) => ({
          id: t.id,
          projectId,
          originalText: t.originalText,
          translation: t.translation,
          comment: t.comment ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: terms.id,
        set: {
          projectId: sql`excluded.project_id`,
          originalText: sql`excluded.original_text`,
          translation: sql`excluded.translation`,
          comment: sql`excluded.comment`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

export async function getTermsByProject(projectId: string) {
  const userId = await requireUserId();
  await verifyProjectOwner(projectId, userId);

  return db.select().from(terms).where(eq(terms.projectId, projectId));
}
