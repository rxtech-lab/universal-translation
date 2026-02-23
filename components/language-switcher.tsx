"use client";

import { GlobeIcon } from "lucide-react";
import { useLocale } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeLabels: Record<string, string> = {
  en: "EN",
  zh: "中文",
};

export function LanguageSwitcher({
  align = "end",
}: {
  align?: "start" | "center" | "end";
} = {}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <GlobeIcon className="size-3.5" />
          {localeLabels[locale] ?? locale}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => router.replace(pathname, { locale: value })}
        >
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {localeLabels[l] ?? l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
