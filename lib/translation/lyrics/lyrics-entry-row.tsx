"use client";

import { Languages, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import { useExtracted } from "next-intl";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LyricsAnalysis } from "../components/use-translation-stream";
import { TermText } from "../components/term-text";
import type { Term } from "../tools/term-tools";
import type { TranslationEntry } from "../types";

interface LyricsEntryRowProps {
  entry: TranslationEntry;
  resourceId: string;
  onUpdate: (update: { targetText?: string; comment?: string }) => void;
  onTranslateLine: (suggestion?: string) => void;
  isStreaming: boolean;
  terms: Term[];
  analysis?: LyricsAnalysis;
}

/** Render source text with rhyme words highlighted. */
function HighlightedSource({
  text,
  rhymeWords,
}: {
  text: string;
  rhymeWords?: string[];
}) {
  if (!rhymeWords || rhymeWords.length === 0) {
    return <span>{text}</span>;
  }

  // Build a regex that matches any of the rhyme words (case-insensitive, word boundary)
  const escaped = rhymeWords.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  // Build keyed segments to avoid using array index as key
  let rhCount = 0;
  let txtCount = 0;
  return (
    <span>
      {parts.map((part) =>
        pattern.test(part) ? (
          <span
            key={`rh-${++rhCount}`}
            className="bg-violet-500/15 text-violet-700 dark:text-violet-300 px-0.5 border-b border-violet-400/60"
          >
            {part}
          </span>
        ) : (
          <span key={`t-${++txtCount}`}>{part}</span>
        ),
      )}
    </span>
  );
}

/** Render stress pattern as colored dots. */
function StressPattern({ pattern }: { pattern: string }) {
  return (
    <span className="inline-flex items-center gap-px ml-1">
      {pattern.split("").map((ch, i) => (
        <span
          key={i}
          className={cn(
            "inline-block rounded-full",
            ch === "1"
              ? "w-1.5 h-1.5 bg-foreground/70"
              : "w-1 h-1 bg-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export const LyricsEntryRow = memo(function LyricsEntryRow({
  entry,
  onUpdate,
  onTranslateLine,
  isStreaming,
  terms,
  analysis,
}: LyricsEntryRowProps) {
  const t = useExtracted();
  const isTranslated = entry.targetText.trim() !== "";
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTargetChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ targetText: e.target.value });
    },
    [onUpdate],
  );

  const handleDisplayClick = useCallback(() => {
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleBlur = useCallback(() => {
    setEditing(false);
  }, []);

  const lineIndex = (entry.metadata as { paragraphIndex?: number } | undefined)
    ?.paragraphIndex;

  const hasRhyme =
    analysis?.relatedLineIds && analysis.relatedLineIds.length > 0;

  const hasAnalysis = analysis && (analysis.syllableCount != null || hasRhyme);

  return (
    <div
      className={cn(
        "border-b px-3 md:px-4 py-3 transition-colors",
        isStreaming && "bg-primary/5 animate-in fade-in duration-300",
      )}
    >
      {/* Header: line number + badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-4 font-mono">
          #{lineIndex ?? entry.id}
        </Badge>
        {isTranslated ? (
          <Badge
            variant="outline"
            className="text-[10px] h-4 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
          >
            {t("Translated")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] h-4 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
          >
            {t("Untranslated")}
          </Badge>
        )}
        {analysis?.reviewPassed != null && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4",
              analysis.reviewPassed
                ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                : "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
            )}
          >
            {analysis.reviewPassed ? t("Review passed") : t("Review failed")}
          </Badge>
        )}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] gap-1 px-1.5"
              disabled={isStreaming}
              onClick={() => {
                setSuggestion("");
                setDialogOpen(true);
              }}
            >
              {isStreaming ? (
                <>
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  {t("Translating...")}
                </>
              ) : isTranslated ? (
                <>
                  <RefreshCw className="h-3 w-3" />
                  {t("Retranslate")}
                </>
              ) : (
                <>
                  <Languages className="h-3 w-3" />
                  {t("Translate")}
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isStreaming
              ? t("Translation in progress...")
              : isTranslated
                ? t("Retranslate this line with optional guidance")
                : t("Translate this line with optional guidance")}
          </TooltipContent>
        </Tooltip>
        {isTranslated && !isStreaming && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-4 w-4 text-muted-foreground hover:text-destructive"
                onClick={() => onUpdate({ targetText: "" })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("Clear translation")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Source text with highlighted rhyme words */}
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {t("Source")}
        </span>
        <div className="mt-1 text-xs bg-muted/50 px-2.5 py-1.5 border whitespace-pre-wrap">
          <HighlightedSource
            text={entry.sourceText}
            rhymeWords={hasRhyme ? analysis?.rhymeWords : undefined}
          />
        </div>
      </div>

      {/* Analysis bar */}
      {hasAnalysis && (
        <div className="mb-2 text-[11px] bg-muted/30 border px-2.5 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {analysis.syllableCount != null && (
            <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <span className="font-medium">
                {t("{count} syllables", {
                  count: String(analysis.syllableCount),
                })}
              </span>
              {analysis.stressPattern && (
                <StressPattern pattern={analysis.stressPattern} />
              )}
            </span>
          )}
          {hasRhyme &&
            analysis.rhymeWords &&
            analysis.rhymeWords.length > 0 && (
              <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                <span className="font-medium">{t("Rhyme:")}</span>
                {analysis.rhymeWords.map((word) => (
                  <span
                    key={word}
                    className="bg-violet-500/15 px-1 border-b border-violet-400/60"
                  >
                    {word}
                  </span>
                ))}
                <span className="text-muted-foreground font-normal">
                  with{" "}
                  {analysis.relatedLineIds?.map((id, i) => {
                    const relatedWords = analysis.relatedRhymeWords?.[id];
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-0.5"
                      >
                        {i > 0 && ", "}#{id}
                        {relatedWords?.map((word) => (
                          <span
                            key={word}
                            className="bg-violet-500/15 text-violet-700 dark:text-violet-300 px-0.5 border-b border-violet-400/60"
                          >
                            [{word}]
                          </span>
                        ))}
                      </span>
                    );
                  })}
                </span>
              </span>
            )}
        </div>
      )}

      {/* Review feedback */}
      {analysis?.reviewFeedback && !analysis.reviewPassed && (
        <div className="mb-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-1">
          {analysis.reviewFeedback}
        </div>
      )}

      {/* Target text — click-to-edit */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {t("Translation")}
        </span>
        {editing || !isTranslated ? (
          <Textarea
            ref={textareaRef}
            value={entry.targetText}
            onChange={handleTargetChange}
            onBlur={isTranslated ? handleBlur : undefined}
            className={cn(
              "mt-1 min-h-10",
              isStreaming && "border-primary/30 bg-primary/5",
            )}
            placeholder={t("Enter translation...")}
          />
        ) : (
          <button
            type="button"
            onClick={handleDisplayClick}
            className={cn(
              "mt-1 text-xs px-2.5 py-1.5 border cursor-text min-h-10 w-full text-left whitespace-pre-wrap",
              isStreaming
                ? "border-primary/30 bg-primary/5"
                : "bg-background hover:bg-muted/30",
            )}
          >
            <TermText text={entry.targetText} terms={terms} />
          </button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isTranslated ? t("Retranslate Line") : t("Translate Line")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Provide optional guidance for the AI translation. Leave empty for automatic translation.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-3 text-xs bg-muted/50 px-2.5 py-1.5 border whitespace-pre-wrap">
              {entry.sourceText}
            </div>
            <Textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder='e.g., "Make it more poetic" or "Use the word 夢 (dream)"'
              className="min-h-20"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("Cancel")}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setDialogOpen(false);
                onTranslateLine(suggestion.trim() || undefined);
              }}
            >
              {isTranslated ? t("Retranslate") : t("Translate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
