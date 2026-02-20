"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  animation?: string;
  threshold?: number;
  delay?: string;
}

export function AnimateOnScroll({
  children,
  className,
  animation = "animate-in fade-in slide-in-from-bottom-4",
  threshold = 0.1,
  delay,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={cn(
        isVisible
          ? cn(animation, delay, "duration-700 fill-mode-both")
          : "opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
