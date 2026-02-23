"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { createTerm, deleteTerm, updateTerm } from "@/app/actions/terms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Term } from "../tools/term-tools";
import { slugifyTermId, uniqueTermSlug } from "../tools/term-tools";

interface TermsEditorProps {
  projectId: string;
  terms: Term[];
}

export function TermsEditor({ projectId, terms }: TermsEditorProps) {
  const t = useExtracted();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOriginal, setNewOriginal] = useState("");
  const [newTranslation, setNewTranslation] = useState("");

  const handleUpdate = useCallback(
    async (termId: string, field: "translation" | "comment", value: string) => {
      const term = terms.find((tm) => tm.id === termId);
      if (!term) return;
      const currentValue = field === "comment" ? (term.comment ?? "") : term[field];
      if (value === currentValue) return;
      await updateTerm(termId, { [field]: value });
      startTransition(() => router.refresh());
    },
    [terms, router, startTransition],
  );

  const handleDelete = useCallback(
    async (termId: string) => {
      await deleteTerm(termId);
      startTransition(() => router.refresh());
    },
    [router, startTransition],
  );

  const handleAdd = useCallback(async () => {
    if (!newOriginal.trim()) return;
    const existingSlugs = new Set(terms.map((tm) => tm.slug));
    const slug = uniqueTermSlug(slugifyTermId(newOriginal), existingSlugs);
    await createTerm(projectId, {
      slug,
      originalText: newOriginal,
      translation: newTranslation,
    });
    setNewOriginal("");
    setNewTranslation("");
    startTransition(() => router.refresh());
  }, [newOriginal, newTranslation, terms, projectId, router, startTransition]);

  return (
    <div className={cn("space-y-2", isPending && "opacity-50 pointer-events-none")}>
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>{t("Original")}</span>
        <span>{t("Translation")}</span>
        <span>{t("Comment")}</span>
        <span className="w-8" />
      </div>

      {/* Term rows */}
      {terms.map((term) => (
        <div
          key={term.id}
          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center animate-in fade-in duration-200"
        >
          <Input value={term.originalText} readOnly className="bg-muted/50" />
          <Input
            key={`${term.id}-t-${term.translation}`}
            defaultValue={term.translation}
            onBlur={(e) => handleUpdate(term.id, "translation", e.target.value)}
          />
          <Input
            key={`${term.id}-c-${term.comment ?? ""}`}
            defaultValue={term.comment ?? ""}
            onBlur={(e) => handleUpdate(term.id, "comment", e.target.value)}
            placeholder={t("Optional comment")}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleDelete(term.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Add new term */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center border-t pt-2">
        <Input
          value={newOriginal}
          onChange={(e) => setNewOriginal(e.target.value)}
          placeholder={t("Original text")}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Input
          value={newTranslation}
          onChange={(e) => setNewTranslation(e.target.value)}
          placeholder={t("Translation")}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <span />
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleAdd}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {terms.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 text-center">
          {t(
            "No terms yet. Terms are automatically detected during translation, or add them manually above.",
          )}
        </p>
      )}
    </div>
  );
}
