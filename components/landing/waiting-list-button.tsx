"use client";

import { useState } from "react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { joinWaitingList } from "@/app/actions/waiting-list";

interface WaitingListButtonProps {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
  waitingListEnabled: boolean;
  isOnWaitingList: boolean;
  isApproved: boolean;
  size?: "default" | "sm" | "lg";
}

export function WaitingListButton({
  isSignedIn,
  signInAction,
  waitingListEnabled,
  isOnWaitingList,
  isApproved,
  size = "lg",
}: WaitingListButtonProps) {
  const t = useExtracted();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Always show dashboard link if already signed in
  if (isSignedIn) {
    return (
      <Button asChild size={size}>
        <Link href="/dashboard">{t("Go to Dashboard")}</Link>
      </Button>
    );
  }

  // Show sign in if: waiting list feature is off, or the user is approved
  if (!waitingListEnabled || (isOnWaitingList && isApproved)) {
    return (
      <form action={signInAction}>
        <Button size={size} type="submit">
          {t("Get Started")}
        </Button>
      </form>
    );
  }

  // User is on the list but not yet approved
  if (isOnWaitingList && !isApproved) {
    return (
      <Button size={size} variant="secondary" disabled>
        {t("You're on the waiting list")}
      </Button>
    );
  }

  // Waiting list enabled and user hasn't joined yet
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await joinWaitingList(email);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
    } else {
      setError(result.error ?? t("Something went wrong."));
      setLoading(false);
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        {t("Join Waiting List")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Join the waiting list")}</DialogTitle>
            <DialogDescription>
              {t(
                "Enter your email address and we'll let you know when you get access.",
              )}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("You're on the list! We'll be in touch soon.")}
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-3 pb-4">
                <div className="space-y-1">
                  <Label htmlFor="wl-email">{t("Email address")}</Label>
                  <Input
                    id="wl-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  {t("Cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t("Joining…") : t("Join")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
