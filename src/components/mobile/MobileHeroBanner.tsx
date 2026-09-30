import Image from "next/image";
import { CalendarDays, Quote } from "lucide-react";
import schoolIllustration from "@/assets/inner-banner.png";

// Mobile-only stacked layout for the dashboard hero -- same greeting, quote
// and date as the desktop DashboardHero, just reflowed top-to-bottom so
// nothing gets cramped or clipped at phone widths. Rendered by
// DashboardHero itself (lg:hidden sibling of the desktop markup), so it
// never mounts on desktop and never touches desktop layout.
export function MobileHeroBanner({
  greeting,
  name,
  subtitle,
  quote,
}: {
  greeting: string;
  name: string;
  subtitle: string;
  quote: { text: string; author: string };
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-white">
      <div className="relative h-28 w-full">
        <Image src={schoolIllustration} alt="" fill className="object-cover object-right" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 px-4 pt-3">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          {greeting}, <span className="text-primary">{name}</span>
        </h1>
        <p className="mt-1 text-[13px] font-medium leading-snug text-muted-foreground">{subtitle}</p>

        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/50 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(79,70,229,0.14)] backdrop-blur-md">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-primary/15 text-primary" />
          <p className="text-[13px] italic leading-snug text-foreground/90" style={{ fontFamily: "var(--font-lora)" }}>
            {quote.text}
            <span className="mt-1 block text-[11px] font-sans font-normal not-italic text-muted-foreground">— {quote.author}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
