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
// reads as "EduNivo is loading" rather than a generic stall.
export function PageLoader({ label, fullScreen = false, dark = false, compact = false }: PageLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? "gap-4" : "gap-6"} ${fullScreen ? "min-h-screen" : compact ? "min-h-[220px] py-10" : "min-h-[65vh]"} ${dark ? "bg-foreground" : ""}`}
    >
      <div className={`relative flex items-center justify-center ${compact ? "h-16 w-16" : "h-24 w-24"}`}>
        <div className={`absolute rounded-full bg-brand-gradient opacity-30 blur-xl animate-orb-breathe ${compact ? "h-16 w-16" : "h-24 w-24"}`} />
        <div className={`absolute rounded-2xl border-transparent border-t-primary border-r-accent animate-spin ${compact ? "h-16 w-16 border-2" : "h-24 w-24 border-[3px]"}`} />
        <div className={`relative flex items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-primary/30 ${compact ? "h-11 w-11" : "h-16 w-16"}`}>
          <GraduationCap className={compact ? "h-5 w-5 text-white" : "h-8 w-8 text-white"} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className={`font-extrabold tracking-tight text-brand-gradient ${compact ? "text-lg" : "text-3xl"}`}>EduNivo</span>
        {label && <span className={`${compact ? "text-xs" : "text-sm"} ${dark ? "text-white/60" : "text-muted-foreground"}`}>{label}</span>}
      </div>
    </div>
  );
}
