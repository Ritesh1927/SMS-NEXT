/**
 * Design.md §21 "house style" for status pills: a 10%-opacity fill, full-strength
 * text, and a 20%-opacity border of one semantic token — never a solid fill.
 * Centralized here so every status/fee/attendance pill in the app stays in sync.
 */
const TONE_CLASSES = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export type StatusTone = keyof typeof TONE_CLASSES;

/** Full className for a status pill span — rounded-full border px-2.5 py-0.5 text-xs font-semibold, tinted per tone. */
export function statusPillClass(tone: StatusTone): string {
  return `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`;
}
