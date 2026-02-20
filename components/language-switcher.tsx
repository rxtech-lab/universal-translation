"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeLabels: Record<string, string> = {
  en: "EN",
  zh: "中文",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 text-xs">
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="text-muted-foreground/40 mx-1">|</span>}
          <button
            type="button"
            onClick={() => router.replace(pathname, { locale: l })}
            className={`transition-colors ${
              l === locale
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {localeLabels[l] ?? l}
          </button>
        </span>
      ))}
    </div>
  );
}
