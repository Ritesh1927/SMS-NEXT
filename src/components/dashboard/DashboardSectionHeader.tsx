import { MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ICON_PRESETS = {
  blue: { from: "#EEF4FF", to: "#DCEBFF", iconColor: "#4F46E5", tint: "rgba(79,70,229,0.05)", dark: "linear-gradient(135deg, #2F3FA8, #25328D)" },
  green: { from: "#ECFDF5", to: "#DCFCE7", iconColor: "#16A34A", tint: "rgba(22,163,74,0.05)", dark: "linear-gradient(135deg, #0F766E, #115E59)" },
  purple: { from: "#F3E8FF", to: "#EDE9FE", iconColor: "#8B5CF6", tint: "rgba(139,92,246,0.05)", dark: "linear-gradient(135deg, #4C1D95, #3B0764)" },
  orange: { from: "#FFF7ED", to: "#FED7AA", iconColor: "#EA580C", tint: "rgba(234,88,12,0.05)", dark: "linear-gradient(135deg, #92400E, #78350F)" },
} as const;

export type SectionHeaderAccent = keyof typeof ICON_PRESETS;
export type SectionHeaderVariant = "light" | "dark";

interface DashboardSectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: SectionHeaderAccent;
  variant?: SectionHeaderVariant;
  badge?: string;
  decoration?: ReactNode;
  rightAction?: ReactNode;
  showMoreMenu?: boolean;
  className?: string;
}

// Compact, reusable header for dashboard cards -- icon chip, title/subtitle,
// optional status badge, and right-side controls. `variant="dark"` renders a
// full-bleed gradient banner meant to sit flush at the top of a card whose
// parent supplies the rounded corners/border/shadow (analytics charts,
// Recent Activities, Upcoming Events); `variant="light"` (default) renders
// as its own inset sub-card.
export function DashboardSectionHeader({
  icon: Icon,
  title,
  subtitle,
  accent = "blue",
  variant = "light",
  badge,
  decoration,
  rightAction,
  showMoreMenu = false,
  className,
}: DashboardSectionHeaderProps) {
  const { from, to, iconColor, tint, dark } = ICON_PRESETS[accent];
  const isDark = variant === "dark";

  return (
    <div className={cn(!isDark && "mb-4", className)}>
      <div
        className={cn(
          "relative flex items-center gap-3 overflow-hidden transition-shadow duration-300",
          isDark ? "px-5 py-[14px]" : "rounded-2xl px-4 py-3",
        )}
        style={
          isDark
            ? { background: dark, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }
            : {
                background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.4) 55%, #fff)`,
                border: "1px solid rgba(148,163,184,0.12)",
                boxShadow: "0 6px 20px -14px rgba(15,23,42,0.12)",
              }
        }
      >
        <div
          className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden", isDark ? "rounded-2xl" : "rounded-xl")}
          style={
            isDark
              ? { background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))", boxShadow: "0 4px 14px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)" }
              : { background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 2px 10px -3px ${iconColor}40` }
          }
        >
          {!isDark && <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent" />}
          <Icon className="relative h-5 w-5" style={{ color: isDark ? "#fff" : iconColor }} />
        </div>

        <div className="relative flex min-w-0 flex-1 shrink-0 flex-col justify-center self-stretch">
          {decoration}
          <div className="relative z-10 flex items-center gap-1.5">
            <h3 className={cn("text-[16px] font-semibold leading-tight truncate font-heading", isDark ? "text-white" : "text-[#0F172A]")}>{title}</h3>
            {badge &&
              (isDark ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                  {badge}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-[3px] text-[10px] font-semibold text-[#16A34A]">
                  <span className="h-1 w-1 rounded-full bg-[#22C55E]" />
                  {badge}
                </span>
              ))}
          </div>
          {subtitle && <p className={cn("relative z-10 text-[12px] truncate mt-0.5 leading-tight", isDark ? "text-white/70" : "text-[#64748B]")}>{subtitle}</p>}
        </div>

        {(rightAction || showMoreMenu) && (
          <div className="relative flex shrink-0 items-center gap-1.5">
            {rightAction}
            {showMoreMenu && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
                  isDark ? "text-white/80" : "border border-[#E2E8F0] bg-white text-[#64748B]",
                )}
                style={isDark ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" } : undefined}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {isDark && <div className="h-px" style={{ background: "rgba(255,255,255,0.08)" }} />}
    </div>
  );
}

export function HeaderActionPill({ children, variant = "light" }: { children: ReactNode; variant?: SectionHeaderVariant }) {
  if (variant === "dark") {
    return (
      <div className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-white/25 bg-white/[0.12] px-3 text-[13px] font-medium text-white backdrop-blur-sm">
        {children}
      </div>
    );
  }
  return (
    <div className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-[#E2E8F0] bg-white px-3 text-[13px] font-medium text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {children}
    </div>
  );
}

export function HeaderBarsGlyph({ color = "#ffffff", opacity = 0.18 }: { color?: string; opacity?: number }) {
  const heights = [38, 55, 46, 72, 88];
  return (
    <div className="pointer-events-none absolute -bottom-3.5 right-1 z-0 flex h-11 items-end gap-1" aria-hidden="true">
      {heights.map((h, i) => (
        <div key={i} className="w-2 rounded-t-sm" style={{ height: `${h}%`, background: color, opacity }} />
      ))}
    </div>
  );
}

export function HeaderWaveGlyph({ color = "#ffffff", opacity = 0.2 }: { color?: string; opacity?: number }) {
  return (
    <svg className="pointer-events-none absolute -bottom-3.5 right-1 z-0 h-11 w-24" viewBox="0 0 96 44" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 32 Q 16 8, 32 26 T 64 22 T 96 4" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity={opacity} />
    </svg>
  );
}

export function HeaderPulseGlyph({ color = "#ffffff", opacity = 0.2 }: { color?: string; opacity?: number }) {
  return (
    <svg className="pointer-events-none absolute -bottom-3.5 right-1 z-0 h-11 w-28" viewBox="0 0 112 44" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 26 H22 L30 8 L38 38 L46 18 L52 26 H68 L76 4 L84 34 L90 26 H112" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </svg>
  );
}

export function HeaderDotGridGlyph({ color = "#ffffff", opacity = 0.22 }: { color?: string; opacity?: number }) {
  const rows = [0.5, 0.75, 1, 0.75, 0.5];
  return (
    <div className="pointer-events-none absolute -bottom-3.5 right-1 z-0 grid grid-cols-5 gap-1.5" aria-hidden="true">
      {rows.map((rowOpacity, row) =>
        [0, 1, 2].map((col) => (
          <div key={`${row}-${col}`} className="h-1.5 w-1.5 rounded-full" style={{ gridColumn: row + 1, gridRow: col + 1, background: color, opacity: opacity * rowOpacity }} />
        )),
      )}
    </div>
  );
}
