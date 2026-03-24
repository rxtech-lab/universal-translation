export interface TranslationRunState {
  runId: string;
  status: "queued" | "translating";
  current: number;
  total: number;
  updatedAt: string;
}

export interface ProjectMetadata {
  translationRun?: TranslationRunState | null;
  [key: string]: unknown;
}

export function asProjectMetadata(metadata: unknown): ProjectMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as ProjectMetadata;
}

export function getTranslationRun(metadata: unknown): TranslationRunState | null {
  const value = asProjectMetadata(metadata).translationRun;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const {
    runId,
    status,
    current,
    total,
    updatedAt,
  } = value as unknown as Record<string, unknown>;

  if (
    typeof runId !== "string" ||
    (status !== "queued" && status !== "translating") ||
    typeof current !== "number" ||
    typeof total !== "number" ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }

  return {
    runId,
    status,
    current,
    total,
    updatedAt,
  };
}

export function withTranslationRun(
  metadata: unknown,
  translationRun: TranslationRunState | null,
) {
  const next = { ...asProjectMetadata(metadata) };

  if (translationRun) {
    next.translationRun = translationRun;
  } else {
    delete next.translationRun;
  }

  return next;
}
