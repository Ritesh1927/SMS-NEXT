"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Quote } from "lucide-react";
import schoolIllustration from "@/assets/inner-banner.png";
import { MobileHeroBanner } from "@/components/mobile/MobileHeroBanner";

const QUOTES: { text: string; author: string }[] = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Intelligence plus character — that is the goal of true education.", author: "Martin Luther King Jr." },
  { text: "Teaching is the one profession that creates all other professions.", author: "Unknown" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// Shared hero banner for every role's dashboard Overview — school admin
// originally had this to itself; teacher and parent get the identical
// treatment (same illustration, quote rotation, date pill), just with a
// role-appropriate name and subtitle passed in.
export function DashboardHero({ name, subtitle }: { name: string; subtitle: string }) {
  // Snapshot once on mount rather than calling Date.now() during render (impure).
  const [quoteIndex] = useState(() => Math.floor(Date.now() / 86400000) % QUOTES.length);
  const quote = QUOTES[quoteIndex];

  return (
    <>
      {/* Desktop/tablet hero (≥768px) -- unchanged from before the mobile
          layer was added; just gated behind `hidden md:block` so it and the
          mobile banner below never render at the same time. */}
      <div className="hidden md:block relative overflow-hidden rounded-[22px] border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-white">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

        <div className="hidden sm:block pointer-events-none absolute inset-0">
          <Image
            src={schoolIllustration}
            alt=""
            fill
            className="object-cover object-right"
            priority
          />
        </div>
        <div className="hidden sm:block pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/75 to-white/10" />

        <div className="relative z-10 flex min-h-[230px] sm:min-h-[250px] flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-foreground">
              {getGreeting()}, <span className="text-primary">{name}</span>
            </h1>
            <p className="text-sm sm:text-[15px] font-medium text-muted-foreground mt-1.5">{subtitle}</p>
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-white/40 backdrop-blur-md shadow-[0_4px_20px_rgba(79,70,229,0.18)] px-4 py-3 max-w-md">
              <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5 fill-primary/15" />
              <p className="text-[15px] italic text-foreground/90 leading-snug" style={{ fontFamily: "var(--font-lora)" }}>
                {quote.text}
                <span className="block text-xs not-italic font-sans font-normal text-muted-foreground mt-1.5">— {quote.author}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/20 backdrop-blur-md px-4 py-2.5 border border-white/50 shadow-[0_4px_20px_rgba(79,70,229,0.12)] shrink-0 self-start">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile hero (<768px) -- separate component, own stacked layout. */}
      <div className="md:hidden">
        <MobileHeroBanner greeting={getGreeting()} name={name} subtitle={subtitle} quote={quote} />
      </div>
    </>
  );
}
