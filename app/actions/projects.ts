"use server";

import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { TranslationProject } from "@/lib/translation/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createProject(data: {
  name: string;
  formatId: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  sourceLocale?: string;
  targetLocale?: string;
  blobUrl?: string;
  content?: TranslationProject;
  formatData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const userId = await requireUserId();
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(projects).values({
    id,
    userId,
    name: data.name,
    formatId: data.formatId,
    sourceLanguage: data.sourceLanguage ?? null,
    targetLanguage: data.targetLanguage ?? null,
    sourceLocale: data.sourceLocale ?? null,
    targetLocale: data.targetLocale ?? null,
    status: "draft",
    blobUrl: data.blobUrl ?? null,
    content: data.content ?? null,
    formatData: data.formatData ?? null,
    metadata: data.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function getProject(projectId: string) {
  const userId = await requireUserId();

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  return project ?? null;
}

export async function updateProjectContent(
  projectId: string,
  content: TranslationProject,
) {
  const userId = await requireUserId();

  await db
    .update(projects)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function updateProjectStatus(projectId: string, status: string) {
  const userId = await requireUserId();

  await db
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function updateProjectFormatData(
  projectId: string,
  formatData: Record<string, unknown>,
) {
  const userId = await requireUserId();

  await db
    .update(projects)
    .set({ formatData, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}
