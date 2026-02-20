"use client";

import { FileText, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PoReferenceUploadProps {
  fileName: string;
  onConfirm: (referencePoText: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function PoReferenceUpload({
  fileName,
  onConfirm,
  onSkip,
  onCancel,
}: PoReferenceUploadProps) {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setReferenceFile(file);
        setError(null);
      }
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setReferenceFile(file);
      setError(null);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!referenceFile) return;
    setLoading(true);
    setError(null);
    try {
      const text = await referenceFile.text();
      onConfirm(text);
    } catch {
      setError("Failed to read reference file");
    } finally {
      setLoading(false);
    }
  }, [referenceFile, onConfirm]);

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>Reference File Needed</CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{fileName}</span>{" "}
          appears to use hash-based message IDs. To display the actual source
          text, upload the reference PO file (usually{" "}
          <span className="font-mono text-foreground">en.po</span>) that
          contains the English translations for these IDs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
            referenceFile
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".po"
            onChange={handleFileSelect}
            className="hidden"
          />
          {referenceFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium">{referenceFile.name}</p>
              <p className="text-xs text-muted-foreground">
                Click to change file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drop reference PO file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Usually en.po or the source language file
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <Button
            size="sm"
            disabled={!referenceFile || loading}
            onClick={handleConfirm}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply Reference
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
