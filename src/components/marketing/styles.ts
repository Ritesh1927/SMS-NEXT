import type { Tone } from "./content";

// Homepage design tokens (plain constants -- safe for server and client).
// Colours come from the ERP's own theme (globals.css), so the website and
// the product share one brand: --primary indigo for buttons, links and
// highlights; --accent violet for gradients and glows; foreground /
// muted-foreground for text; success / warning / destructive / coral for
// status and accents.

export const BTN_PRIMARY =
  "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(110deg,var(--primary),var(--accent)_45%,var(--primary))] bg-[length:200%_100%] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(80,72,229,0.65)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-[position:100%_0] hover:shadow-[0_18px_40px_-12px_rgba(80,72,229,0.75)] focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none active:translate-y-0";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-semibold text-foreground shadow-[0_6px_20px_-10px_rgba(16,24,40,0.25)] ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:ring-primary/60 focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none";

export const CARD = "rounded-[22px] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_40px_-24px_rgba(80,72,229,0.28)] ring-1 ring-foreground/[0.06]";

/** Gradient icon chip + soft card wash per tone. */
export const TONES: Record<Tone, { icon: string; soft: string; text: string }> = {
  blue: { icon: "from-primary to-accent", soft: "from-primary/12", text: "text-primary" },
  sky: { icon: "from-accent to-[#B49BFA]", soft: "from-accent/15", text: "text-primary" },
  amber: { icon: "from-[#F59E0B] to-warning", soft: "from-warning/18", text: "text-[#B45309]" },
  green: { icon: "from-[#16A34A] to-[#4ADE80]", soft: "from-success/12", text: "text-success" },
  violet: { icon: "from-[#7C3AED] to-[#A78BFA]", soft: "from-[#A78BFA]/15", text: "text-[#6D28D9]" },
  rose: { icon: "from-[#E11D48] to-[#FB7185]", soft: "from-[#FB7185]/14", text: "text-[#BE123C]" },
  teal: { icon: "from-[#0D9488] to-[#2DD4BF]", soft: "from-[#2DD4BF]/14", text: "text-[#0F766E]" },
  indigo: { icon: "from-[#4F46E5] to-[#818CF8]", soft: "from-[#818CF8]/15", text: "text-[#4338CA]" },
};
