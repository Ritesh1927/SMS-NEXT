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
      className={`flex flex-col items-center justify-center gap-4 ${fullScreen ? "min-h-screen" : compact ? "min-h-[220px] py-10" : "min-h-[65vh]"} ${dark ? "bg-foreground" : ""}`}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute h-16 w-16 rounded-full bg-brand-gradient opacity-30 blur-xl animate-orb-breathe" />
        <div className="absolute h-16 w-16 rounded-2xl border-2 border-transparent border-t-primary border-r-accent animate-spin" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-primary/30">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-extrabold tracking-tight text-brand-gradient">EduNivo</span>
        {label && <span className={`text-xs ${dark ? "text-white/60" : "text-muted-foreground"}`}>{label}</span>}
      </div>
    </div>
  );
}
