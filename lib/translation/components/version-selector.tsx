"use client";

import { History } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { toast } from "sonner";
import {
  getProjectVersions,
  restoreProjectVersion,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditorStatus } from "./types";

interface ProjectVersion {
  id: string;
  createdAt: Date;
}

interface VersionSelectorProps {
  projectId: string;
  initialVersionCount?: number;
  status: EditorStatus;
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
}: VersionSelectorProps) {
  const t = useExtracted();
  const router = useRouter();
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [versionCount, setVersionCount] = useState(initialVersionCount);
  const [isRestoring, startRestoring] = useTransition();
  const [prevStatusState, setPrevStatusState] = useState<
    EditorStatus["state"]
  >(status.state);

  // Refresh version count from server after a save completes
  if (status.state !== prevStatusState) {
    if (prevStatusState === "saving" && status.state === "saved") {
      getProjectVersions(projectId).then((result) => {
        setVersionCount(result.length);
        setVersions(result);
      });
    }
    setPrevStatusState(status.state);
  }

  const loadVersions = useCallback(async () => {
    const result = await getProjectVersions(projectId);
    setVersions(result);
    setVersionCount(result.length);
  }, [projectId]);

  const handleRestore = useCallback(
    (versionId: string) => {
      startRestoring(async () => {
        try {
          await restoreProjectVersion(projectId, versionId);
          toast.success(t("Version restored"));
          router.refresh();
        } catch {
          toast.error(t("Failed to restore version"));
        }
      });
    },
    [projectId, router, t],
  );

  if (versionCount === 0) return null;

  const grouped = groupVersionsByDate(versions);
  let globalIndex = 0;

  return (
    <DropdownMenu onOpenChange={(open) => open && loadVersions()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isRestoring}
          data-testid="version-selector-button"
        >
          <History className="h-3.5 w-3.5 mr-1" />
          {t("History")} ({versionCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-60 overflow-y-auto"
        data-testid="version-selector-menu"
      >
        {grouped.map((group, groupIdx) => (
          <div key={group.label}>
            {groupIdx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.versions.map((version) => {
              const idx = globalIndex++;
              return (
                <DropdownMenuItem
                  key={version.id}
                  onClick={() => handleRestore(version.id)}
                  data-testid={`version-item-${idx}`}
                >
                  {new Date(version.createdAt).toLocaleTimeString()}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
