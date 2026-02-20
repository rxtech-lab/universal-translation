"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deleteProject, renameProject } from "@/app/actions/projects";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    formatId: string;
    sourceLanguage: string | null;
    targetLanguage: string | null;
    status: string;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === project.name) {
      setRenameDialogOpen(false);
      return;
    }
    setIsRenaming(true);
    try {
      await renameProject(project.id, newName.trim());
      toast.success("Project renamed");
      setRenameDialogOpen(false);
    } catch {
      toast.error("Failed to rename project");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer group relative">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="absolute inset-0 z-0"
        />
        <CardHeader>
          <CardTitle className="text-sm">{project.name}</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{project.formatId}</Badge>
              {project.sourceLanguage && project.targetLanguage && (
                <Badge variant="secondary">
                  {project.sourceLanguage} → {project.targetLanguage}
                </Badge>
              )}
              <Badge
                variant={
                  project.status === "completed" ? "default" : "secondary"
                }
              >
                {project.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="relative z-10"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setNewName(project.name);
                      setRenameDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteAlertOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardAction>
        </CardHeader>
      </Card>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
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
              onClick={handleRename}
              disabled={isRenaming || !newName.trim()}
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{project.name}&rdquo; and all
              its translations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
