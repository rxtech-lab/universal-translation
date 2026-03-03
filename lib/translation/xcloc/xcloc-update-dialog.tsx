"use client";

import { FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useExtracted } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TranslationProject, UploadPayload } from "../types";
import { DefaultUploadProcessor } from "../upload-processor";
import { parseContentsJson } from "./contents-json";
import { parseXliff } from "./xliff-parser";

interface XclocUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProject: TranslationProject;
  onConfirm: (payload: UploadPayload) => void;
}

interface DiffStats {
  added: number;
  removed: number;
  preserved: number;
  total: number;
}

function computeDiffStats(
  currentProject: TranslationProject,
  payload: UploadPayload,
): DiffStats | null {
  if (payload.kind !== "archive") return null;

  const files = payload.tree.files.filter(
    (f) => !f.path.includes("__MACOSX"),
  );

  const contentsFile = files.find((f) => f.path.endsWith("contents.json"));
  if (!contentsFile) return null;

  const contentsResult = parseContentsJson(contentsFile.content);
  if (contentsResult.hasError) return null;

  const xliffFile = files.find(
    (f) =>
      f.path.includes("Localized Contents/") && f.path.endsWith(".xliff"),
  );
  if (!xliffFile) return null;

  const xliffXml = new TextDecoder().decode(xliffFile.content);
  const newXliffDoc = parseXliff(xliffXml);

  // Build set of old keys
  const oldKeys = new Set<string>();
  for (const resource of currentProject.resources) {
    for (const entry of resource.entries) {
      oldKeys.add(`${resource.id}\x00${entry.id}`);
    }
  }

  // Build set of new keys
  const newKeys = new Set<string>();
  for (const file of newXliffDoc.files) {
    for (const tu of file.transUnits) {
      newKeys.add(`${file.original}\x00${tu.id}`);
    }
  }

  const preserved = [...newKeys].filter((k) => oldKeys.has(k)).length;
  const added = [...newKeys].filter((k) => !oldKeys.has(k)).length;
  const removed = [...oldKeys].filter((k) => !newKeys.has(k)).length;

  return { added, removed, preserved, total: newKeys.size };
}

export function XclocUpdateDialog({
  open,
  onOpenChange,
  currentProject,
  onConfirm,
}: XclocUpdateDialogProps) {
  const t = useExtracted();
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<UploadPayload | null>(null);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPayload(null);
    setDiffStats(null);
    setParseError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const readAndPreview = useCallback(
    async (selectedFile: File) => {
      setLoading(true);
      setParseError(null);
      try {
        const processor = new DefaultUploadProcessor();
        const result = await processor.process(selectedFile);
        if (result.hasError) {
          setParseError(result.errorMessage);
          setPayload(null);
          setDiffStats(null);
          return;
        }

        if (result.data.kind !== "archive") {
          setParseError(
            t("The selected file is not a valid xcloc archive."),
          );
          setPayload(null);
          setDiffStats(null);
          return;
        }

        const stats = computeDiffStats(currentProject, result.data);
        if (!stats) {
          setParseError(
            t("Could not parse the xcloc bundle. Ensure it contains a valid contents.json and XLIFF file."),
          );
          setPayload(null);
          setDiffStats(null);
          return;
        }

        setPayload(result.data);
        setDiffStats(stats);
      } catch {
        setParseError(t("Failed to read the file."));
      } finally {
        setLoading(false);
      }
    },
    [currentProject, t],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        readAndPreview(selected);
      }
    },
    [readAndPreview],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) {
        setFile(dropped);
        readAndPreview(dropped);
      }
    },
    [readAndPreview],
  );

  const canConfirm = payload !== null && !parseError;

  const handleConfirm = useCallback(() => {
    if (!payload) return;
    onConfirm(payload);
  }, [payload, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Update Xcode Localization")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              "Upload a new version of your xcloc file. Existing translations will be preserved for matching entries. New entries will be added with empty translations, and stale entries will be removed.",
            )}
          </p>

          {/* Drop zone */}
          <div>
            <p className="text-xs font-medium mb-1.5 text-foreground">
              {t("New xcloc file")}
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                file && !parseError
                  ? "border-primary bg-primary/5"
                  : parseError
                    ? "border-destructive bg-destructive/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              data-testid="xcloc-update-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.xcloc"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="xcloc-update-file-input"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("Reading...")}
                  </p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText
                    className={`h-6 w-6 ${parseError ? "text-destructive" : "text-primary"}`}
                  />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Click to change file")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t("Drop updated .xcloc file here or click to browse")}
                  </p>
                </div>
              )}
            </div>
            {parseError && (
              <p className="text-xs text-destructive mt-1">{parseError}</p>
            )}
          </div>

          {/* Diff preview */}
          {diffStats && !parseError && (
            <div
              className="rounded-md border p-3 space-y-2"
              data-testid="xcloc-update-diff-preview"
            >
              <p className="text-xs font-medium">{t("Preview")}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" data-testid="xcloc-update-stat-preserved">
                  {t("{count} preserved", {
                    count: String(diffStats.preserved),
                  })}
                </Badge>
                <Badge variant="secondary" data-testid="xcloc-update-stat-added">
                  {t("{count} new", { count: String(diffStats.added) })}
                </Badge>
                <Badge variant="outline" data-testid="xcloc-update-stat-removed">
                  {t("{count} removed", {
                    count: String(diffStats.removed),
                  })}
                </Badge>
                <Badge variant="outline" data-testid="xcloc-update-stat-total">
                  {t("{count} total", { count: String(diffStats.total) })}
                </Badge>
              </div>
              {diffStats.preserved === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("Warning: no existing translations will be preserved.")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!canConfirm}
            onClick={handleConfirm}
            data-testid="xcloc-update-confirm"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t("Update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
