import { AppWindow, FileText, Globe, Subtitles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimateOnScroll } from "./animate-on-scroll";

const formats = [
  {
    icon: AppWindow,
    name: "Xcode Localization",
    extensions: [".xcloc"],
    description:
      "Apple's localization export format containing XLIFF translations. Ship your iOS, macOS, and visionOS apps in every language.",
  },
  {
    icon: Subtitles,
    name: "SubRip Subtitles",
    extensions: [".srt"],
    description:
      "Timestamp-based subtitle files for video content and lyrics. AI preserves tone, rhyme, and readability.",
  },
  {
    icon: Globe,
    name: "GNU gettext",
    extensions: [".po"],
    description:
      "Industry-standard format for app and website localization used by thousands of open-source projects.",
  },
  {
    icon: FileText,
    name: "Documents",
    extensions: [".txt", ".md", ".docx"],
    description:
      "Plain text, Markdown, and Word documents. From READMEs to full manuscripts — translate any written content.",
  },
];

export function FormatShowcase() {
  return (
    <section className="border-t border-border bg-muted/40 px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Supported formats
          </h2>
          <p className="mt-3 text-muted-foreground">
            From app developer to content creator, we have you covered
          </p>
        </AnimateOnScroll>

        <div className="mt-12 grid gap-4 scroll-stagger">
          {formats.map((fmt) => (
            <AnimateOnScroll key={fmt.name} variant="left">
              <div className="flex items-start gap-4 border border-border bg-background p-5">
                <div className="flex size-10 shrink-0 items-center justify-center bg-primary/10">
                  <fmt.icon className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{fmt.name}</h3>
                    {fmt.extensions.map((ext) => (
                      <Badge key={ext} variant="outline" className="text-xs">
                        {ext}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fmt.description}
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
