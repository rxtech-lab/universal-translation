"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  const pathname = usePathname();
  const isProjectDetail = /^\/dashboard\/projects\/(?!new\b)[^/]+$/.test(
    pathname,
  );

  return (
    <header className="flex h-(--header-height) items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      {isProjectDetail && (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">
              <ArrowLeftIcon className="size-4" />
              Back
            </Link>
          </Button>
        </>
      )}
    </header>
  );
}
