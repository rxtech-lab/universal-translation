import type { RunEventEnvelope, TranslationTask } from "./types";

function now() {
  return new Date().toISOString();
}

function base(task: TranslationTask) {
  return `type=${task.type} runId=${task.runId} projectId=${task.projectId} userId=${task.userId}`;
}

export function logQueue(message: string, details?: string) {
  console.log(`[queue] ${now()} ${message}${details ? ` ${details}` : ""}`);
}

export function logWorker(message: string, details?: string) {
  console.log(`[worker] ${now()} ${message}${details ? ` ${details}` : ""}`);
}

export function taskDetails(task: TranslationTask) {
  return `${base(task)}${
    task.type === "translate"
      ? ` entries=${task.payload.entries.length}`
      : ` messages=${task.payload.messages.length}`
  }`;
}

export function eventDetails(event: RunEventEnvelope) {
  if (event.kind === "translation-event") {
    const payload = event.payload;
    let extra = "";

    if ("current" in payload && typeof payload.current === "number") {
      const total =
        "total" in payload && typeof payload.total === "number"
          ? payload.total
          : "?";
      extra = ` progress=${payload.current}/${total}`;
    } else if (
      payload.type === "translate-start" &&
      typeof payload.total === "number"
    ) {
      extra = ` total=${payload.total}`;
    } else if (
      payload.type === "batch-complete" &&
      typeof payload.batchIndex === "number"
    ) {
      extra = ` batch=${payload.batchIndex + 1}/${payload.totalBatches}`;
    }

    return `runId=${event.runId} projectId=${event.projectId} seq=${event.seq} kind=${event.kind} type=${payload.type}${extra}`;
  }

  return `runId=${event.runId} projectId=${event.projectId} seq=${event.seq} kind=${event.kind} type=${event.payload.type}`;
}
