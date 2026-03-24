import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getActiveRunId } from "@/lib/queue/stream-cache";
import { getTranslationRun } from "@/lib/translation/run-state";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const userId = session.user.id;

  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      metadata: projects.metadata,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const cachedRun = getTranslationRun(project.metadata);
  const activeRunId = await getActiveRunId(projectId);
  const runId = activeRunId ?? cachedRun?.runId ?? null;
  const active =
    !!runId &&
    (project.status === "queued" || project.status === "translating");

  return NextResponse.json({
    active,
    runId,
    status: cachedRun?.status ?? (active ? project.status : null),
    current: cachedRun?.current ?? 0,
    total: cachedRun?.total ?? 0,
  });
}
