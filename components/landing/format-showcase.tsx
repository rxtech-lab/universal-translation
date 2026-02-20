import { AppWindow, FileText, Globe, Subtitles } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const formats = [
  {
    icon: AppWindow,
    name: "Xcode Localization",
    extensions: [".xcloc"],
    description:
      "Ship your iOS, macOS, and visionOS apps in every language with Apple's native localization format.",
  },
  {
    icon: Subtitles,
    name: "SubRip Subtitles",
    extensions: [".srt"],
    description:
      "Timestamp-aware subtitle translation that preserves tone, rhyme, and readability.",
  },
  {
    icon: Globe,
    name: "GNU gettext",
    extensions: [".po"],
    description:
      "Industry-standard localization used by thousands of open-source projects.",
  },
  {
    icon: FileText,
    name: "Documents",
    extensions: [".txt", ".md", ".docx"],
    description:
      "From READMEs to manuscripts — translate any written content while preserving formatting.",
  },
];

export function FormatShowcase() {
  return (
    <section className="relative px-6 py-28 md:py-40">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--color-border), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            File formats
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Supports what you use
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            From app developer to content creator, we have you covered
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 scroll-stagger">
          {formats.map((fmt) => (
            <AnimateOnScroll key={fmt.name}>
              <div className="group relative flex h-full flex-col items-center border border-border bg-card p-8 text-center transition-colors hover:bg-accent/50">
                <div className="flex size-14 items-center justify-center bg-primary/10">
                  <fmt.icon className="size-6 text-primary" />
                </div>
                <h3 className="mt-5 text-sm font-semibold tracking-tight">
                  {fmt.name}
                </h3>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {fmt.extensions.map((ext) => (
                    <span
                      key={ext}
                      className="inline-block bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {fmt.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
