import { consumeTasks } from "@/lib/queue/consumer";
import { closeAmqpConnection } from "@/lib/queue/connection";
import { logWorker, taskDetails } from "@/lib/queue/log";
import { publishRunEvent } from "@/lib/queue/producer";
import {
  acquireActiveRun,
  clearRunCancelled,
  releaseActiveRun,
} from "@/lib/queue/stream-cache";
import type { TranslationTask } from "@/lib/queue/types";
import { runWorkerTask } from "@/lib/translation/worker";

async function emitLockFailure(task: TranslationTask) {
  logWorker("lock_rejected", taskDetails(task));
  if (task.type === "translate") {
    await publishRunEvent({
      runId: task.runId,
      projectId: task.projectId,
      userId: task.userId,
      seq: 1,
      kind: "translation-event",
      payload: {
        type: "error",
        message: "Another task is already active for this project",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await publishRunEvent({
    runId: task.runId,
    projectId: task.projectId,
    userId: task.userId,
    seq: 1,
    kind: "chat-ui-chunk",
    payload: {
      type: "error",
      errorText: "Another task is already active for this project",
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleTask(task: TranslationTask) {
  logWorker("task_picked_up", taskDetails(task));
  const lockState = await acquireActiveRun(task.projectId, task.runId);
  if (lockState === "rejected") {
    await emitLockFailure(task);
    return;
  }

  try {
    logWorker(
      lockState === "resumed" ? "lock_resumed" : "lock_acquired",
      taskDetails(task),
    );
    await clearRunCancelled(task.runId);
    logWorker("task_processing", taskDetails(task));
    await runWorkerTask(task);
    logWorker("task_completed", taskDetails(task));
  } finally {
    logWorker("lock_releasing", taskDetails(task));
    await releaseActiveRun(task.projectId, task.runId).catch(() => undefined);
  }
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logWorker("shutdown_started", `signal=${signal}`);
  await closeAmqpConnection();
  logWorker("shutdown_completed", `signal=${signal}`);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

consumeTasks(handleTask)
  .then(() => {
    logWorker("listening", "queue=translation-tasks");
  })
  .catch((error) => {
    console.error("[worker] failed to start", error);
    process.exit(1);
  });
