import {
  BookOpen,
  Captions,
  Cloud,
  Files,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const features = [
  {
    icon: Files,
    title: "Multi-Format Support",
    description:
      "From Xcode .xcloc catalogs to .srt subtitles, .po gettext files, and .docx documents. One platform handles them all.",
    span: "md:col-span-2",
  },
  {
    icon: Sparkles,
    title: "LLM-Powered Translation",
    description:
      "Advanced language models produce natural, contextually accurate translations that read like they were written by a native speaker.",
    span: "",
  },
  {
    icon: ScanSearch,
    title: "Context Awareness",
    description:
      "The AI reads surrounding entries for context, producing translations that fit naturally within the full document.",
    span: "",
  },
  {
    icon: BookOpen,
    title: "Terminology Consistency",
    description:
      "Define your glossary once. Brand names, technical terms, and proper nouns stay consistent across every translation.",
    span: "md:col-span-2",
  },
  {
    icon: Cloud,
    title: "Cloud Save",
    description:
      "Projects are saved automatically. Pick up where you left off, from any device, at any time.",
    span: "",
  },
  {
    icon: Captions,
    title: "Subtitle Intelligence",
    description:
      "Specialized handling for subtitles and lyrics — preserves timing, tone, rhyme, and readability for spoken dialogue.",
    span: "md:col-span-2",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="relative px-6 py-28 md:py-40">
      {/* Subtle top/bottom gradient dividers instead of hard borders */}
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
            Capabilities
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            Built for developers, translators, and content creators
          </p>
        </AnimateOnScroll>

        <div className="mt-16 grid gap-4 md:grid-cols-3 scroll-stagger">
          {features.map((feature) => (
            <AnimateOnScroll key={feature.title} className={feature.span}>
              <div className="bento-card group relative flex h-full flex-col justify-between overflow-hidden border border-border bg-card p-8 transition-colors hover:bg-accent/50">
                <div>
                  <div className="mb-5 flex size-10 items-center justify-center bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
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
