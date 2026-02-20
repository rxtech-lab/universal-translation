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
import { parsePo, type PoDocument } from "./parser";

interface PoUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hashBasedMsgids: boolean;
  currentDocument: PoDocument;
  onConfirm: (newPoText: string, referencePoText?: string) => void;
}

interface DiffStats {
  added: number;
  removed: number;
  preserved: number;
  total: number;
}

function computeDiffStats(
  currentDoc: PoDocument,
  newDoc: PoDocument,
): DiffStats {
  const oldKeys = new Set<string>();
  for (const entry of currentDoc.entries) {
    const key = entry.msgctxt
      ? `${entry.msgctxt}\x04${entry.msgid}`
      : entry.msgid;
    oldKeys.add(key);
  }

  const newKeys = new Set<string>();
  for (const entry of newDoc.entries) {
    const key = entry.msgctxt
      ? `${entry.msgctxt}\x04${entry.msgid}`
      : entry.msgid;
    newKeys.add(key);
  }

  const added = [...newKeys].filter((k) => !oldKeys.has(k)).length;
  const removed = [...oldKeys].filter((k) => !newKeys.has(k)).length;
  // preserved = keys in both old and new
  const preserved = [...newKeys].filter((k) => oldKeys.has(k)).length;
  const total = newKeys.size;

  return { added, removed, preserved, total };
}

export function PoUpdateDialog({
  open,
  onOpenChange,
  hashBasedMsgids,
  currentDocument,
  onConfirm,
}: PoUpdateDialogProps) {
  const t = useExtracted();
  const [newPoFile, setNewPoFile] = useState<File | null>(null);
  const [newPoText, setNewPoText] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePoText, setReferencePoText] = useState<string | null>(null);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const newPoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setNewPoFile(null);
    setNewPoText(null);
    setReferenceFile(null);
    setReferencePoText(null);
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
    async (file: File) => {
      setLoading(true);
      setParseError(null);
      try {
        const text = await file.text();
        const parsed = parsePo(text);
        if (parsed.entries.length === 0) {
          setParseError(
            t("No translatable entries found in the selected file."),
          );
          setNewPoText(null);
          setDiffStats(null);
          return;
        }
        setNewPoText(text);
        setDiffStats(computeDiffStats(currentDocument, parsed));
      } catch {
        setParseError(t("Failed to read the file."));
      } finally {
        setLoading(false);
      }
    },
    [currentDocument, t],
  );

  const handleNewPoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setNewPoFile(file);
        readAndPreview(file);
      }
    },
    [readAndPreview],
  );

  const handleNewPoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        setNewPoFile(file);
        readAndPreview(file);
      }
    },
    [readAndPreview],
  );

  const handleReferenceSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setReferenceFile(file);
        const text = await file.text();
        setReferencePoText(text);
      }
    },
    [],
  );

  const handleReferenceDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setReferenceFile(file);
      const text = await file.text();
      setReferencePoText(text);
    }
  }, []);

  const canConfirm =
    newPoText !== null &&
    !parseError &&
    (!hashBasedMsgids || referencePoText !== null);

  const handleConfirm = useCallback(() => {
    if (!newPoText) return;
    onConfirm(newPoText, referencePoText ?? undefined);
  }, [newPoText, referencePoText, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Update PO File")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              "Upload a new version of your PO file. Existing translations will be preserved for matching entries. New entries will be added with empty translations, and stale entries will be removed.",
            )}
          </p>

          {/* New PO file drop zone */}
          <div>
            <p className="text-xs font-medium mb-1.5 text-foreground">
              {t("New PO file")}
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleNewPoDrop}
              className={`border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                newPoFile && !parseError
                  ? "border-primary bg-primary/5"
                  : parseError
                    ? "border-destructive bg-destructive/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onClick={() => newPoInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  newPoInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                ref={newPoInputRef}
                type="file"
                accept=".po"
                onChange={handleNewPoSelect}
                className="hidden"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("Reading...")}
                  </p>
                </div>
              ) : newPoFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText
                    className={`h-6 w-6 ${parseError ? "text-destructive" : "text-primary"}`}
                  />
                  <p className="text-sm font-medium">{newPoFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("Click to change file")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t("Drop updated .po file here or click to browse")}
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
              data-testid="po-update-diff-preview"
            >
              <p className="text-xs font-medium">{t("Preview")}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" data-testid="po-update-stat-preserved">
                  {t("{count} preserved", {
                    count: String(diffStats.preserved),
                  })}
                </Badge>
                <Badge variant="secondary" data-testid="po-update-stat-added">
                  {t("{count} new", { count: String(diffStats.added) })}
                </Badge>
                <Badge variant="outline" data-testid="po-update-stat-removed">
                  {t("{count} removed", {
                    count: String(diffStats.removed),
                  })}
                </Badge>
                <Badge variant="outline" data-testid="po-update-stat-total">
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

          {/* Reference file drop zone (hash-based msgids only) */}
          {hashBasedMsgids && (
            <div>
              <p className="text-xs font-medium mb-1.5 text-foreground">
                {t("Reference PO file (required for hash-based IDs)")}
              </p>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleReferenceDrop}
                className={`border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                  referenceFile
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onClick={() => refInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    refInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={refInputRef}
                  type="file"
                  accept=".po"
                  onChange={handleReferenceSelect}
                  className="hidden"
                />
                {referenceFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <p className="text-sm font-medium">{referenceFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Click to change file")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {t("Drop reference .po file here or click to browse")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("Usually en.po or the source language file")}
                    </p>
                  </div>
                )}
              </div>
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
            data-testid="po-update-confirm"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t("Update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
