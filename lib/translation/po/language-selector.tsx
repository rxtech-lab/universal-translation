"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "../languages";

interface PoLanguageSelectorProps {
  fileName: string;
  onConfirm: (sourceLanguage: string, targetLanguage: string) => void;
  onCancel: () => void;
}

export function PoLanguageSelector({
  fileName,
  onConfirm,
  onCancel,
}: PoLanguageSelectorProps) {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("");

  const canConfirm =
    sourceLanguage && targetLanguage && sourceLanguage !== targetLanguage;

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>Set Languages</CardTitle>
        <CardDescription>
          Select the source and target languages for{" "}
          <span className="font-medium text-foreground">{fileName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <SelectTrigger data-testid="target-language-trigger">
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

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canConfirm}
            data-testid="create-project-button"
            onClick={() => onConfirm(sourceLanguage, targetLanguage)}
          >
            Create Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
