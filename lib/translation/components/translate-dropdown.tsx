"use client";

import { ChevronDown, Languages, MessageSquare, Square } from "lucide-react";
import { useState } from "react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditTranslateDialog } from "./edit-translate-dialog";

interface TranslateDropdownProps {
  projectId: string;
  isTranslating: boolean;
  onTranslate: () => void;
  onStopTranslation: () => void;
  onTranslationUpdated: (
    resourceId: string,
    entryId: string,
    targetText: string,
  ) => void;
}

export function TranslateDropdown({
  projectId,
  isTranslating,
  onTranslate,
  onStopTranslation,
  onTranslationUpdated,
}: TranslateDropdownProps) {
  const t = useExtracted();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isTranslating) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStopTranslation}
        data-testid="translate-stop-button"
      >
        <Square className="h-3 w-3 mr-1" />
        {t("Stop")}
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="translate-button">
            <Languages className="h-3.5 w-3.5 mr-1" />
            {t("Translate")}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onTranslate} data-testid="translate-all">
            <Languages className="h-3.5 w-3.5" />
            {t("Translate All")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setEditDialogOpen(true)}
            data-testid="translate-edit"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {t("Edit Translate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTranslateDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        projectId={projectId}
        onTranslationUpdated={onTranslationUpdated}
      />
    </>
  );
}
