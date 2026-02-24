import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projectVersions, projects, terms } from "@/lib/db/schema";
import { EditorClient } from "./editor-client";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { id } = await params;

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

  return (
    <div className="flex flex-1 flex-col p-4">
      <EditorClient
        project={{
          id: project.id,
          name: project.name,
          formatId: project.formatId,
          sourceLanguage: project.sourceLanguage,
          targetLanguage: project.targetLanguage,
          blobUrl: project.blobUrl,
          content: project.content,
          formatData: project.formatData,
        }}
        initialTerms={projectTerms}
        versionCount={versionCountResult?.count ?? 0}
      />
    </div>
  );
}
