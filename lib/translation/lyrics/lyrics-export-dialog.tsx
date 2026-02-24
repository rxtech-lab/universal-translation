"use client";

import { FileText, Languages } from "lucide-react";
import { useState } from "react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LyricsExportMode } from "./client";

interface LyricsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: LyricsExportMode) => void;
}

export function LyricsExportDialog({
  open,
  onOpenChange,
  onConfirm,
}: LyricsExportDialogProps) {
  const t = useExtracted();
  const [mode, setMode] = useState<LyricsExportMode>("translation-only");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="lyrics-export-dialog">
        <DialogHeader>
          <DialogTitle>{t("Export Lyrics")}</DialogTitle>
          <DialogDescription>
            {t("Choose how to export your lyrics translation")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`p-4 border text-left transition-colors ${
              mode === "translation-only"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onClick={() => setMode("translation-only")}
            data-testid="export-translation-only"
          >
            <FileText className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="font-medium text-sm">{t("Translation Only")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("Export only the translated text")}
            </div>
          </button>
          <button
            type="button"
            className={`p-4 border text-left transition-colors ${
              mode === "bilingual"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onClick={() => setMode("bilingual")}
            data-testid="export-bilingual"
          >
            <Languages className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="font-medium text-sm">{t("Bilingual")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("Export original text with translation")}
            </div>
          </button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => onConfirm(mode)}
            data-testid="export-confirm"
          >
            {t("Export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
