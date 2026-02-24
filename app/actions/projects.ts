"use server";

import { and, desc, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projectVersions, projects } from "@/lib/db/schema";
import type { TranslationProject } from "@/lib/translation/types";

const MAX_VERSIONS_PER_PROJECT = 50;

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
  const now = new Date();

  // Update the current project content
  await db
    .update(projects)
    .set({ content, updatedAt: now })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  // Fetch the current formatData to snapshot it in the version
  const [project] = await db
    .select({ formatData: projects.formatData })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  // Create a new version snapshot
  await db.insert(projectVersions).values({
    id: crypto.randomUUID(),
    projectId,
    content,
    formatData: project?.formatData ?? null,
    createdAt: now,
  });

  // Prune old versions beyond the retention limit
  const recentVersionIds = db
    .select({ id: projectVersions.id })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt))
    .limit(MAX_VERSIONS_PER_PROJECT);

  await db
    .delete(projectVersions)
    .where(
      and(
        eq(projectVersions.projectId, projectId),
        notInArray(projectVersions.id, recentVersionIds),
      ),
    );
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
  formatData: object,
) {
  const userId = await requireUserId();

  await db
    .update(projects)
    .set({ formatData, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function renameProject(projectId: string, newName: string) {
  const userId = await requireUserId();

  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Project name cannot be empty");

  await db
    .update(projects)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const userId = await requireUserId();

  const [project] = await db
    .select({ blobUrl: projects.blobUrl })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) throw new Error("Project not found");

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (project.blobUrl) {
    try {
      const { del } = await import("@vercel/blob");
      await del(project.blobUrl);
    } catch {
      // Best-effort blob cleanup
    }
  }

  revalidatePath("/dashboard/projects");
}

export async function getProjectVersions(projectId: string) {
  await requireUserId();

  return db
    .select({
      id: projectVersions.id,
      createdAt: projectVersions.createdAt,
    })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt));
}

export async function restoreProjectVersion(
  projectId: string,
  versionId: string,
) {
  const userId = await requireUserId();

  const [version] = await db
    .select()
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.id, versionId),
        eq(projectVersions.projectId, projectId),
      ),
    );

  if (!version) throw new Error("Version not found");

  await db
    .update(projects)
    .set({
      content: version.content,
      formatData: version.formatData,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath(`/dashboard/projects/${projectId}`);
}
