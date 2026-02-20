"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NavBar({
  isSignedIn,
  signInAction,
}: {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 flex h-14 items-center justify-between px-6 transition-all",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-lg"
          : "bg-transparent",
      )}
    >
      <Link href="/" className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center text-xs font-bold">
          UT
        </div>
        <span className="text-sm font-semibold">Universal Translation</span>
      </Link>

      {isSignedIn ? (
        <Button asChild size="sm">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      ) : (
        <form action={signInAction}>
          <Button size="sm" type="submit">
            Sign in
          </Button>
        </form>
      )}
    </nav>
  );
}
