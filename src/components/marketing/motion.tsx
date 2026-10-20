"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Client-only motion helpers: scroll reveal and count-up. Both respect
// prefers-reduced-motion.

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Calls back once when the element first scrolls into view. */
function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

/** Fade-up on first scroll into view. Content is visible without JS (no-JS / reduced motion). */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" | "section" }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration flag: animate only after mount so SSR/no-JS renders visible content
  useEffect(() => setMounted(true), []);
  // Before hydration everything renders visible (SEO / no-JS); after
  // mount, off-screen blocks start hidden and animate in.
  const hidden = mounted && !reduced && !inView;
  const style: CSSProperties = {
    transitionDelay: inView ? `${delay}ms` : "0ms",
  };
  return (
    <Tag
      ref={ref as never}
      style={style}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        hidden ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Animated number that counts up when scrolled into view. */
export function CountUp({ to, duration = 1600, className }: { to: number; duration?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(to);
  // A ref, not state: flipping it must not re-run (and cancel) the animation.
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current || reduced) return;
    started.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Unmounted mid-count: show the final number rather than a partial one.
      setValue(to);
    };
  }, [inView, reduced, to, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value.toLocaleString("en-IN")}
    </span>
  );
}
