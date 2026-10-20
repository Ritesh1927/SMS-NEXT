"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BRAND, NAV_LINKS } from "./content";
import { BTN_PRIMARY } from "./styles";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="#home" className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-primary/40" aria-label={`${BRAND.name} home`}>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-[0_8px_20px_-6px_rgba(80,72,229,0.6)]">
        <GraduationCap className="h-5.5 w-5.5 text-white" />
      </span>
      <span className="leading-none">
        <span className={cn("block font-heading text-[20px] font-extrabold tracking-tight", light ? "text-white" : "text-foreground")}>{BRAND.name}</span>
        <span className={cn("block text-[10.5px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase", light ? "text-white/60" : "text-muted-foreground")}>{BRAND.tagline}</span>
      </span>
    </Link>
  );
}

/** Sticky header: transparent over the hero, white + blur once scrolled. Highlights the section in view. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("#home");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const sections = NAV_LINKS.map((l) => document.querySelector(l.href)).filter((el): el is Element => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "bg-white/80 shadow-[0_8px_30px_-18px_rgba(16,24,40,0.25)] backdrop-blur-xl backdrop-saturate-150" : "bg-transparent",
      )}
    >
      <div className={cn("mx-auto flex max-w-7xl items-center gap-6 px-5 transition-[height] duration-300 lg:px-8", scrolled ? "h-[68px]" : "h-20")}>
        <Logo />

        <nav aria-label="Primary" className="mx-auto hidden items-center gap-0.5 xl:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={active === l.href ? "true" : undefined}
              className={cn(
                "relative rounded-full px-3 py-2 text-[14px] font-medium whitespace-nowrap transition-colors 2xl:px-3.5 outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
                active === l.href ? "text-primary" : "text-foreground/80 hover:text-foreground",
              )}
            >
              {l.label}
              <span className={cn("absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary to-accent transition-transform duration-300", active === l.href ? "scale-x-100" : "scale-x-0")} aria-hidden />
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2.5 sm:flex xl:ml-0">
          <Link href="/login" className="rounded-2xl px-4 py-2.5 text-[14.5px] font-semibold whitespace-nowrap text-primary ring-1 ring-primary/25 transition-colors hover:bg-primary/10">
            Login
          </Link>
          <a href="#contact" className={cn(BTN_PRIMARY, "px-5 py-2.5 text-[14.5px] whitespace-nowrap")}>
            Book Demo
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground ring-1 ring-foreground/10 transition hover:bg-white sm:ml-0 xl:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" showCloseButton={false} className="w-[86vw] max-w-sm gap-0 border-none bg-white p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-20 items-center justify-between border-b border-foreground/[0.06] px-5">
            <Logo />
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-[#F8F8FE]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={cn("rounded-xl px-4 py-3 text-[15.5px] font-semibold transition-colors", active === l.href ? "bg-primary/12 text-primary" : "text-foreground hover:bg-[#F8F8FE]")}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto space-y-2.5 border-t border-foreground/[0.06] p-5">
            <Link href="/login" className="flex w-full items-center justify-center rounded-2xl py-3 text-[15px] font-semibold text-primary ring-1 ring-primary/25">
              Login
            </Link>
            <a href="#contact" onClick={() => setMenuOpen(false)} className={cn(BTN_PRIMARY, "w-full")}>
              Book Demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
