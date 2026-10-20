"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Quote, School, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQS, PARTNER_SCHOOLS, TESTIMONIALS } from "./content";
import { CARD } from "./styles";
import { GradientText, SectionHeading } from "./ui";
import { Reveal } from "./motion";

const AVATAR_TONES = ["from-primary to-accent", "from-[#7C3AED] to-[#A78BFA]", "from-[#F59E0B] to-warning", "from-[#16A34A] to-[#4ADE80]", "from-[#E11D48] to-[#FB7185]"];

/** Testimonial carousel: scroll-snap track, 3 / 2 / 1 cards per view, autoplay that pauses on hover/focus. */
export function Testimonials() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [perView, setPerView] = useState(1);

  const pages = Math.max(1, TESTIMONIALS.length - perView + 1);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0");
    track.scrollTo({ left: i * (card.offsetWidth + gap), behavior: "smooth" });
  }, []);

  // Track the visible card and how many fit, as the track scrolls / resizes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const card = track.children[0] as HTMLElement | undefined;
      if (!card) return;
      const gap = parseFloat(getComputedStyle(track).columnGap || "0");
      setIndex(Math.round(track.scrollLeft / (card.offsetWidth + gap)));
      setPerView(Math.max(1, Math.round((track.clientWidth + gap) / (card.offsetWidth + gap))));
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Autoplay (skipped for reduced motion).
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => goTo(index + 1 >= pages ? 0 : index + 1), 6000);
    return () => window.clearInterval(id);
  }, [paused, index, pages, goTo]);

  return (
    <section id="testimonials" className="relative scroll-mt-20 bg-[linear-gradient(180deg,#EFEFFD,#F8F8FE)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            align="left"
            eyebrow="What our clients say"
            title={<>Loved by <GradientText>Principals & Teachers</GradientText></>}
            description="Schools across India run their day on EduNivo. Here's what they say."
          />
          <div className="flex gap-2">
            <CarouselButton label="Previous testimonials" onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0}>
              <ChevronLeft className="h-5 w-5" />
            </CarouselButton>
            <CarouselButton label="Next testimonials" onClick={() => goTo(Math.min(pages - 1, index + 1))} disabled={index >= pages - 1}>
              <ChevronRight className="h-5 w-5" />
            </CarouselButton>
          </div>
        </div>

        <ul
          ref={trackRef}
          aria-label="Testimonials"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="-mx-5 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-6 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {TESTIMONIALS.map((t, i) => (
            <li key={t.name} className="w-[86%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]">
              <figure className={cn(CARD, "relative flex h-full flex-col p-7 transition-all duration-300 hover:-translate-y-1")}>
                <Quote className="absolute top-6 right-6 h-9 w-9 text-primary/20" aria-hidden />
                <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-4.5 w-4.5 fill-warning text-warning" aria-hidden />)}
                </div>
                <blockquote className="mt-4 flex-1 text-[15.5px] leading-relaxed text-foreground/80">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-foreground/[0.06] pt-5">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-heading text-[14px] font-bold text-white ring-4 ring-primary/15", AVATAR_TONES[i % AVATAR_TONES.length])}>
                    {t.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{t.name}</span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">{t.role}, {t.school}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex justify-center gap-2" role="tablist" aria-label="Choose testimonials">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={index === i}
              aria-label={`Show testimonials ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn("h-2 rounded-full transition-all duration-300", index === i ? "w-7 bg-primary" : "w-2 bg-primary/25 hover:bg-primary/45")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CarouselButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_-10px_rgba(16,24,40,0.3)] ring-1 ring-foreground/[0.08] transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-white disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Auto-scrolling partner logos (SAMPLE names -- see content.ts). */
export function TrustedBy() {
  const loop = [...PARTNER_SCHOOLS, ...PARTNER_SCHOOLS];
  return (
    <section aria-label="Trusted by schools" className="bg-white py-16">
      <Reveal className="mx-auto max-w-7xl px-5 text-center lg:px-8">
        <p className="font-heading text-[18px] font-bold text-foreground">Trusted by Schools Across India</p>
        <p className="mt-1 text-[14px] text-muted-foreground">From single campuses to multi-branch school groups</p>
      </Reveal>
      <div className="ms-marquee-wrap relative mt-9 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="ms-marquee flex w-max gap-4">
          {loop.map((name, i) => (
            <li key={`${name}-${i}`} aria-hidden={i >= PARTNER_SCHOOLS.length} className="flex shrink-0 items-center gap-3 rounded-2xl bg-[#F8F8FE] px-6 py-4 ring-1 ring-foreground/[0.05] grayscale transition hover:grayscale-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white"><School className="h-4.5 w-4.5" /></span>
              <span className="font-heading text-[15px] font-bold whitespace-nowrap text-foreground/80">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** FAQ accordion with smooth height animation; one open at a time. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative scroll-mt-20 bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <SectionHeading
          align="left"
          eyebrow="FAQ"
          title={<>Questions? <GradientText>Answered.</GradientText></>}
          description="Everything schools usually ask before switching to EduNivo. Can't find yours? Our team is a call away."
        />
        <Reveal>
          <ul className="space-y-3">
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q} className={cn(CARD, "overflow-hidden transition-shadow", isOpen && "shadow-[0_24px_44px_-26px_rgba(80,72,229,0.45)] ring-primary/35")}>
                  <h3>
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-heading text-[16.5px] font-bold text-foreground outline-none focus-visible:bg-[#F8F8FE]"
                    >
                      {f.q}
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors", isOpen ? "bg-primary text-white" : "bg-primary/12 text-primary")}>
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-a-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
