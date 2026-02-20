"use client";

import { useEffect, useState } from "react";

const translations = [
  { word: "Hello", lang: "English" },
  { word: "Hola", lang: "Spanish" },
  { word: "こんにちは", lang: "Japanese" },
  { word: "Bonjour", lang: "French" },
  { word: "你好", lang: "Chinese" },
  { word: "안녕하세요", lang: "Korean" },
  { word: "Ciao", lang: "Italian" },
  { word: "Привет", lang: "Russian" },
];

export function LanguageMorph() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % translations.length);
        setVisible(true);
      }, 500);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const { word, lang } = translations[index];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[1.2em] overflow-hidden text-7xl font-bold tracking-tight md:text-9xl">
        <span
          className="morph-word inline-block text-primary"
          data-visible={visible}
        >
          {word}
        </span>
      </div>
      <span
        className="morph-lang text-sm tracking-widest text-muted-foreground uppercase"
        data-visible={visible}
      >
        {lang}
      </span>
    </div>
  );
}
