import { AnimateOnScroll } from "./animate-on-scroll";

const steps = [
  {
    number: "01",
    title: "Upload",
    description:
      "Drop your translation files in any supported format — Xcode catalogs, subtitles, PO files, or documents.",
  },
  {
    number: "02",
    title: "Translate",
    description:
      "AI translates with full context awareness, respecting your terminology glossary and maintaining consistency.",
  },
  {
    number: "03",
    title: "Download",
    description:
      "Export your translated files in their original format, ready to use in your project.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Simple workflow
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            How it works
          </h2>
        </AnimateOnScroll>

        <div className="mt-20 grid gap-8 md:grid-cols-3 md:gap-0 scroll-stagger">
          {steps.map((step) => (
            <AnimateOnScroll key={step.number}>
              <div className="flex flex-col items-center text-center md:px-8">
                <span className="text-5xl font-bold tracking-tighter text-primary/20 md:text-6xl">
                  {step.number}
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
