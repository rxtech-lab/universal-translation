"use client";

import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LyricsAnalysis } from "../components/use-translation-stream";
import { TermText } from "../components/term-text";
import type { Term } from "../tools/term-tools";
import type { TranslationEntry } from "../types";

interface LyricsEntryRowProps {
  entry: TranslationEntry;
  resourceId: string;
  onUpdate: (update: { targetText?: string; comment?: string }) => void;
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
  isStreaming,
  terms,
  analysis,
}: LyricsEntryRowProps) {
  const isTranslated = entry.targetText.trim() !== "";
  const [editing, setEditing] = useState(false);
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

  const hasAnalysis =
    analysis && (analysis.syllableCount != null || analysis.rhymeWords);

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
            Translated
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] h-4 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
          >
            Untranslated
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
            {analysis.reviewPassed ? "Review passed" : "Review failed"}
          </Badge>
        )}
      </div>

      {/* Source text with highlighted rhyme words */}
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Source
        </span>
        <div className="mt-1 text-xs bg-muted/50 px-2.5 py-1.5 border whitespace-pre-wrap">
          <HighlightedSource
            text={entry.sourceText}
            rhymeWords={analysis?.rhymeWords}
          />
        </div>
      </div>

      {/* Analysis bar */}
      {hasAnalysis && (
        <div className="mb-2 text-[11px] bg-muted/30 border px-2.5 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {analysis.syllableCount != null && (
            <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <span className="font-medium">
                {analysis.syllableCount} syllables
              </span>
              {analysis.stressPattern && (
                <StressPattern pattern={analysis.stressPattern} />
              )}
            </span>
          )}
          {analysis.rhymeWords && analysis.rhymeWords.length > 0 && (
            <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
              <span className="font-medium">Rhyme:</span>
              {analysis.rhymeWords.map((word) => (
                <span
                  key={word}
                  className="bg-violet-500/15 px-1 border-b border-violet-400/60"
                >
                  {word}
                </span>
              ))}
            </span>
          )}
          {analysis.relatedLineIds && analysis.relatedLineIds.length > 0 && (
            <span className="text-muted-foreground">
              rhymes with{" "}
              {analysis.relatedLineIds.map((id) => `#${id}`).join(", ")}
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
          Translation
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
            placeholder="Enter translation..."
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
    </div>
  );
});
