"use client";

import { ArrowRight, FileText, Loader2, Music } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createProjectFromParsed } from "@/app/actions/upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DocumentClient } from "@/lib/translation/document/client";
import { LANGUAGES } from "@/lib/translation/languages";
import { LyricsClient } from "@/lib/translation/lyrics/client";
import type { TranslationProject } from "@/lib/translation/types";
import type { TranslationMode } from "./mode-selector";

export function TextInputClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [projectName, setProjectName] = useState("");
  const [mode, setMode] = useState<TranslationMode>("universal");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    text.trim() && targetLanguage && sourceLanguage !== targetLanguage;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);

    try {
      const name = projectName || "Untitled";
      const fileName = `${name}.txt`;
      let formatId: string;
      let project: TranslationProject;
      let formatData: Record<string, unknown>;

      if (mode === "lyrics") {
        const client = new LyricsClient();
        client.loadFromText(text, fileName);
        client.setLanguages(sourceLanguage, targetLanguage);
        formatId = "lyrics";
        project = client.getProject();
        formatData = client.getFormatData() as unknown as Record<
          string,
          unknown
        >;
      } else {
        const client = new DocumentClient();
        client.loadFromText(text, fileName);
        client.setLanguages(sourceLanguage, targetLanguage);
        formatId = "document";
        project = client.getProject();
        formatData = client.getFormatData() as unknown as Record<
          string,
          unknown
        >;
      }

      const projectId = await createProjectFromParsed({
        name,
        formatId,
        blobUrl: "",
        content: project,
        formatData,
        sourceLanguage,
        targetLanguage,
        sourceLocale: sourceLanguage,
        targetLocale: targetLanguage,
      });

      router.push(`/dashboard/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  }, [
    canCreate,
    text,
    mode,
    projectName,
    sourceLanguage,
    targetLanguage,
    router,
  ]);

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>New Translation Project</CardTitle>
        <CardDescription>
          Paste text directly to create a translation project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Project Name
          </label>
          <Input
            placeholder="Untitled"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        {/* Text input */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Text Content
          </label>
          <Textarea
            placeholder="Paste your text or lyrics here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-40 resize-y"
          />
        </div>

        {/* Mode selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Translation Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("universal")}
              className={`p-3 border text-left transition-colors ${
                mode === "universal"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <FileText className="h-4 w-4 mb-1 text-muted-foreground" />
              <div className="font-medium text-sm">Universal</div>
              <div className="text-xs text-muted-foreground">
                Standard translation
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("lyrics")}
              className={`p-3 border text-left transition-colors ${
                mode === "lyrics"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <Music className="h-4 w-4 mb-1 text-muted-foreground" />
              <div className="font-medium text-sm">Lyrics</div>
              <div className="text-xs text-muted-foreground">
                Rhythm & rhyme aware
              </div>
            </button>
          </div>
        </div>

        {/* Language selectors */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Source Language
            </label>
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />

          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Target Language
            </label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter((lang) => lang.code !== sourceLanguage).map(
                  (lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canCreate || isCreating}
            onClick={handleCreate}
          >
            {isCreating && (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            )}
            Create Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
