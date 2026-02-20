import { Download, Sparkles, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimateOnScroll } from "./animate-on-scroll";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description:
      "Drop your translation files in any supported format — Xcode catalogs, subtitles, PO files, or documents.",
  },
  {
    icon: Sparkles,
    title: "Translate",
    description:
      "AI translates with full context awareness, respecting your terminology glossary and maintaining consistency.",
  },
  {
    icon: Download,
    title: "Download",
    description:
      "Export your translated files in their original format, ready to use in your project.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-muted/40 px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps from source to translated files
          </p>
        </AnimateOnScroll>

        <div className="mt-12 grid gap-6 md:grid-cols-3 scroll-stagger">
          {steps.map((step) => (
            <AnimateOnScroll key={step.title}>
              <Card className="h-full">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center bg-primary/10">
                    <step.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
