import { and, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, projectVersions, terms } from "@/lib/db/schema";
import { EditorClient } from "./editor-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const { id } = await params;
  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)));

  return { title: project?.name };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { id } = await params;
  const { version: versionId } = await searchParams;

  const [[project], projectTerms, [versionCountResult]] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id))),
    db
      .select({
        id: terms.id,
        slug: terms.slug,
        originalText: terms.originalText,
        translation: terms.translation,
        comment: terms.comment,
      })
      .from(terms)
      .where(eq(terms.projectId, id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, id)),
  ]);

  if (!project) redirect("/dashboard");

  // If a version is specified, load its data for preview
  let previewVersion: { id: string; createdAt: Date } | null = null;
  let effectiveContent = project.content;
  let effectiveFormatData = project.formatData;

  if (versionId) {
    const [version] = await db
      .select()
      .from(projectVersions)
      .where(
        and(
          eq(projectVersions.id, versionId),
          eq(projectVersions.projectId, id),
        ),
      );
    if (version) {
      previewVersion = { id: version.id, createdAt: version.createdAt };
      effectiveContent = version.content;
      effectiveFormatData = version.formatData;
    }
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <EditorClient
        key={previewVersion?.id ?? "current"}
        project={{
          id: project.id,
          name: project.name,
          formatId: project.formatId,
          sourceLanguage: project.sourceLanguage,
          targetLanguage: project.targetLanguage,
          blobUrl: project.blobUrl,
          content: effectiveContent,
          formatData: effectiveFormatData,
        }}
        initialTerms={projectTerms}
        versionCount={versionCountResult?.count ?? 0}
        previewVersion={previewVersion}
      />
    </div>
  );
}
