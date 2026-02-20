"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LyricsAnalysis } from "../components/use-translation-stream";
import type { Term } from "../tools/term-tools";
import type { TranslationProject } from "../types";
import { LyricsEntryRow } from "./lyrics-entry-row";

interface LyricsEditorProps {
  project: TranslationProject;
  onEntryUpdate: (
    resourceId: string,
    entryId: string,
    update: { targetText?: string; comment?: string },
  ) => void;
  streamingEntryIds: Set<string>;
  terms: Term[];
  lyricsAnalysis: Map<string, LyricsAnalysis>;
}

export function LyricsEditor({
  project,
  onEntryUpdate,
  streamingEntryIds,
  terms,
  lyricsAnalysis,
}: LyricsEditorProps) {
  const resource = project.resources[0];
  const entries = useMemo(() => resource?.entries ?? [], [resource?.entries]);
  const resourceId = resource?.id ?? "lyrics-main";

  const stats = useMemo(() => {
    const total = entries.length;
    const translated = entries.filter((e) => e.targetText.trim() !== "").length;
    return { total, translated };
  }, [entries]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  const handleEntryUpdate = useCallback(
    (entryId: string, update: { targetText?: string; comment?: string }) => {
      onEntryUpdate(resourceId, entryId, update);
    },
    [resourceId, onEntryUpdate],
  );

  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardHeader className="border-b shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>{resource?.label ?? "Lyrics"}</CardTitle>
          <Badge variant="outline">
            {stats.translated}/{stats.total} translated
          </Badge>
        </div>
      </CardHeader>
      <CardContent
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-0"
      >
        {entries.length > 0 ? (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = entries[virtualRow.index];
              return (
                <div
                  key={entry.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 w-full"
                  style={{ top: virtualRow.start }}
                >
                  <LyricsEntryRow
                    entry={entry}
                    resourceId={resourceId}
                    onUpdate={(update) => handleEntryUpdate(entry.id, update)}
                    isStreaming={streamingEntryIds.has(
                      `${resourceId}:${entry.id}`,
                    )}
                    terms={terms}
                    analysis={lyricsAnalysis.get(entry.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            No translatable content found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
