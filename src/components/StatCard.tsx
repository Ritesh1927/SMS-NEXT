import { ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  color: string;
  colorDark: string;
  icon: LucideIcon;
  sparkline?: number[];
}

export function StatCard({ title, value, trend, color, colorDark, icon: Icon, sparkline }: StatCardProps) {
  const hasSparkline = sparkline && sparkline.length > 1 && sparkline.some((v) => v > 0);

  return (
    <div className="rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm shadow-black/10"
        style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})` }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-[28px] font-bold leading-none text-foreground">{value}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {trend ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <ArrowUp className="h-3 w-3" />
            {trend}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Minus className="h-3 w-3" /> No change this month
          </span>
        )}
      </div>
      {hasSparkline && (
        <div className="-mx-1 -mb-1 mt-2 h-9">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${title.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${title.replace(/\s+/g, "")})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
