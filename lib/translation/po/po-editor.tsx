"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import { useExtracted } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Term } from "../tools/term-tools";
import type { TranslationProject } from "../types";
import { PoEntryRow } from "./po-entry-row";

interface PoEditorProps {
  project: TranslationProject;
  onEntryUpdate: (
    resourceId: string,
    entryId: string,
    update: { targetText?: string; comment?: string },
  ) => void;
  onTranslateLine: (
    resourceId: string,
    entryId: string,
    suggestion?: string,
  ) => void;
  streamingEntryIds: Set<string>;
  terms: Term[];
}

export function PoEditor({
  project,
  onEntryUpdate,
  onTranslateLine,
  streamingEntryIds,
  terms,
}: PoEditorProps) {
  const t = useExtracted();
  const resource = project.resources[0];
  const entries = useMemo(() => resource?.entries ?? [], [resource?.entries]);
  const resourceId = resource?.id ?? "po-main";

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
          <div className="flex items-center gap-2">
            <CardTitle>{resource?.label ?? t("PO Translations")}</CardTitle>
            {project.sourceLanguage && project.targetLanguages?.[0] && (
              <Badge variant="secondary" className="text-xs">
                {project.sourceLanguage} → {project.targetLanguages[0]}
              </Badge>
            )}
          </div>
          <Badge variant="outline">
            {t("{translated}/{total} translated", {
              translated: String(stats.translated),
              total: String(stats.total),
            })}
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
                  <PoEntryRow
                    entry={entry}
                    resourceId={resourceId}
                    onUpdate={(update) => handleEntryUpdate(entry.id, update)}
                    onTranslateLine={(suggestion) =>
                      onTranslateLine(resourceId, entry.id, suggestion)
                    }
                    isStreaming={streamingEntryIds.has(
                      `${resourceId}:${entry.id}`,
                    )}
                    terms={terms}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {t("No entries in this PO file")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
