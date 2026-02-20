"use client";

import { FileText, Music } from "lucide-react";
import { useState } from "react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type TranslationMode = "universal" | "lyrics";

interface ModeSelectorProps {
  fileName: string;
  onConfirm: (mode: TranslationMode) => void;
  onCancel: () => void;
}

export function ModeSelector({
  fileName,
  onConfirm,
  onCancel,
}: ModeSelectorProps) {
  const t = useExtracted();
  const [mode, setMode] = useState<TranslationMode>("universal");

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>{t("Translation Mode")}</CardTitle>
        <CardDescription>
          {t("Choose how to translate {fileName}", { fileName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`p-4 border text-left transition-colors ${
              mode === "universal"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onClick={() => setMode("universal")}
            data-testid="mode-universal"
          >
            <FileText className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="font-medium text-sm">{t("Universal")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("Standard document translation")}
            </div>
          </button>
          <button
            type="button"
            className={`p-4 border text-left transition-colors ${
              mode === "lyrics"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onClick={() => setMode("lyrics")}
            data-testid="mode-lyrics"
          >
            <Music className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="font-medium text-sm">{t("Lyrics")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("Rhythm & rhyme preserving")}
            </div>
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(mode)}
            data-testid="mode-continue"
          >
            {t("Continue")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
