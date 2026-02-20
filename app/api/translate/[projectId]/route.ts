import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { EntryWithResource } from "@/lib/translation/tools/context-tools";
import type { TranslationProject } from "@/lib/translation/types";
import { translateLyricsEntries } from "@/lib/translation/lyrics/agent";
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
    suggestion?: string;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        const isLyrics = dbProject.formatId === "lyrics";

        // Build full entries list from project content for lyrics context
        const allLyricsEntries = isLyrics
          ? projectContent.resources.flatMap((r) =>
              r.entries.map((e) => ({ ...e, resourceId: r.id })),
            )
          : undefined;

        const events = isLyrics
          ? translateLyricsEntries({
              entries: body.entries,
              allEntries: allLyricsEntries,
              sourceLanguage: body.sourceLanguage,
              targetLanguage: body.targetLanguage,
              projectId,
              userSuggestion: body.suggestion,
            })
          : translateEntries({
              entries: body.entries,
              sourceLanguage: body.sourceLanguage,
              targetLanguage: body.targetLanguage,
              projectId,
              formatContext:
                dbProject.formatId === "srt"
                  ? "subtitle"
                  : dbProject.formatId === "po"
                    ? "po-localization"
                    : dbProject.formatId === "document"
                      ? "document"
                      : undefined,
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

          // Persist lyrics analysis into entry metadata
          if (
            isLyrics &&
            (event.type === "line-rhythm-analyzed" ||
              event.type === "line-rhyme-analyzed" ||
              event.type === "line-review-result")
          ) {
            const resource = projectContent.resources[0];
            if (resource) {
              const entry = resource.entries.find(
                (e) => e.id === event.entryId,
              );
              if (entry) {
                entry.metadata = entry.metadata ?? {};
                if (event.type === "line-rhythm-analyzed") {
                  entry.metadata.syllableCount = event.syllableCount;
                  entry.metadata.stressPattern = event.stressPattern;
                } else if (event.type === "line-rhyme-analyzed") {
                  entry.metadata.rhymeWords = event.rhymeWords;
                  entry.metadata.relatedLineIds = event.relatedLineIds;
                  entry.metadata.relatedRhymeWords = event.relatedRhymeWords;
                } else if (event.type === "line-review-result") {
                  entry.metadata.reviewPassed = event.passed;
                  entry.metadata.reviewFeedback = event.feedback;
                }
              }
            }
          }

          // Flush to DB on batch boundaries or after each lyrics line
          const shouldSave =
            event.type === "batch-complete" ||
            (isLyrics && event.type === "line-complete");

          if (shouldSave) {
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
                  batchIndex:
                    event.type === "batch-complete" ? event.batchIndex : 0,
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
                  batchIndex:
                    event.type === "batch-complete" ? event.batchIndex : 0,
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
