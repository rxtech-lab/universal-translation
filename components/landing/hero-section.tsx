import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formats = [".xcloc", ".srt", ".po", ".txt", ".md", ".docx"];

export function HeroSection({
  isSignedIn,
  signInAction,
}: {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
}) {
  return (
    <section className="flex flex-col items-center px-6 py-24 md:py-40">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both text-5xl font-bold tracking-tight md:text-7xl">
          Translate anything,{" "}
          <span className="text-primary">powered by AI</span>
        </h1>

        <p className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          From Xcode localization catalogs to subtitles and documents. Upload
          your files, get context-aware translations with terminology
          consistency.
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both mt-8 flex items-center justify-center gap-3">
          {isSignedIn ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <form action={signInAction}>
              <Button size="lg" type="submit">
                Get Started
              </Button>
            </form>
          )}
          <Button variant="outline" size="lg" asChild>
            <a href="#features">Learn More</a>
          </Button>
        </div>

        <div className="animate-in fade-in duration-500 delay-500 fill-mode-both mt-10 flex flex-wrap items-center justify-center gap-2">
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
