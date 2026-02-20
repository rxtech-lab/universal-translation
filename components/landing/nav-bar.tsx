"use client";

import { useEffect, useState } from "react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function NavBar({
  isSignedIn,
  signInAction,
}: {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
}) {
  const t = useExtracted();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 flex h-12 items-center justify-between px-6 transition-all duration-300",
        scrolled
          ? "border-b border-border/50 bg-background/60 backdrop-blur-xl backdrop-saturate-150"
          : "bg-transparent",
      )}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex size-6 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
          UT
        </div>
        <span className="text-sm font-medium tracking-tight">
          {t("Universal Translation")}
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href="#features"
          className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
        >
          {t("Features")}
        </Link>

        <LanguageSwitcher />

        {isSignedIn ? (
          <Button asChild size="sm" className="h-8 text-xs">
            <Link href="/dashboard">{t("Dashboard")}</Link>
          </Button>
        ) : (
          <form action={signInAction}>
            <Button size="sm" type="submit" className="h-8 text-xs">
              {t("Sign in")}
            </Button>
          </form>
        )}
      </div>
    </nav>
  );
}
