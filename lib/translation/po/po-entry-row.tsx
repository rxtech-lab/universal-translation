"use client";

import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EntryRowActions } from "../components/entry-row-actions";
import { PlaceholderText } from "../components/placeholder-text";
import { TermText } from "../components/term-text";
import type { Term } from "../tools/term-tools";
import type { TranslationEntry } from "../types";

interface PoEntryRowProps {
  entry: TranslationEntry;
  resourceId: string;
  onUpdate: (update: { targetText?: string; comment?: string }) => void;
  onTranslateLine: (suggestion?: string) => void;
  isStreaming: boolean;
  terms: Term[];
}

export const PoEntryRow = memo(function PoEntryRow({
  entry,
  onUpdate,
  onTranslateLine,
  isStreaming,
  terms,
}: PoEntryRowProps) {
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
        entryIndex?: number;
        flags?: string[];
        msgctxt?: string;
        translatorComments?: string[];
        pluralIndex?: number;
      }
    | undefined;

  const isFuzzy = metadata?.flags?.includes("fuzzy") ?? false;

  return (
    <div
      className={cn(
        "border-b px-3 md:px-4 py-3 transition-colors",
        isStreaming && "bg-primary/5 animate-in fade-in duration-300",
      )}
    >
      {/* Entry ID and status */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-40 md:max-w-64">
          {entry.id}
        </span>
        {metadata?.msgctxt && (
          <Badge variant="secondary" className="text-[10px] h-4">
            ctx: {metadata.msgctxt}
          </Badge>
        )}
        {entry.pluralForm && (
          <Badge variant="secondary" className="text-[10px] h-4">
            {entry.pluralForm}
          </Badge>
        )}
        {isFuzzy && (
          <Badge
            variant="outline"
            className="text-[10px] h-4 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
          >
            fuzzy
          </Badge>
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
        <EntryRowActions
          sourceText={entry.sourceText}
          isTranslated={isTranslated}
          isStreaming={isStreaming}
          onTranslateLine={onTranslateLine}
          onClearTranslation={() => onUpdate({ targetText: "" })}
        />
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
      <div className="mb-2">
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

      {/* Comment */}
      {entry.comment && (
        <div className="text-xs text-muted-foreground italic">
          Note: {entry.comment}
        </div>
      )}

      {/* Context (references) */}
      {entry.context && (
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          Ref: {entry.context}
        </div>
      )}
    </div>
  );
});
