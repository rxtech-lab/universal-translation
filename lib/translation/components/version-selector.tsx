"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, History, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { getProjectVersions } from "@/app/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EditorStatus } from "./types";

interface ProjectVersion {
  id: string;
  createdAt: Date;
}

interface VersionSelectorProps {
  projectId: string;
  initialVersionCount?: number;
  status: EditorStatus;
  selectedVersionId?: string | null;
}

function groupVersionsByDate(versions: ProjectVersion[]) {
  const groups: { label: string; versions: ProjectVersion[] }[] = [];
  let currentLabel = "";

  for (const version of versions) {
    const date = new Date(version.createdAt);
    const label = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, versions: [] });
    }
    groups[groups.length - 1].versions.push(version);
  }

  return groups;
}

export function VersionSelector({
  projectId,
  initialVersionCount = 0,
  status,
  selectedVersionId,
}: VersionSelectorProps) {
  const t = useExtracted();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: versions = [], isFetching } = useQuery({
    queryKey: ["project-versions", projectId],
    queryFn: () => getProjectVersions(projectId),
    enabled: isOpen,
    staleTime: 0,
  });

  const versionCount = versions.length || initialVersionCount;

  const [prevStatusState, setPrevStatusState] = useState<EditorStatus["state"]>(
    status.state,
  );

  // Invalidate query cache after a save completes
  if (status.state !== prevStatusState) {
    if (prevStatusState === "saving" && status.state === "saved") {
      queryClient.invalidateQueries({
        queryKey: ["project-versions", projectId],
      });
    }
    setPrevStatusState(status.state);
  }

  const handleSelectVersion = useCallback(
    (versionId: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("version", versionId);
      router.push(url.pathname + url.search);
    },
    [router],
  );

  if (versionCount === 0) return null;

  const grouped = groupVersionsByDate(versions);
  let globalIndex = 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="version-selector-button"
        >
          <History className="h-3.5 w-3.5 mr-1" />
          {t("History")} ({versionCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-60 overflow-y-auto min-w-45"
        data-testid="version-selector-menu"
      >
        {isFetching && versions.length === 0 ? (
          <div className="flex items-center justify-center py-4 px-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          grouped.map((group, groupIdx) => (
            <div key={group.label}>
              {groupIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.versions.map((version) => {
                const idx = globalIndex++;
                const isCurrent = idx === 0;
                const isSelected = version.id === selectedVersionId;
                return (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => handleSelectVersion(version.id)}
                    className={cn(isSelected && "bg-accent")}
                    data-testid={`version-item-${idx}`}
                  >
                    <span className="flex-1">
                      {new Date(version.createdAt).toLocaleTimeString()}
                    </span>
                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] px-1 py-0"
                      >
                        {t("Current")}
                      </Badge>
                    )}
                    {isSelected && <Check className="h-3 w-3 ml-1 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
