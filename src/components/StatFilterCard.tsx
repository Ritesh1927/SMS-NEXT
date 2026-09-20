import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatFilterCardProps {
  icon: LucideIcon;
  color: string;
  colorDark: string;
  value: number | string;
  label: string;
  sublabel?: string;
  active?: boolean;
  onClick?: () => void;
}

// Reusable enriched stat card for list pages (Students, Staff, ...): a
// gradient icon chip with colored glow, a large low-opacity watermark icon,
// a gradient tint + colored outline when it doubles as an active filter
// toggle, and a sliding colored accent bar on hover. Pass onClick to make it
// an interactive filter button; omit it for a purely informational card.
export function StatFilterCard({ icon: Icon, color, colorDark, value, label, sublabel, active = false, onClick }: StatFilterCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative text-left overflow-hidden rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 ${onClick ? "hover:-translate-y-1 cursor-pointer" : ""}`}
      style={{
        background: active ? `linear-gradient(160deg, ${color}14, ${color}05 55%, transparent)` : undefined,
        boxShadow: active ? `0 0 0 1.5px ${color}, 0 12px 24px -14px ${color}66` : undefined,
      }}
    >
      <Icon
        className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rotate-[-12deg] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
        style={{ color, opacity: 0.07 }}
      />
      <div className="relative flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})`, boxShadow: `0 8px 18px -6px ${color}80, inset 0 1px 0 rgba(255,255,255,0.25)` }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        {onClick && (
          <ArrowUpRight
            className={active ? "h-4 w-4 transition-colors" : "h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground"}
            style={active ? { color } : undefined}
          />
        )}
      </div>
      <p className="relative mt-4 text-[28px] font-bold leading-none text-foreground">{value}</p>
      <p className="relative mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      {sublabel && <p className="relative mt-2 text-xs text-muted-foreground">{sublabel}</p>}
      <div
        className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${color}, ${colorDark})`, transformOrigin: "left" }}
      />
    </Wrapper>
  );
}
