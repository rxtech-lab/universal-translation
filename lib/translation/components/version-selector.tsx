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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectVersion {
  id: string;
  createdAt: Date;
}

interface VersionSelectorProps {
  projectId: string;
  initialVersionCount?: number;
}

export function VersionSelector({
  projectId,
  initialVersionCount = 0,
}: VersionSelectorProps) {
  const t = useExtracted();
  const router = useRouter();
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [versionCount, setVersionCount] = useState(initialVersionCount);
  const [isRestoring, startRestoring] = useTransition();

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
        {versions.map((version, index) => (
          <DropdownMenuItem
            key={version.id}
            onClick={() => handleRestore(version.id)}
            data-testid={`version-item-${index}`}
          >
            {new Date(version.createdAt).toLocaleString()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
