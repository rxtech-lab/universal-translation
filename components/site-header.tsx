"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useExtracted();
  const pathname = usePathname();
  const isProjectDetail = /^\/dashboard\/projects\/(?!new\b)[^/]+$/.test(
    pathname,
  );

  return (
    <header className="flex h-(--header-height) items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      {isProjectDetail && (
        <>
          <Separator orientation="vertical" className="mx-1 h-4 my-auto" />

          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">
              <ArrowLeftIcon className="size-4" />
              {t("Back")}
            </Link>
          </Button>
        </>
      )}
    </header>
  );
}
