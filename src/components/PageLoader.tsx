import { GraduationCap } from "lucide-react";

interface PageLoaderProps {
  /** Optional line under the wordmark, e.g. "Loading dashboard...". */
  label?: string;
  /** Fills the viewport (route/auth gates) instead of just the content area. */
  fullScreen?: boolean;
  /** Dark-chrome variant for surfaces like the super-admin shell. */
  dark?: boolean;
  /** Smaller min-height for narrow/short panels (sidebar lists, split-view columns) instead of the ~viewport-height default. */
  compact?: boolean;
}

// The one branded loading state for the whole platform (Design.md: "one
// brand gradient, applied sparingly") -- every full-page or section loading
// gate should render this instead of a bare spinner, so a transition always
// reads as "EduNivo is loading" rather than a generic stall. The full
// treatment (orbiting satellites, a conic spinner ring, a shimmering
// wordmark, an indeterminate progress bar) is reserved for the
// default/fullScreen size; `compact` stays a lightweight version of the same
// motif for places this renders many times on one page (sidebar lists,
// split-view columns).
export function PageLoader({ label, fullScreen = false, dark = false, compact = false }: PageLoaderProps) {
  const ringMaskThickness = compact ? "2.5px" : "3.5px";

  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? "gap-2.5 py-6 min-h-[120px]" : "gap-7 min-h-[65vh]"} ${fullScreen ? "!min-h-screen" : ""} ${dark ? "bg-foreground" : ""}`}
    >
      <div className={`relative flex items-center justify-center ${compact ? "h-10 w-10" : "h-28 w-28"}`}>
        {/* Breathing glow behind everything else */}
        <div className={`absolute rounded-full bg-brand-gradient opacity-30 blur-xl animate-orb-breathe ${compact ? "h-10 w-10" : "h-32 w-32"}`} />

        {/* Two small satellites orbiting at different radii/speeds/directions */}
        {!compact && (
          <>
            <div className="absolute h-28 w-28 animate-spin [animation-duration:3s]">
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary" />
            </div>
            <div className="absolute h-[5.5rem] w-[5.5rem] animate-spin [animation-direction:reverse] [animation-duration:4s]">
              <span className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
            </div>
          </>
        )}

        {/* Smooth conic-gradient ring, replacing a flat two-tone border spin */}
        <div
          className={`absolute rounded-full animate-spin ${compact ? "h-10 w-10 [animation-duration:0.9s]" : "h-24 w-24 [animation-duration:1.3s]"}`}
          style={{
            background: "conic-gradient(from 0deg, transparent 0%, var(--color-primary) 55%, var(--color-accent) 80%, transparent 100%)",
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ringMaskThickness}), #000 calc(100% - ${ringMaskThickness}))`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${ringMaskThickness}), #000 calc(100% - ${ringMaskThickness}))`,
          }}
        />

        <div className={`relative flex items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-primary/30 ${compact ? "h-7 w-7" : "h-16 w-16 animate-icon-pulse"}`}>
          <GraduationCap className={compact ? "h-3.5 w-3.5 text-white" : "h-8 w-8 text-white"} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className={`font-extrabold tracking-tight ${compact ? "text-brand-gradient text-sm" : "text-shimmer text-3xl"}`}>EduNivo</span>
        {label && <span className={`${compact ? "text-[11px]" : "text-sm"} ${dark ? "text-white/60" : "text-muted-foreground"}`}>{label}</span>}
        {!compact && (
          <div className={`mt-1 h-1 w-36 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-muted"}`}>
            <div className="h-full w-1/3 rounded-full bg-brand-gradient animate-loading-bar" />
          </div>
        )}
      </div>
    </div>
  );
}
