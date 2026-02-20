import { LanguageMorph } from "@/components/landing/language-morph";
import { ParticleCanvas } from "@/components/landing/particle-canvas";
import { WaitingListButton } from "@/components/landing/waiting-list-button";

export function HeroSection({
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
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <ParticleCanvas />
      <div className="hero-gradient" aria-hidden="true">
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="hero-blob hero-blob-3" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-10 text-center">
        <p className="hero-reveal hero-delay-0 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Universal Translation
        </p>

        <h1 className="hero-reveal hero-delay-0 text-4xl font-bold tracking-tight md:text-5xl">
          Every language. One click.
        </h1>

        <div className="hero-reveal hero-delay-1">
          <LanguageMorph />
        </div>

        <p className="hero-reveal hero-delay-2 text-sm font-light tracking-widest text-muted-foreground uppercase">
          Upload. Translate. Done.
        </p>

        <div className="hero-reveal hero-delay-3">
          <WaitingListButton
            isSignedIn={isSignedIn}
            signInAction={signInAction}
            waitingListEnabled={waitingListEnabled}
            isOnWaitingList={isOnWaitingList}
            isApproved={isApproved}
          />
        </div>
      </div>
    </section>
  );
}
