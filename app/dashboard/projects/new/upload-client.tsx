"use client";

import { upload } from "@vercel/blob/client";
import { FileArchive, FileText, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
import type { TranslationClient } from "@/lib/translation/client";
import { createDefaultRegistry } from "@/lib/translation/registry-impl";
import { PoLanguageSelector } from "@/lib/translation/po/language-selector";
import { SrtLanguageSelector } from "@/lib/translation/srt/language-selector";
import type { TranslationProject } from "@/lib/translation/types";
import { DefaultUploadProcessor } from "@/lib/translation/upload-processor";

type UploadState =
  | { step: "idle" }
  | { step: "uploading"; progress: number }
  | { step: "parsing" }
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
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      try {
        // Step 1: Upload to Vercel Blob
        setState({ step: "uploading", progress: 0 });
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

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
              "Unsupported file format. Supported: .xcloc (as .zip), .srt, .po",
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

        // Single-file formats need language selection before project creation
        if (formatId === "srt" || formatId === "po") {
          setState({
            step: "language-select",
            client: resolved.client,
            formatId,
            formatData,
            blobUrl: blob.url,
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
          blobUrl: blob.url,
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
          name: fileName.replace(/\.(srt|po)$/i, ""),
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
        <CardTitle>New Translation Project</CardTitle>
        <CardDescription>
          Upload a translation file to get started
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
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xcloc,.srt,.po"
            onChange={handleFileSelect}
            className="hidden"
          />

          {state.step === "idle" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Drop your file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xcloc bundles (as .zip), .srt subtitles, and .po
                  localization files
                </p>
              </div>
              <div className="flex gap-2">
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
              </div>
            </div>
          )}

          {state.step === "uploading" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Uploading...</p>
            </div>
          )}

          {state.step === "parsing" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Parsing translation file...</p>
            </div>
          )}

          {state.step === "creating" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Creating project...</p>
            </div>
          )}

          {state.step === "error" && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <p className="text-sm font-medium text-destructive">
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
                Try again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
