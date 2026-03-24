import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { setRunCancelled } from "@/lib/queue/stream-cache";

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
  const body = (await request.json()) as { runId?: string };

  if (!body.runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await setRunCancelled(body.runId);

  return NextResponse.json({ cancelled: true });
}
