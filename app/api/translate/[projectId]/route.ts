import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { publishTask } from "@/lib/queue/producer";
import type { TranslateTaskPayload } from "@/lib/queue/types";
import { withTranslationRun } from "@/lib/translation/run-state";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const userId = session.user.id;

  const [project] = await db
    .select({ id: projects.id, metadata: projects.metadata })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date();
  const payload = (await request.json()) as TranslateTaskPayload;
  const runId = crypto.randomUUID();

  await db
    .update(projects)
    .set({
      status: "queued",
      metadata: withTranslationRun(project.metadata, {
        runId,
        status: "queued",
        current: 0,
        total: payload.entries.length,
        updatedAt: now.toISOString(),
      }),
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  await publishTask({
    type: "translate",
    runId,
    projectId,
    userId,
    payload,
  });

  return NextResponse.json({ queued: true, runId });
}
