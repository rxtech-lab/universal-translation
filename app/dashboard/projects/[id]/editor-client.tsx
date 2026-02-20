"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { renameProject, updateProjectContent } from "@/app/actions/projects";
import { saveProjectTerms } from "@/app/actions/terms";
import { TranslationEditor } from "@/lib/translation/components/translation-editor";
import { useAutoSave } from "@/lib/translation/components/use-auto-save";
import { useTranslationProject } from "@/lib/translation/components/use-translation-project";
import {
  type LyricsAnalysis,
  useTranslationStream,
} from "@/lib/translation/components/use-translation-stream";
import {
  DocumentClient,
  type DocumentFormatData,
} from "@/lib/translation/document/client";
import { DocumentEditor } from "@/lib/translation/document/document-editor";
import { HtmlClient, type HtmlFormatData } from "@/lib/translation/html/client";
import { HtmlEditor } from "@/lib/translation/html/html-editor";
import {
  LyricsClient,
  type LyricsFormatData,
} from "@/lib/translation/lyrics/client";
import { LyricsEditor } from "@/lib/translation/lyrics/lyrics-editor";
import { PoClient, type PoFormatData } from "@/lib/translation/po/client";
import { PoEditor } from "@/lib/translation/po/po-editor";
import { SrtClient, type SrtFormatData } from "@/lib/translation/srt/client";
import { SrtEditor } from "@/lib/translation/srt/srt-editor";
import type { Term } from "@/lib/translation/tools/term-tools";
import type { TranslationProject } from "@/lib/translation/types";
import {
  XclocClient,
  type XclocFormatData,
} from "@/lib/translation/xcloc/client";
import { XclocEditor } from "@/lib/translation/xcloc/xcloc-editor";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  lookupPrevLines: "Looking up previous entries",
  lookupNextLines: "Looking up next entries",
  searchEntries: "Searching entries",
  lookupTerm: "Looking up term",
};

interface EditorClientProps {
  project: {
    id: string;
    name: string;
    formatId: string;
    sourceLanguage: string | null;
    targetLanguage: string | null;
    blobUrl: string | null;
    content: unknown;
    formatData: unknown;
  };
  initialTerms?: Term[];
}

export function EditorClient({
  project: dbProject,
  initialTerms,
}: EditorClientProps) {
  const [client] = useState(() => {
    if (dbProject.formatId === "lyrics") {
      const c = new LyricsClient();
      if (dbProject.content && dbProject.formatData) {
        c.loadFromJson(
          dbProject.content as TranslationProject,
          dbProject.formatData as unknown as LyricsFormatData,
          {
            blobUrl: dbProject.blobUrl ?? undefined,
            projectId: dbProject.id,
          },
        );
      }
      return c;
    }
    if (dbProject.formatId === "document") {
      const c = new DocumentClient();
      if (dbProject.content && dbProject.formatData) {
        c.loadFromJson(
          dbProject.content as TranslationProject,
          dbProject.formatData as unknown as DocumentFormatData,
          {
            blobUrl: dbProject.blobUrl ?? undefined,
            projectId: dbProject.id,
          },
        );
      }
      return c;
    }
    if (dbProject.formatId === "po") {
      const c = new PoClient();
      if (dbProject.content && dbProject.formatData) {
        c.loadFromJson(
          dbProject.content as TranslationProject,
          dbProject.formatData as unknown as PoFormatData,
          {
            blobUrl: dbProject.blobUrl ?? undefined,
            projectId: dbProject.id,
          },
        );
      }
      return c;
    }
    if (dbProject.formatId === "srt") {
      const c = new SrtClient();
      if (dbProject.content && dbProject.formatData) {
        c.loadFromJson(
          dbProject.content as TranslationProject,
          dbProject.formatData as unknown as SrtFormatData,
          {
            blobUrl: dbProject.blobUrl ?? undefined,
            projectId: dbProject.id,
          },
        );
      }
      return c;
    }
    if (dbProject.formatId === "html") {
      const c = new HtmlClient();
      if (dbProject.content && dbProject.formatData) {
        c.loadFromJson(
          dbProject.content as TranslationProject,
          dbProject.formatData as unknown as HtmlFormatData,
          {
            projectId: dbProject.id,
          },
        );
      }
      return c;
    }
    const c = new XclocClient();
    if (dbProject.content && dbProject.formatData) {
      c.loadFromJson(
        dbProject.content as TranslationProject,
        dbProject.formatData as unknown as XclocFormatData,
        {
          blobUrl: dbProject.blobUrl ?? undefined,
          projectId: dbProject.id,
        },
      );
    }
    return c;
  });

  const [projectName, setProjectName] = useState(dbProject.name);

  const { project, updateEntry, applyStreamUpdate, refreshFromClient } =
    useTranslationProject(client);

  const {
    status,
    setStatus,
    errors,
    clearErrors,
    terms,
    setTerms,
    streamingEntryIds,
    lyricsAnalysis,
    clearLyricsAnalysis,
    clearEntryAnalysis,
    startStream,
    cancelStream,
    markUserEdited,
  } = useTranslationStream(initialTerms);

  // Build initial lyrics analysis from persisted entry metadata, then overlay
  // any live stream data on top (stream data takes priority during translation).
  const mergedLyricsAnalysis = useMemo(() => {
    if (dbProject.formatId !== "lyrics") return lyricsAnalysis;

    const merged = new Map<string, LyricsAnalysis>();

    // Seed from project entry metadata (persisted in DB)
    for (const resource of project.resources) {
      for (const entry of resource.entries) {
        const m = entry.metadata as Record<string, unknown> | undefined;
        if (m && (m.syllableCount != null || m.rhymeWords)) {
          merged.set(entry.id, {
            syllableCount: m.syllableCount as number | undefined,
            stressPattern: m.stressPattern as string | undefined,
            rhymeWords: m.rhymeWords as string[] | undefined,
            relatedLineIds: m.relatedLineIds as string[] | undefined,
            relatedRhymeWords: m.relatedRhymeWords as
              | Record<string, string[]>
              | undefined,
            reviewPassed: m.reviewPassed as boolean | undefined,
            reviewFeedback: m.reviewFeedback as string | undefined,
          });
        }
      }
    }

    // Overlay live stream data
    for (const [id, analysis] of lyricsAnalysis) {
      merged.set(id, { ...merged.get(id), ...analysis });
    }

    return merged;
  }, [dbProject.formatId, project.resources, lyricsAnalysis]);

  const TOAST_ID = "translation-agent";

  const dismissTranslationToast = useCallback(() => {
    toast.dismiss(TOAST_ID);
  }, []);

  const handleAgentTextDelta = useCallback(
    (_batchIndex: number, text: string) => {
      toast.loading("Translating...", {
        id: TOAST_ID,
        description: text,
        duration: Infinity,
        classNames: { description: "!text-foreground" },
      });
    },
    [],
  );

  const handleAgentToolCall = useCallback(
    (
      _batchIndex: number,
      _toolCallId: string,
      toolName: string,
      args: Record<string, unknown>,
    ) => {
      const title = TOOL_DISPLAY_NAMES[toolName] ?? toolName;
      const desc = "query" in args ? `${title}: "${args.query}"` : title;
      toast.loading("Translating...", {
        id: TOAST_ID,
        description: desc,
        duration: Infinity,
        classNames: { description: "!text-foreground" },
      });
    },
    [],
  );

  const handleAgentToolResult = useCallback(
    (_batchIndex: number, _toolCallId: string, _toolName: string) => {
      // No-op: the next text delta will update the toast
    },
    [],
  );

  const { markDirty } = useAutoSave({
    onSave: async () => {
      setStatus((prev) =>
        prev.state === "translating" ? prev : { state: "saving" },
      );
      await updateProjectContent(dbProject.id, client.getProject());
      setStatus((prev) =>
        prev.state === "translating"
          ? prev
          : { state: "saved", at: new Date() },
      );
    },
    debounceMs: 5000,
  });

  const handleEntryUpdate = useCallback(
    (
      resourceId: string,
      entryId: string,
      update: { targetText?: string; comment?: string },
    ) => {
      updateEntry(resourceId, entryId, update);
      markUserEdited(resourceId, entryId);
      // When clearing translation, also clear analysis metadata
      if (update.targetText === "") {
        clearEntryAnalysis(entryId);
        const resource = client
          .getProject()
          .resources.find((r) => r.id === resourceId);
        const entry = resource?.entries.find((e) => e.id === entryId);
        if (entry?.metadata) {
          const m = entry.metadata as Record<string, unknown>;
          delete m.syllableCount;
          delete m.stressPattern;
          delete m.rhymeWords;
          delete m.relatedLineIds;
          delete m.reviewPassed;
          delete m.reviewFeedback;
        }
      }
      markDirty();
    },
    [updateEntry, markUserEdited, clearEntryAnalysis, client, markDirty],
  );

  const handleTranslationUpdated = useCallback(
    (resourceId: string, entryId: string, targetText: string) => {
      client.updateEntry(resourceId, entryId, { targetText });
      applyStreamUpdate(resourceId, entryId, { targetText });
      markDirty();
    },
    [client, applyStreamUpdate, markDirty],
  );

  const handleTranslate = useCallback(async () => {
    const flatEntries = project.resources.flatMap((r) =>
      r.entries
        .filter((e) => !e.targetText.trim())
        .map((e) => ({ ...e, resourceId: r.id })),
    );

    if (flatEntries.length === 0) return;

    toast.loading("Translating...", {
      id: TOAST_ID,
      description: "Starting translation...",
      duration: Infinity,
      classNames: { description: "!text-foreground" },
    });

    try {
      await startStream({
        projectId: dbProject.id,
        entries: flatEntries,
        sourceLanguage:
          project.sourceLanguage ?? dbProject.sourceLanguage ?? "en",
        targetLanguage:
          project.targetLanguages?.[0] ?? dbProject.targetLanguage ?? "zh-Hans",
        onEntryTranslated: (resourceId, entryId, targetText) => {
          applyStreamUpdate(resourceId, entryId, { targetText });
          client.updateEntry(resourceId, entryId, { targetText });
        },
        onTermsFound: (foundTerms) => {
          setTerms(foundTerms);
          saveProjectTerms(dbProject.id, foundTerms);
        },
        onComplete: () => {
          refreshFromClient();
          dismissTranslationToast();
        },
        onAgentTextDelta: handleAgentTextDelta,
        onAgentToolCall: handleAgentToolCall,
        onAgentToolResult: handleAgentToolResult,
      });
    } finally {
      // Always dismiss the toast when stream ends (error, abort, or success)
      dismissTranslationToast();
    }
  }, [
    project,
    dbProject,
    startStream,
    applyStreamUpdate,
    client,
    setTerms,
    refreshFromClient,
    dismissTranslationToast,
    handleAgentTextDelta,
    handleAgentToolCall,
    handleAgentToolResult,
  ]);

  const handleTranslateLine = useCallback(
    async (resourceId: string, entryId: string, suggestion?: string) => {
      const resource = project.resources.find((r) => r.id === resourceId);
      if (!resource) return;
      const entry = resource.entries.find((e) => e.id === entryId);
      if (!entry) return;

      toast.loading("Translating line...", {
        id: TOAST_ID,
        description: `Translating line #${entry.id}...`,
        duration: Infinity,
        classNames: { description: "!text-foreground" },
      });

      try {
        await startStream({
          projectId: dbProject.id,
          entries: [{ ...entry, resourceId }],
          sourceLanguage:
            project.sourceLanguage ?? dbProject.sourceLanguage ?? "en",
          targetLanguage:
            project.targetLanguages?.[0] ??
            dbProject.targetLanguage ??
            "zh-Hans",
          suggestion,
          onEntryTranslated: (resId, eId, targetText) => {
            applyStreamUpdate(resId, eId, { targetText });
            client.updateEntry(resId, eId, { targetText });
          },
          onComplete: () => {
            refreshFromClient();
            dismissTranslationToast();
          },
          onAgentTextDelta: handleAgentTextDelta,
          onAgentToolCall: handleAgentToolCall,
          onAgentToolResult: handleAgentToolResult,
        });
      } finally {
        dismissTranslationToast();
      }
    },
    [
      project,
      dbProject,
      startStream,
      applyStreamUpdate,
      client,
      refreshFromClient,
      dismissTranslationToast,
      handleAgentTextDelta,
      handleAgentToolCall,
      handleAgentToolResult,
    ],
  );

  const handleStopTranslation = useCallback(() => {
    cancelStream();
    toast.info("Translation stopped", { id: TOAST_ID, duration: 2000 });
  }, [cancelStream]);

  const handleClearAllTranslations = useCallback(() => {
    const proj = client.getProject();
    const promise = new Promise<void>((resolve) => {
      for (const resource of proj.resources) {
        for (const entry of resource.entries) {
          if (entry.targetText.trim()) {
            client.updateEntry(resource.id, entry.id, { targetText: "" });
          }
          if (entry.metadata) {
            const m = entry.metadata as Record<string, unknown>;
            delete m.syllableCount;
            delete m.stressPattern;
            delete m.rhymeWords;
            delete m.relatedLineIds;
            delete m.reviewPassed;
            delete m.reviewFeedback;
          }
        }
      }
      clearLyricsAnalysis();
      refreshFromClient();
      markDirty();
      resolve();
    });
    toast.promise(promise, {
      loading: "Clearing translations...",
      success: "All translations cleared",
      error: "Failed to clear translations",
    });
  }, [client, clearLyricsAnalysis, refreshFromClient, markDirty]);

  const handleRename = useCallback(
    async (newName: string) => {
      try {
        await renameProject(dbProject.id, newName);
        setProjectName(newName);
        toast.success("Project renamed");
      } catch {
        toast.error("Failed to rename project");
      }
    },
    [dbProject.id],
  );

  const handleExport = useCallback(async () => {
    const result = await client.exportFile(terms);
    if (!result.hasError && result.data.blob) {
      const url = URL.createObjectURL(result.data.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [client, terms]);

  const handleSave = useCallback(async () => {
    setStatus((prev) =>
      prev.state === "translating" ? prev : { state: "saving" },
    );
    const result = await client.save();
    if (result.hasError) {
      setStatus((prev) =>
        prev.state === "translating"
          ? prev
          : { state: "error", message: result.errorMessage },
      );
    } else {
      setStatus((prev) =>
        prev.state === "translating"
          ? prev
          : { state: "saved", at: new Date() },
      );
    }
  }, [client, setStatus]);

  const formatDisplayName =
    dbProject.formatId === "xcloc"
      ? "Xcode Localization Catalog"
      : dbProject.formatId === "srt"
        ? "SubRip Subtitles"
        : dbProject.formatId === "po"
          ? "Gettext PO"
          : dbProject.formatId === "document"
            ? "Document"
            : dbProject.formatId === "lyrics"
              ? "Lyrics"
              : dbProject.formatId === "html"
                ? "HTML"
                : dbProject.formatId;

  return (
    <TranslationEditor
      projectId={dbProject.id}
      projectName={projectName}
      formatId={dbProject.formatId}
      formatDisplayName={formatDisplayName}
      sourceLanguage={dbProject.sourceLanguage ?? undefined}
      targetLanguage={dbProject.targetLanguage ?? undefined}
      status={status}
      errors={errors}
      onClearErrors={clearErrors}
      onTranslate={handleTranslate}
      onStopTranslation={handleStopTranslation}
      onExport={handleExport}
      onSave={handleSave}
      terms={terms}
      onTermsChange={setTerms}
      onTranslationUpdated={handleTranslationUpdated}
      onClearAllTranslations={handleClearAllTranslations}
      onRename={handleRename}
    >
      {dbProject.formatId === "lyrics" ? (
        <LyricsEditor
          project={project}
          onEntryUpdate={handleEntryUpdate}
          onTranslateLine={handleTranslateLine}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
          lyricsAnalysis={mergedLyricsAnalysis}
        />
      ) : dbProject.formatId === "document" ? (
        <DocumentEditor
          project={project}
          onEntryUpdate={handleEntryUpdate}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
        />
      ) : dbProject.formatId === "po" ? (
        <PoEditor
          project={project}
          onEntryUpdate={handleEntryUpdate}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
        />
      ) : dbProject.formatId === "srt" ? (
        <SrtEditor
          project={project}
          onEntryUpdate={handleEntryUpdate}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
        />
      ) : dbProject.formatId === "html" ? (
        <HtmlEditor
          project={project}
          client={client as HtmlClient}
          onEntryUpdate={handleEntryUpdate}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
        />
      ) : (
        <XclocEditor
          project={project}
          onEntryUpdate={handleEntryUpdate}
          streamingEntryIds={streamingEntryIds}
          terms={terms}
        />
      )}
    </TranslationEditor>
  );
}
