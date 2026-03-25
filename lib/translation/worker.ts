import {
  convertToModelMessages,
  createGateway,
  stepCountIs,
  streamText,
  tool,
  type UIMessageChunk,
} from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eventDetails, logWorker, taskDetails } from "@/lib/queue/log";
import { publishRunEvent } from "@/lib/queue/producer";
import {
  clearRunCancelled,
  clearRunEventCache,
  isRunCancelled,
  renewActiveRun,
} from "@/lib/queue/stream-cache";
import type {
  ChatTaskPayload,
  RunEventEnvelope,
  TranslationTask,
  TranslationWorkerEvent,
} from "@/lib/queue/types";
import { translateLyricsEntries } from "@/lib/translation/lyrics/agent";
import {
  getTranslationRun,
  withTranslationRun,
} from "@/lib/translation/run-state";
import type { TranslationProject } from "@/lib/translation/types";
import { translateEntries } from "@/lib/translation/xcloc/agent";

const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4-20250514";

function createModel(modelId = DEFAULT_CHAT_MODEL) {
  const gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });

  return gateway(modelId);
}

function cloneProject(content: unknown) {
  return structuredClone(content) as TranslationProject;
}

function buildEmitter(task: TranslationTask) {
  let seq = 0;

  return async (kind: RunEventEnvelope["kind"], payload: unknown) => {
    seq += 1;
    const event = {
      runId: task.runId,
      projectId: task.projectId,
      userId: task.userId,
      seq,
      kind,
      payload,
      timestamp: new Date().toISOString(),
    } as RunEventEnvelope;
    logWorker("event_emitting", eventDetails(event));
    await publishRunEvent(event);
  };
}

async function saveProjectContent(
  projectId: string,
  userId: string,
  content: TranslationProject,
  options?: {
    status?: string;
    metadata?: unknown;
  },
) {
  await db
    .update(projects)
    .set({
      content,
      updatedAt: new Date(),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.metadata !== undefined
        ? { metadata: options.metadata }
        : {}),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

async function updateProjectStatus(
  projectId: string,
  userId: string,
  status: string,
  metadata?: unknown,
) {
  await db
    .update(projects)
    .set({
      status,
      updatedAt: new Date(),
      ...(metadata !== undefined ? { metadata } : {}),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

async function clearProjectTranslationRun(
  projectId: string,
  userId: string,
  status: string,
) {
  const [project] = await db
    .select({ metadata: projects.metadata })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  await updateProjectStatus(
    projectId,
    userId,
    status,
    withTranslationRun(project?.metadata, null),
  );
}

function buildTranslationRunState(
  runId: string,
  status: "queued" | "translating",
  current: number,
  total: number,
) {
  return {
    runId,
    status,
    current,
    total,
    updatedAt: new Date().toISOString(),
  } as const;
}

function applyTranslationEvent(
  projectContent: TranslationProject,
  formatId: string,
  event: TranslationWorkerEvent,
) {
  if (
    event.type === "entry-translated" ||
    event.type === "previous-translation-modified"
  ) {
    const resource = projectContent.resources.find(
      (item) => item.id === event.resourceId,
    );
    const entry = resource?.entries.find((item) => item.id === event.entryId);
    if (entry) {
      entry.targetText = event.targetText;
    }
  }

  if (
    formatId === "lyrics" &&
    (event.type === "line-rhythm-analyzed" ||
      event.type === "line-rhyme-analyzed" ||
      event.type === "line-review-result")
  ) {
    const resource = projectContent.resources[0];
    const entry = resource?.entries.find((item) => item.id === event.entryId);

    if (!entry) return;

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

async function createChatErrorStream(
  emit: (kind: RunEventEnvelope["kind"], payload: unknown) => Promise<void>,
  message: string,
) {
  await emit("chat-ui-chunk", {
    type: "error",
    errorText: message,
  } satisfies UIMessageChunk);
}

async function runTranslateTask(
  task: Extract<TranslationTask, { type: "translate" }>,
  emit: (kind: RunEventEnvelope["kind"], payload: unknown) => Promise<void>,
) {
  logWorker("translate_started", taskDetails(task));
  const [dbProject] = await db
    .select({
      content: projects.content,
      formatId: projects.formatId,
      metadata: projects.metadata,
    })
    .from(projects)
    .where(
      and(eq(projects.id, task.projectId), eq(projects.userId, task.userId)),
    );

  if (!dbProject?.content) {
    logWorker("translate_project_missing", taskDetails(task));
    await emit("translation-event", {
      type: "error",
      message: "Project not found",
    } satisfies TranslationWorkerEvent);
    return;
  }

  const projectContent = cloneProject(dbProject.content);
  const isLyrics = dbProject.formatId === "lyrics";
  logWorker(
    "translate_project_loaded",
    `${taskDetails(task)} formatId=${dbProject.formatId} mode=${isLyrics ? "lyrics" : "standard"}`,
  );
  let projectMetadata = dbProject.metadata;
  let translationRun =
    getTranslationRun(projectMetadata) ??
    buildTranslationRunState(
      task.runId,
      "queued",
      0,
      task.payload.entries.length,
    );

  await clearRunEventCache(task.runId);
  await clearRunCancelled(task.runId);
  translationRun = buildTranslationRunState(
    task.runId,
    "translating",
    translationRun.current,
    task.payload.entries.length,
  );
  projectMetadata = withTranslationRun(projectMetadata, translationRun);
  await updateProjectStatus(
    task.projectId,
    task.userId,
    "translating",
    projectMetadata,
  );
  logWorker(
    "translate_status_updated",
    `${taskDetails(task)} status=translating total=${task.payload.entries.length}`,
  );

  if (process.env.IS_E2E) {
    logWorker("translate_e2e_mode", taskDetails(task));
    await emit("translation-event", {
      type: "translate-start",
      total: task.payload.entries.length,
    } satisfies TranslationWorkerEvent);

    for (let i = 0; i < task.payload.entries.length; i += 1) {
      if (await isRunCancelled(task.runId)) {
        logWorker(
          "translate_cancelled",
          `${taskDetails(task)} at=${i}/${task.payload.entries.length}`,
        );
        projectMetadata = withTranslationRun(projectMetadata, null);
        await updateProjectStatus(
          task.projectId,
          task.userId,
          "stopped",
          projectMetadata,
        );
        await emit("translation-event", {
          type: "stopped",
          reason: "cancelled",
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      const entry = task.payload.entries[i];
      const targetText = `[E2E] ${entry.sourceText}`;
      applyTranslationEvent(projectContent, dbProject.formatId, {
        type: "entry-translated",
        resourceId: entry.resourceId,
        entryId: entry.id,
        targetText,
        current: i + 1,
        total: task.payload.entries.length,
      });
      translationRun = buildTranslationRunState(
        task.runId,
        "translating",
        i + 1,
        task.payload.entries.length,
      );
      projectMetadata = withTranslationRun(projectMetadata, translationRun);
      await updateProjectStatus(
        task.projectId,
        task.userId,
        "translating",
        projectMetadata,
      );
      logWorker(
        "translate_progress",
        `${taskDetails(task)} current=${i + 1} total=${task.payload.entries.length} entryId=${entry.id}`,
      );

      await emit("translation-event", {
        type: "entry-translated",
        resourceId: entry.resourceId,
        entryId: entry.id,
        targetText,
        current: i + 1,
        total: task.payload.entries.length,
      });
    }

    await saveProjectContent(task.projectId, task.userId, projectContent, {
      status: "completed",
      metadata: withTranslationRun(projectMetadata, null),
    });
    logWorker("translate_saved_completed", taskDetails(task));
    await emit("translation-event", {
      type: "batch-complete",
      batchIndex: 0,
      totalBatches: 1,
    });
    await emit("translation-event", { type: "complete" });
    return;
  }

  const allLyricsEntries = isLyrics
    ? projectContent.resources.flatMap((resource) =>
        resource.entries.map((entry) => ({
          ...entry,
          resourceId: resource.id,
        })),
      )
    : undefined;

  const events = isLyrics
    ? translateLyricsEntries({
        entries: task.payload.entries,
        allEntries: allLyricsEntries,
        sourceLanguage: task.payload.sourceLanguage,
        targetLanguage: task.payload.targetLanguage,
        projectId: task.projectId,
        userSuggestion: task.payload.suggestion,
      })
    : translateEntries({
        entries: task.payload.entries,
        sourceLanguage: task.payload.sourceLanguage,
        targetLanguage: task.payload.targetLanguage,
        projectId: task.projectId,
        formatContext:
          dbProject.formatId === "srt"
            ? "subtitle"
            : dbProject.formatId === "po"
              ? "po-localization"
              : dbProject.formatId === "document"
                ? "document"
                : dbProject.formatId === "html"
                  ? "html"
                  : undefined,
        shouldCancel: () => isRunCancelled(task.runId),
      });

  let sawComplete = false;

  for await (const event of events) {
    if (await isRunCancelled(task.runId)) {
      logWorker("translate_cancelled", taskDetails(task));
      projectMetadata = withTranslationRun(projectMetadata, null);
      await updateProjectStatus(
        task.projectId,
        task.userId,
        "stopped",
        projectMetadata,
      );
      await emit("translation-event", {
        type: "stopped",
        reason: "cancelled",
      });
      return;
    }

    await renewActiveRun(task.projectId, task.runId);
    applyTranslationEvent(projectContent, dbProject.formatId, event);

    if (event.type === "translate-start") {
      logWorker(
        "translate_stream_started",
        `${taskDetails(task)} total=${event.total}`,
      );
      translationRun = buildTranslationRunState(
        task.runId,
        "translating",
        translationRun.current,
        event.total,
      );
      projectMetadata = withTranslationRun(projectMetadata, translationRun);
      await updateProjectStatus(
        task.projectId,
        task.userId,
        "translating",
        projectMetadata,
      );
    } else if (
      event.type === "entry-translated" ||
      (isLyrics && event.type === "line-complete")
    ) {
      logWorker(
        "translate_progress",
        `${taskDetails(task)} current=${event.current} total=${event.total}${"entryId" in event ? ` entryId=${event.entryId}` : ""}`,
      );
      translationRun = buildTranslationRunState(
        task.runId,
        "translating",
        event.current,
        event.total,
      );
      projectMetadata = withTranslationRun(projectMetadata, translationRun);
      await updateProjectStatus(
        task.projectId,
        task.userId,
        "translating",
        projectMetadata,
      );
    }

    if (event.type === "complete") {
      sawComplete = true;
      logWorker("translate_stream_complete", taskDetails(task));
      continue;
    }

    const shouldSave =
      event.type === "batch-complete" ||
      (isLyrics && event.type === "line-complete");

    if (shouldSave) {
      try {
        await saveProjectContent(task.projectId, task.userId, projectContent, {
          metadata: projectMetadata,
        });
        logWorker(
          "translate_batch_saved",
          `${taskDetails(task)} trigger=${event.type}${event.type === "batch-complete" ? ` batch=${event.batchIndex + 1}/${event.totalBatches}` : ""}`,
        );
        await emit("translation-event", {
          type: "entries-saved",
          batchIndex: event.type === "batch-complete" ? event.batchIndex : 0,
        });
      } catch (error) {
        logWorker(
          "translate_batch_save_failed",
          `${taskDetails(task)} error=${error instanceof Error ? error.message : String(error)}`,
        );
        await emit("translation-event", {
          type: "save-error",
          message: error instanceof Error ? error.message : String(error),
          batchIndex: event.type === "batch-complete" ? event.batchIndex : 0,
        });
      }
    }

    await emit("translation-event", event);
  }

  await saveProjectContent(task.projectId, task.userId, projectContent, {
    status: "completed",
    metadata: withTranslationRun(projectMetadata, null),
  });
  logWorker("translate_final_save_completed", taskDetails(task));

  if (sawComplete) {
    await emit("translation-event", { type: "complete" });
  }
}

async function runChatTask(
  task: Extract<TranslationTask, { type: "chat" }>,
  emit: (kind: RunEventEnvelope["kind"], payload: unknown) => Promise<void>,
) {
  logWorker("chat_started", taskDetails(task));
  const [dbProject] = await db
    .select({
      content: projects.content,
      sourceLanguage: projects.sourceLanguage,
      targetLanguage: projects.targetLanguage,
    })
    .from(projects)
    .where(
      and(eq(projects.id, task.projectId), eq(projects.userId, task.userId)),
    );

  if (!dbProject?.content) {
    logWorker("chat_project_missing", taskDetails(task));
    await createChatErrorStream(emit, "Project not found");
    return;
  }

  await clearRunEventCache(task.runId);
  logWorker("chat_cache_cleared", taskDetails(task));
  const projectContent = cloneProject(dbProject.content);
  const sourceLanguage =
    projectContent.sourceLanguage ?? dbProject.sourceLanguage ?? "en";
  const targetLanguage =
    projectContent.targetLanguages?.[0] ??
    dbProject.targetLanguage ??
    "zh-Hans";

  const resourceSummaries = projectContent.resources
    .map((resource) => {
      const translated = resource.entries.filter((entry) =>
        entry.targetText.trim(),
      ).length;
      return `- ${resource.id} (${resource.label}): ${translated}/${resource.entries.length} translated`;
    })
    .join("\n");

  const modelMessages = await convertToModelMessages(
    task.payload.messages as Parameters<typeof convertToModelMessages>[0],
  );

  const result = streamText({
    model: createModel(),
    system: `You are a translation editing assistant for a software localization project.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}

Project resources:
${resourceSummaries}

You can:
1. Search for translation entries by source text or ID
2. Get the details of a specific entry
3. Update translations for specific entries
4. List all resources in the project
5. Show a visual chart of overall translation progress

When updating translations:
- Preserve format specifiers: %@, %lld, %1$@, %2$@, %%
- Keep markdown formatting if present
- Be natural and contextually appropriate for app UI

Always explain what you're doing and confirm changes with the user.`,
    messages: modelMessages,
    stopWhen: stepCountIs(20),
    tools: {
      updateTranslation: tool({
        description:
          "Update the translation for a specific entry. Use this when the user asks you to change a translation.",
        inputSchema: z.object({
          resourceId: z.string(),
          entryId: z.string(),
          targetText: z.string(),
        }),
        execute: async ({ resourceId, entryId, targetText }) => {
          const resource = projectContent.resources.find(
            (item) => item.id === resourceId,
          );
          const entry = resource?.entries.find((item) => item.id === entryId);

          if (!resource || !entry) {
            return {
              success: false,
              error: !resource ? "Resource not found" : "Entry not found",
              resourceId,
              entryId,
              oldText: "",
              newText: "",
              sourceText: "",
            };
          }

          const oldText = entry.targetText;
          entry.targetText = targetText;
          await saveProjectContent(task.projectId, task.userId, projectContent);

          return {
            success: true,
            error: "",
            resourceId,
            entryId,
            oldText,
            newText: targetText,
            sourceText: entry.sourceText,
          };
        },
      }),
      searchEntries: tool({
        description:
          "Search translation entries by source text content. Returns matching entries with their current translations.",
        inputSchema: z.object({
          query: z.string(),
          resourceId: z.string().optional(),
        }),
        execute: async ({ query, resourceId }) => {
          const lowerQuery = query.toLowerCase();
          const resources = resourceId
            ? projectContent.resources.filter((item) => item.id === resourceId)
            : projectContent.resources;

          return resources
            .flatMap((resource) =>
              resource.entries
                .filter(
                  (entry) =>
                    entry.sourceText.toLowerCase().includes(lowerQuery) ||
                    entry.id.toLowerCase().includes(lowerQuery) ||
                    entry.targetText.toLowerCase().includes(lowerQuery),
                )
                .slice(0, 15)
                .map((entry) => ({
                  resourceId: resource.id,
                  entryId: entry.id,
                  sourceText: entry.sourceText,
                  targetText: entry.targetText || "(not yet translated)",
                  comment: entry.comment,
                })),
            )
            .slice(0, 20);
        },
      }),
      getEntry: tool({
        description: "Get the full details of a specific translation entry.",
        inputSchema: z.object({
          resourceId: z.string(),
          entryId: z.string(),
        }),
        execute: async ({ resourceId, entryId }) => {
          const resource = projectContent.resources.find(
            (item) => item.id === resourceId,
          );
          const entry = resource?.entries.find((item) => item.id === entryId);

          if (!resource) return { error: "Resource not found" };
          if (!entry) return { error: "Entry not found" };

          return {
            resourceId,
            entryId: entry.id,
            sourceText: entry.sourceText,
            targetText: entry.targetText,
            comment: entry.comment,
            context: entry.context,
            maxLength: entry.maxLength,
            pluralForm: entry.pluralForm,
          };
        },
      }),
      listResources: tool({
        description:
          "List all resources in the project with their translation progress.",
        inputSchema: z.object({}),
        execute: async () => {
          return projectContent.resources.map((resource) => ({
            id: resource.id,
            label: resource.label,
            totalEntries: resource.entries.length,
            translatedEntries: resource.entries.filter((entry) =>
              entry.targetText.trim(),
            ).length,
          }));
        },
      }),
      showTranslationProgress: tool({
        description:
          "Show a visual chart of translation progress across all resources. Use this when the user asks about progress, completion status, or wants an overview.",
        inputSchema: z.object({}),
        execute: async () => {
          const resources = projectContent.resources.map((resource) => {
            const total = resource.entries.length;
            const translated = resource.entries.filter((entry) =>
              entry.targetText.trim(),
            ).length;

            return {
              name: resource.label || resource.id,
              translated,
              untranslated: total - translated,
              total,
              percentage:
                total > 0 ? Math.round((translated / total) * 100) : 0,
            };
          });

          const totalEntries = resources.reduce(
            (sum, item) => sum + item.total,
            0,
          );
          const totalTranslated = resources.reduce(
            (sum, item) => sum + item.translated,
            0,
          );

          return {
            resources,
            summary: {
              totalEntries,
              totalTranslated,
              totalUntranslated: totalEntries - totalTranslated,
              overallPercentage:
                totalEntries > 0
                  ? Math.round((totalTranslated / totalEntries) * 100)
                  : 0,
            },
          };
        },
      }),
    },
  });
  logWorker(
    "chat_stream_created",
    `${taskDetails(task)} sourceLanguage=${sourceLanguage} targetLanguage=${targetLanguage}`,
  );

  for await (const chunk of result.toUIMessageStream()) {
    await renewActiveRun(task.projectId, task.runId);
    logWorker("chat_chunk", `${taskDetails(task)} chunkType=${chunk.type}`);
    await emit("chat-ui-chunk", chunk);
  }

  logWorker("chat_finished", taskDetails(task));
}

const MAX_RETRIES = Number(process.env.WORKER_MAX_RETRIES ?? "3");
const BASE_RETRY_DELAY_MS = 1_000;

function retryDelayMs(attempt: number) {
  return BASE_RETRY_DELAY_MS * 2 ** attempt;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runWorkerTask(task: TranslationTask) {
  const emit = buildEmitter(task);

  logWorker("task_runner_started", taskDetails(task));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = retryDelayMs(attempt - 1);
        logWorker(
          "task_retry",
          `${taskDetails(task)} attempt=${attempt + 1}/${MAX_RETRIES + 1} delay=${delay}ms`,
        );
        await sleep(delay);
        await renewActiveRun(task.projectId, task.runId);
      }

      if (task.type === "translate") {
        await runTranslateTask(task, emit);
      } else {
        await runChatTask(task, emit);
      }

      logWorker("task_runner_finished", taskDetails(task));
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logWorker(
        "task_runner_failed",
        `${taskDetails(task)} attempt=${attempt + 1}/${MAX_RETRIES + 1} error=${errorMessage}`,
      );

      if (attempt < MAX_RETRIES) {
        continue;
      }

      // Final attempt failed — report the error to the client
      if (task.type === "translate") {
        await clearProjectTranslationRun(
          task.projectId,
          task.userId,
          "error",
        ).catch(() => undefined);
        await emit("translation-event", {
          type: "error",
          message: errorMessage,
        });
      } else {
        await createChatErrorStream(emit, errorMessage);
      }
    }
  }
}

export function getChatPayload(body: unknown): ChatTaskPayload {
  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !Array.isArray((body as { messages?: unknown[] }).messages)
  ) {
    throw new Error("Invalid chat payload");
  }

  return {
    messages: (body as { messages: unknown[] }).messages,
  };
}
