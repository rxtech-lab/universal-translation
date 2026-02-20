import { cn } from "@/lib/utils";

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  /** "up" (default) fades up; "left" slides in from the left */
  variant?: "up" | "left";
}

export function AnimateOnScroll({
  children,
  className,
  variant = "up",
}: AnimateOnScrollProps) {
  return (
    <div
      className={cn(
        variant === "left" ? "scroll-reveal-left" : "scroll-reveal",
        className,
      )}
    >
      {children}
    </div>
  );
}
