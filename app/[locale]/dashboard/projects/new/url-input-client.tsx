"use client";

import { ArrowRight, Globe, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useExtracted } from "next-intl";
import { createProjectFromParsed } from "@/app/actions/upload";
import { deleteTempBlob, fetchUrlHtml } from "@/app/actions/html-fetch";
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
import { useRouter } from "@/i18n/navigation";
import { HtmlClient } from "@/lib/translation/html/client";
import { LANGUAGES } from "@/lib/translation/languages";
import type { TranslationProject } from "@/lib/translation/types";

type UrlState =
  | { step: "input" }
  | { step: "fetching" }
  | {
      step: "language-select";
      client: HtmlClient;
      fileName: string;
    }
  | { step: "creating" }
  | { step: "error"; message: string };

export function UrlInputClient() {
  const t = useExtracted();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<UrlState>({ step: "input" });
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("");

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;

    setState({ step: "fetching" });
    try {
      const result = await fetchUrlHtml(url.trim());

      // Fetch HTML from Vercel Blob directly in the browser — avoids the
      // 4.5 MB Vercel function response size limit.
      const html = await fetch(result.blobUrl).then((r) => r.text());

      // Clean up the temporary blob (fire-and-forget)
      deleteTempBlob(result.blobUrl).catch(() => {});

      const client = new HtmlClient();
      // Derive a filename from the URL
      let fileName: string;
      try {
        const parsed = new URL(result.finalUrl);
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const last = pathParts[pathParts.length - 1];
        fileName =
          last && last.includes(".")
            ? last
            : `${parsed.hostname.replace(/\./g, "_")}.html`;
      } catch {
        fileName = "webpage.html";
      }

      const loadResult = client.loadFromUrl(html, result.finalUrl, fileName);
      if (loadResult.hasError) {
        setState({ step: "error", message: loadResult.errorMessage });
        return;
      }

      setState({ step: "language-select", client, fileName });
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to fetch URL",
      });
    }
  }, [url]);

  const handleCreate = useCallback(async () => {
    if (
      state.step !== "language-select" ||
      !targetLanguage ||
      sourceLanguage === targetLanguage
    )
      return;

    const { client, fileName } = state;
    setState({ step: "creating" });

    try {
      client.setLanguages(sourceLanguage, targetLanguage);
      const project = client.getProject();
      const formatData = client.getFormatData() as unknown as Record<
        string,
        unknown
      >;

      const projectId = await createProjectFromParsed({
        name: fileName.replace(/\.(html|htm)$/i, ""),
        formatId: "html",
        blobUrl: "",
        content: project as TranslationProject,
        formatData,
        sourceLanguage,
        targetLanguage,
        sourceLocale: sourceLanguage,
        targetLocale: targetLanguage,
      });

      router.push(`/dashboard/projects/${projectId}`);
    } catch (err) {
      setState({
        step: "error",
        message:
          err instanceof Error ? err.message : "Failed to create project",
      });
    }
  }, [state, sourceLanguage, targetLanguage, router]);

  if (state.step === "language-select") {
    const entryCount = state.client
      .getProject()
      .resources.reduce((sum, r) => sum + r.entries.length, 0);

    return (
      <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle>{t("Configure Languages")}</CardTitle>
          <CardDescription>
            {t("Found {count} translatable segments in {fileName}", {
              count: String(entryCount),
              fileName: state.fileName,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t("Source Language")}
              </label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Select language")} />
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
                {t("Target Language")}
              </label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Select language")} />
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

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState({ step: "input" })}
            >
              {t("Back")}
            </Button>
            <Button
              size="sm"
              disabled={!targetLanguage || sourceLanguage === targetLanguage}
              onClick={handleCreate}
            >
              {t("Create Project")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle>{t("New Translation Project")}</CardTitle>
        <CardDescription>
          {t("Enter a URL to fetch and translate a webpage")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            {t("Webpage URL")}
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) handleFetch();
              }}
              disabled={state.step === "fetching" || state.step === "creating"}
            />
            <Button
              size="sm"
              disabled={
                !url.trim() ||
                state.step === "fetching" ||
                state.step === "creating"
              }
              onClick={handleFetch}
            >
              {state.step === "fetching" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              {t("Fetch")}
            </Button>
          </div>
        </div>

        {state.step === "fetching" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("Fetching webpage...")}
          </div>
        )}

        {state.step === "creating" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("Creating project...")}
          </div>
        )}

        {state.step === "error" && (
          <div className="space-y-2 animate-in fade-in duration-300">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState({ step: "input" })}
            >
              {t("Try again")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
