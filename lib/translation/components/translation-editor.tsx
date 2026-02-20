"use client";

import {
  BookOpen,
  Download,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { TermsEditor } from "./terms-editor";
import { TranslateDropdown } from "./translate-dropdown";
import { TranslationStatus } from "./translation-status";
import type { TranslationEditorProps } from "./types";

export function TranslationEditor({
  projectId,
  projectName,
  formatDisplayName,
  sourceLanguage,
  targetLanguage,
  status,
  errors,
  onClearErrors,
  onTranslate,
  onStopTranslation,
  onExport,
  onSave,
  children,
  terms,
  onTermsChange,
  onTranslationUpdated,
  onClearAllTranslations,
  onRename,
}: TranslationEditorProps) {
  const isTranslating = status.state === "translating";
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [clearAlertOpen, setClearAlertOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [editName, setEditName] = useState(projectName);

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <Card size="sm" className="sticky top-0 z-10">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {projectName}
            </CardTitle>
            {onRename && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => {
                  setEditName(projectName);
                  setRenameDialogOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Badge variant="outline" className="hidden md:inline-flex">
              {formatDisplayName}
            </Badge>
            {sourceLanguage && targetLanguage && (
              <Badge variant="secondary">
                {sourceLanguage} → {targetLanguage}
              </Badge>
            )}
          </div>
          <CardAction>
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <TranslationStatus
                status={status}
                errors={errors}
                onClearErrors={onClearErrors}
              />
              <Separator orientation="vertical" className="h-4" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTermsDialogOpen(true)}
              >
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Terms ({terms.length})
              </Button>
              <TranslateDropdown
                projectId={projectId}
                isTranslating={isTranslating}
                onTranslate={onTranslate}
                onStopTranslation={onStopTranslation ?? (() => {})}
                onTranslationUpdated={onTranslationUpdated}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearAlertOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
              <Button size="sm" onClick={onSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>

            {/* Mobile actions */}
            <div className="flex md:hidden items-center gap-1.5">
              <TranslationStatus
                status={status}
                errors={errors}
                onClearErrors={onClearErrors}
              />
              <TranslateDropdown
                projectId={projectId}
                isTranslating={isTranslating}
                onTranslate={onTranslate}
                onStopTranslation={onStopTranslation ?? (() => {})}
                onTranslationUpdated={onTranslationUpdated}
              />
              <Button size="icon-sm" onClick={onSave}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTermsDialogOpen(true)}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Terms ({terms.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setClearAlertOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardAction>
        </CardHeader>
      </Card>

      {/* Format-specific editor */}
      <div className="flex-1 min-h-0">{children}</div>

      {/* Terms Dialog — controlled */}
      <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
        <DialogContent className="max-w-5xl! max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terminology</DialogTitle>
          </DialogHeader>
          <TermsEditor
            projectId={projectId}
            terms={terms}
            onTermsChange={onTermsChange}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" onClick={onSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All AlertDialog — controlled */}
      <AlertDialog open={clearAlertOpen} onOpenChange={setClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all translations?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all translated text. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              variant="destructive"
              onClick={onClearAllTranslations}
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog — controlled */}
      {onRename && (
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="editor-project-name">Project name</Label>
              <Input
                id="editor-project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) {
                    onRename(editName.trim());
                    setRenameDialogOpen(false);
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                size="sm"
                onClick={() => {
                  if (editName.trim()) {
                    onRename(editName.trim());
                    setRenameDialogOpen(false);
                  }
                }}
                disabled={!editName.trim()}
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
