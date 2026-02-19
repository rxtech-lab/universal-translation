import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { EntryWithResource } from "@/lib/translation/tools/context-tools";
import type { TranslationProject } from "@/lib/translation/types";
import { translateEntries } from "@/lib/translation/xcloc/agent";

export const maxDuration = 300; // 5 minutes for long translations

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { projectId } = await params;

  // Load project content so we can apply translations incrementally
  const [dbProject] = await db
    .select({ content: projects.content, formatId: projects.formatId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!dbProject?.content) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectContent = structuredClone(
    dbProject.content,
  ) as TranslationProject;

  const body = (await request.json()) as {
    entries: EntryWithResource[];
    sourceLanguage: string;
    targetLanguage: string;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        const events = translateEntries({
          entries: body.entries,
          sourceLanguage: body.sourceLanguage,
          targetLanguage: body.targetLanguage,
          projectId,
          formatContext: dbProject.formatId === "srt" ? "subtitle" : undefined,
        });

        for await (const event of events) {
          // Apply each translation to in-memory project content
          if (event.type === "entry-translated") {
            const resource = projectContent.resources.find(
              (r) => r.id === event.resourceId,
            );
            if (resource) {
              const entry = resource.entries.find(
                (e) => e.id === event.entryId,
              );
              if (entry) {
                entry.targetText = event.targetText;
              }
            }
          }

          // Flush to DB on batch boundaries
          if (event.type === "batch-complete") {
            try {
              await db
                .update(projects)
                .set({
                  content: projectContent,
                  updatedAt: new Date(),
                })
                .where(
                  and(eq(projects.id, projectId), eq(projects.userId, userId)),
                );
              emit(
                JSON.stringify({
                  type: "entries-saved",
                  batchIndex: event.batchIndex,
                }),
              );
            } catch (saveErr) {
              emit(
                JSON.stringify({
                  type: "save-error",
                  message:
                    saveErr instanceof Error
                      ? saveErr.message
                      : String(saveErr),
                  batchIndex: event.batchIndex,
                }),
              );
            }
          }

          emit(JSON.stringify(event));
        }

        // Final save to catch any entries after the last batch-complete
        try {
          await db
            .update(projects)
            .set({
              content: projectContent,
              updatedAt: new Date(),
            })
            .where(
              and(eq(projects.id, projectId), eq(projects.userId, userId)),
            );
        } catch {
          // Best-effort final save
        }

        emit("[DONE]");
      } catch (err) {
        emit(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
