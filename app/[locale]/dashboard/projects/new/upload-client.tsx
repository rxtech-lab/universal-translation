"use client";

import { upload } from "@vercel/blob/client";
import { FileArchive, FileText, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useExtracted } from "next-intl";
import { createProjectFromParsed } from "@/app/actions/upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import type { TranslationClient } from "@/lib/translation/client";
import { LyricsClient } from "@/lib/translation/lyrics/client";
import type { PoClient } from "@/lib/translation/po/client";
import { PoLanguageSelector } from "@/lib/translation/po/language-selector";
import { PoReferenceUpload } from "@/lib/translation/po/reference-upload";
import { createDefaultRegistry } from "@/lib/translation/registry-impl";
import { SrtLanguageSelector } from "@/lib/translation/srt/language-selector";
import type { TranslationProject } from "@/lib/translation/types";
import { DefaultUploadProcessor } from "@/lib/translation/upload-processor";
import { ModeSelector, type TranslationMode } from "./mode-selector";

type UploadState =
  | { step: "idle" }
  | { step: "uploading"; progress: number }
  | { step: "parsing" }
  | {
      step: "mode-select";
      client: TranslationClient;
      formatId: string;
      formatData: Record<string, unknown>;
      blobUrl: string;
      fileName: string;
      fileContent: string;
    }
  | {
      step: "reference-upload";
      client: TranslationClient;
      formatId: string;
      formatData: Record<string, unknown>;
      blobUrl: string;
      fileName: string;
    }
  | {
      step: "language-select";
      client: TranslationClient;
      formatId: string;
      formatData: Record<string, unknown>;
      blobUrl: string;
      fileName: string;
    }
  | { step: "creating" }
  | { step: "error"; message: string };

export function UploadClient() {
  const t = useExtracted();
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      try {
        // Step 1: Upload to Vercel Blob (skip in e2e mode)
        setState({ step: "uploading", progress: 0 });
        let blobUrl: string;
        if (process.env.NEXT_PUBLIC_IS_E2E) {
          blobUrl = `e2e://local/${file.name}`;
        } else {
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
          });
          blobUrl = blob.url;
        }

        // Step 2: Parse locally
        setState({ step: "parsing" });
        const processor = new DefaultUploadProcessor();
        const payloadResult = await processor.process(file);
        if (payloadResult.hasError) {
          setState({
            step: "error",
            message: payloadResult.errorMessage,
          });
          return;
        }

        const registry = await createDefaultRegistry();
        const resolved = await registry.resolve(payloadResult.data);
        if (!resolved) {
          setState({
            step: "error",
            message:
              "Unsupported file format. Supported: .xcloc (as .zip), .srt, .po, .txt, .md, .docx, .html",
          });
          return;
        }

        const loadResult = await resolved.client.load(payloadResult.data);
        if (loadResult.hasError) {
          setState({
            step: "error",
            message: loadResult.errorMessage,
          });
          return;
        }

        const formatId = resolved.match.descriptor.formatId;

        // Get format-specific data for DB storage
        let formatData: Record<string, unknown> = {};
        if (
          "getFormatData" in resolved.client &&
          typeof resolved.client.getFormatData === "function"
        ) {
          formatData = resolved.client.getFormatData() as unknown as Record<
            string,
            unknown
          >;
        }

        // For txt/md document files, show mode selector first (universal vs lyrics)
        if (formatId === "document") {
          const name = file.name.toLowerCase();
          const isTxtOrMd =
            name.endsWith(".txt") ||
            name.endsWith(".md") ||
            name.endsWith(".markdown");

          if (isTxtOrMd) {
            const fileContent = await file.text();
            setState({
              step: "mode-select",
              client: resolved.client,
              formatId,
              formatData,
              blobUrl,
              fileName: file.name,
              fileContent,
            });
            return;
          }
        }

        // For PO files, check if msgids are hash-based and need a reference file
        if (formatId === "po") {
          const poClient = resolved.client as PoClient;
          if (poClient.hasHashMsgids()) {
            setState({
              step: "reference-upload",
              client: resolved.client,
              formatId,
              formatData,
              blobUrl,
              fileName: file.name,
            });
            return;
          }
        }

        // Single-file formats need language selection before project creation
        if (
          formatId === "srt" ||
          formatId === "po" ||
          formatId === "document" ||
          formatId === "html"
        ) {
          setState({
            step: "language-select",
            client: resolved.client,
            formatId,
            formatData,
            blobUrl,
            fileName: file.name,
          });
          return;
        }

        // For other formats (xcloc), create project immediately
        const project = resolved.client.getProject();
        const sourceLanguage = resolved.client.getSourceLanguage() ?? undefined;
        const targetLanguages = resolved.client.getTargetLanguages();

        setState({ step: "creating" });
        const projectId = await createProjectFromParsed({
          name: file.name.replace(/\.zip$/, ""),
          formatId,
          blobUrl,
          content: project,
          formatData,
          sourceLanguage,
          targetLanguage: targetLanguages[0],
          sourceLocale: sourceLanguage,
          targetLocale: targetLanguages[0],
        });

        router.push(`/dashboard/projects/${projectId}`);
      } catch (err) {
        setState({
          step: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [router],
  );

  const handleLanguageConfirm = useCallback(
    async (sourceLanguage: string, targetLanguage: string) => {
      if (state.step !== "language-select") return;

      try {
        const { client, formatId, blobUrl, fileName } = state;

        // Set languages on the client
        if (
          "setLanguages" in client &&
          typeof client.setLanguages === "function"
        ) {
          (
            client as { setLanguages: (s: string, t: string) => void }
          ).setLanguages(sourceLanguage, targetLanguage);
        }

        // Re-get format data after setting languages
        let formatData: Record<string, unknown> = {};
        if (
          "getFormatData" in client &&
          typeof client.getFormatData === "function"
        ) {
          formatData = (
            client as { getFormatData: () => unknown }
          ).getFormatData() as Record<string, unknown>;
        }

        const project = client.getProject();

        setState({ step: "creating" });
        const projectId = await createProjectFromParsed({
          name: fileName.replace(
            /\.(srt|po|txt|md|markdown|docx|html|htm)$/i,
            "",
          ),
          formatId,
          blobUrl,
          content: project as TranslationProject,
          formatData,
          sourceLanguage,
          targetLanguage,
          sourceLocale: sourceLanguage,
          targetLocale: targetLanguage,
        });

        router.push(`/dashboard/projects/${projectId}`);
      } catch (err) {
        setState({
          step: "error",
          message:
            err instanceof Error ? err.message : "Failed to create project",
        });
      }
    },
    [state, router],
  );

  const handleModeConfirm = useCallback(
    (mode: TranslationMode) => {
      if (state.step !== "mode-select") return;

      if (mode === "lyrics") {
        const lyricsClient = new LyricsClient();
        lyricsClient.loadFromText(state.fileContent, state.fileName);

        let formatData: Record<string, unknown> = {};
        if (
          "getFormatData" in lyricsClient &&
          typeof lyricsClient.getFormatData === "function"
        ) {
          formatData = lyricsClient.getFormatData() as unknown as Record<
            string,
            unknown
          >;
        }

        setState({
          step: "language-select",
          client: lyricsClient,
          formatId: "lyrics",
          formatData,
          blobUrl: state.blobUrl,
          fileName: state.fileName,
        });
      } else {
        // Universal mode — proceed with existing document client
        setState({
          step: "language-select",
          client: state.client,
          formatId: state.formatId,
          formatData: state.formatData,
          blobUrl: state.blobUrl,
          fileName: state.fileName,
        });
      }
    },
    [state],
  );

  const handleReferenceConfirm = useCallback(
    (referencePoText: string) => {
      if (state.step !== "reference-upload") return;

      const poClient = state.client as unknown as PoClient;
      const result = poClient.applyReferenceDocument(referencePoText);

      if (result.hasError) {
        setState({
          step: "error",
          message: result.errorMessage,
        });
        return;
      }

      // Re-get format data after applying reference
      let formatData: Record<string, unknown> = {};
      if (
        "getFormatData" in state.client &&
        typeof state.client.getFormatData === "function"
      ) {
        formatData = (
          state.client as { getFormatData: () => unknown }
        ).getFormatData() as Record<string, unknown>;
      }

      setState({
        step: "language-select",
        client: state.client,
        formatId: state.formatId,
        formatData,
        blobUrl: state.blobUrl,
        fileName: state.fileName,
      });
    },
    [state],
  );

  const handleReferenceSkip = useCallback(() => {
    if (state.step !== "reference-upload") return;

    setState({
      step: "language-select",
      client: state.client,
      formatId: state.formatId,
      formatData: state.formatData,
      blobUrl: state.blobUrl,
      fileName: state.fileName,
    });
  }, [state]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // Show mode selector for txt/md files
  if (state.step === "mode-select") {
    return (
      <ModeSelector
        fileName={state.fileName}
        onConfirm={handleModeConfirm}
        onCancel={() => setState({ step: "idle" })}
      />
    );
  }

  // Show reference file upload for PO files with hash-based msgids
  if (state.step === "reference-upload") {
    return (
      <PoReferenceUpload
        fileName={state.fileName}
        onConfirm={handleReferenceConfirm}
        onSkip={handleReferenceSkip}
        onCancel={() => setState({ step: "idle" })}
      />
    );
  }

  // Show language selector for single-file formats
  if (state.step === "language-select") {
    const LangSelector =
      state.formatId === "po" ? PoLanguageSelector : SrtLanguageSelector;
    return (
      <LangSelector
        fileName={state.fileName}
        onConfirm={handleLanguageConfirm}
        onCancel={() => setState({ step: "idle" })}
      />
    );
  }

  const isProcessing = state.step !== "idle" && state.step !== "error";

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>{t("New Translation Project")}</CardTitle>
        <CardDescription>
          {t("Upload a translation file to get started")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          } ${isProcessing ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
          onClick={() => !isProcessing && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isProcessing) inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          data-testid="upload-dropzone"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xcloc,.srt,.po,.txt,.md,.markdown,.docx,.html,.htm"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="upload-file-input"
          />

          {state.step === "idle" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {t("Drop your file here or click to browse")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    "Supports .xcloc (as .zip), .srt, .po, .txt, .md, .docx, and .html",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline">
                  <FileArchive className="h-3 w-3 mr-1" />
                  .xcloc
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  .srt
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  .po
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  .txt
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  .md
                </Badge>
                <Badge variant="outline">
                  <FileArchive className="h-3 w-3 mr-1" />
                  .docx
                </Badge>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  .html
                </Badge>
              </div>
            </div>
          )}

          {state.step === "uploading" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">{t("Uploading...")}</p>
            </div>
          )}

          {state.step === "parsing" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">
                {t("Parsing translation file...")}
              </p>
            </div>
          )}

          {state.step === "creating" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">{t("Creating project...")}</p>
            </div>
          )}

          {state.step === "error" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <p
                className="text-sm font-medium text-destructive"
                data-testid="upload-error"
              >
                {state.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setState({ step: "idle" });
                }}
              >
                {t("Try again")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
