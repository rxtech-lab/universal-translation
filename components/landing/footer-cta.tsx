import { getExtracted } from "next-intl/server";
import { WaitingListButton } from "./waiting-list-button";
import { AnimateOnScroll } from "./animate-on-scroll";

export async function FooterCta({
  isSignedIn,
  signInAction,
  waitingListEnabled,
  isOnWaitingList,
  isApproved,
}: {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
  waitingListEnabled: boolean;
  isOnWaitingList: boolean;
  isApproved: boolean;
}) {
  const t = await getExtracted();

  return (
    <section className="relative overflow-hidden px-6 py-28 md:py-40">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.59 0.22 1 / 6%), transparent)",
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--color-border), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl">
        <AnimateOnScroll className="flex flex-col items-center text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {t("Ready to translate?")}
          </h2>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            {t(
              "Upload your first file and see AI-powered translation in action. No setup required.",
            )}
          </p>
          <div className="mt-10">
            <WaitingListButton
              isSignedIn={isSignedIn}
              signInAction={signInAction}
              waitingListEnabled={waitingListEnabled}
              isOnWaitingList={isOnWaitingList}
              isApproved={isApproved}
            />
          </div>
        </AnimateOnScroll>

        <div className="mt-28 text-center text-xs text-muted-foreground/60">
          {t("Built by RxLab")}
        </div>
      </div>
    </section>
  );
}
