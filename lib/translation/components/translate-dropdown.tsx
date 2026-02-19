"use client";

import { ChevronDown, Languages, MessageSquare, Square } from "lucide-react";
import { useState } from "react";
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isTranslating) {
    return (
      <Button variant="outline" size="sm" onClick={onStopTranslation}>
        <Square className="h-3 w-3 mr-1" />
        Stop
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Languages className="h-3.5 w-3.5 mr-1" />
            Translate
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onTranslate}>
            <Languages className="h-3.5 w-3.5" />
            Translate All
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
            <MessageSquare className="h-3.5 w-3.5" />
            Edit Translate
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
