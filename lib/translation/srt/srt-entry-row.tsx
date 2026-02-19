"use client";

import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PlaceholderText } from "../components/placeholder-text";
import { TermText } from "../components/term-text";
import type { Term } from "../tools/term-tools";
import type { TranslationEntry } from "../types";

interface SrtEntryRowProps {
  entry: TranslationEntry;
  resourceId: string;
  onUpdate: (update: { targetText?: string; comment?: string }) => void;
  isStreaming: boolean;
  terms: Term[];
}

export const SrtEntryRow = memo(function SrtEntryRow({
  entry,
  onUpdate,
  isStreaming,
  terms,
}: SrtEntryRowProps) {
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

  const metadata = entry.metadata as
    | {
        startTimestamp?: string;
        endTimestamp?: string;
        cueIndex?: number;
      }
    | undefined;

  const timestamp =
    metadata?.startTimestamp && metadata?.endTimestamp
      ? `${metadata.startTimestamp} --> ${metadata.endTimestamp}`
      : null;

  return (
    <div
      className={cn(
        "border-b px-3 md:px-4 py-3 transition-colors",
        isStreaming && "bg-primary/5 animate-in fade-in duration-300",
      )}
    >
      {/* Cue number, timestamp, and status */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-4 font-mono">
          #{metadata?.cueIndex ?? entry.id}
        </Badge>
        {timestamp && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {timestamp}
          </span>
        )}
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
      </div>

      {/* Source text */}
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Source
        </span>
        <div className="mt-1 text-xs bg-muted/50 px-2.5 py-1.5 border whitespace-pre-wrap">
          <PlaceholderText text={entry.sourceText} />
        </div>
      </div>

      {/* Target text — click-to-edit with term resolution */}
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
