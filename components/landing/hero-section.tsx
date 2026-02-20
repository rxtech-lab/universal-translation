import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WaitingListButton } from "@/components/landing/waiting-list-button";

const formats = [".xcloc", ".srt", ".po", ".txt", ".md", ".docx"];

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
    <section className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="hero-reveal hero-delay-0 text-5xl font-bold tracking-tight md:text-7xl">
          Translate anything,{" "}
          <span className="text-primary">powered by AI</span>
        </h1>

        <p className="hero-reveal hero-delay-1 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          From Xcode localization catalogs to subtitles and documents. Upload
          your files, get context-aware translations with terminology
          consistency.
        </p>

        <div className="hero-reveal hero-delay-2 mt-8 flex items-center justify-center gap-3">
          <WaitingListButton
            isSignedIn={isSignedIn}
            signInAction={signInAction}
            waitingListEnabled={waitingListEnabled}
            isOnWaitingList={isOnWaitingList}
            isApproved={isApproved}
          />
          <Button variant="outline" size="lg" asChild>
            <a href="#features">Learn More</a>
          </Button>
        </div>

        <div className="hero-reveal hero-delay-3 mt-10 flex flex-wrap items-center justify-center gap-2">
          {formats.map((fmt) => (
            <Badge key={fmt} variant="secondary" className="text-xs">
              {fmt}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
