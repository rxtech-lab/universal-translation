"use client";

import { Languages, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EntryRowActionsProps {
  sourceText: string;
  isTranslated: boolean;
  isStreaming: boolean;
  onTranslateLine: (suggestion?: string) => void;
  onClearTranslation: () => void;
}

export function EntryRowActions({
  sourceText,
  isTranslated,
  isStreaming,
  onTranslateLine,
  onClearTranslation,
}: EntryRowActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  return (
    <>
      <div className="flex-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] gap-1 px-1.5"
            disabled={isStreaming}
            onClick={() => {
              setSuggestion("");
              setDialogOpen(true);
            }}
          >
            {isStreaming ? (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin" />
                Translating...
              </>
            ) : isTranslated ? (
              <>
                <RefreshCw className="h-3 w-3" />
                Retranslate
              </>
            ) : (
              <>
                <Languages className="h-3 w-3" />
                Translate
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isStreaming
            ? "Translation in progress..."
            : isTranslated
              ? "Retranslate this entry with optional guidance"
              : "Translate this entry with optional guidance"}
        </TooltipContent>
      </Tooltip>
      {isTranslated && !isStreaming && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-4 w-4 text-muted-foreground hover:text-destructive"
              onClick={onClearTranslation}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear translation</TooltipContent>
        </Tooltip>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isTranslated ? "Retranslate Entry" : "Translate Entry"}
            </DialogTitle>
            <DialogDescription>
              Provide optional guidance for the AI translation. Leave empty for
              automatic translation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-3 text-xs bg-muted/50 px-2.5 py-1.5 border whitespace-pre-wrap">
              {sourceText}
            </div>
            <Textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder='e.g., "Use formal tone" or "Keep it concise"'
              className="min-h-20"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setDialogOpen(false);
                onTranslateLine(suggestion.trim() || undefined);
              }}
            >
              {isTranslated ? "Retranslate" : "Translate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
