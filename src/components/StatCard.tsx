import { ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  color: string;
  colorDark: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, trend, color, colorDark, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm shadow-black/10"
        style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})` }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-4 text-sm font-medium text-[#475569]">{title}</p>
      <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{value}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {trend ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#22C55E]">
            <ArrowUp className="h-3 w-3" />
            {trend}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[#64748B]">
            <Minus className="h-3 w-3" /> No change this month
          </span>
        )}
      </div>
    </div>
  );
}
