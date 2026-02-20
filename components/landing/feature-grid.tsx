"use client";

import {
  BookOpen,
  Captions,
  Cloud,
  Files,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimateOnScroll } from "./animate-on-scroll";

const features = [
  {
    icon: Files,
    title: "Multi-Format Support",
    description:
      "From Xcode .xcloc catalogs to .srt subtitles, .po gettext files, and .docx documents. One platform handles them all.",
  },
  {
    icon: Sparkles,
    title: "LLM-Powered Translation",
    description:
      "Advanced language models produce natural, contextually accurate translations that read like they were written by a native speaker.",
  },
  {
    icon: BookOpen,
    title: "Terminology Consistency",
    description:
      "Define your glossary once. Brand names, technical terms, and proper nouns stay consistent across every translation.",
  },
  {
    icon: ScanSearch,
    title: "Context Awareness",
    description:
      "The AI reads surrounding entries for context, producing translations that fit naturally within the full document.",
  },
  {
    icon: Cloud,
    title: "Cloud Save",
    description:
      "Projects are saved automatically. Pick up where you left off, from any device, at any time.",
  },
  {
    icon: Captions,
    title: "Subtitle Intelligence",
    description:
      "Specialized handling for subtitles and lyrics — preserves timing, tone, rhyme, and readability for spoken dialogue.",
  },
];

const delays = [
  "delay-0",
  "delay-100",
  "delay-200",
  "delay-300",
  "delay-400",
  "delay-500",
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need for translation
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built for developers, translators, and content creators
          </p>
        </AnimateOnScroll>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <AnimateOnScroll key={feature.title} delay={delays[i]}>
              <Card className="h-full">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
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
