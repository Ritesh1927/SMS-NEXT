import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./content";
import { TONES } from "./styles";
import { Reveal } from "./motion";

// Server-safe presentational pieces for the homepage.

export function GradientIcon({ tone, children, size = "md" }: { tone: Tone; children: ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-lg ring-1 ring-white/40",
        TONES[tone].icon,
        size === "sm" ? "h-9 w-9 rounded-xl" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-2xl",
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/30 to-transparent" aria-hidden />
      <span className="relative">{children}</span>
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-primary/12 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary ring-1 ring-primary/25", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  );
}

/** Brand gradient text (dark enough to stay readable). */
export function GradientText({ children }: { children: ReactNode }) {
  return <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{children}</span>;
}

export function SectionHeading({
  eyebrow, title, description, align = "center", className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-heading text-[30px] leading-[1.15] font-extrabold tracking-tight text-foreground sm:text-[40px]">{title}</h2>
      {description && <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">{description}</p>}
    </Reveal>
  );
}
