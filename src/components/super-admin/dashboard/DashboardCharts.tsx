"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Dashboard charts. Each is a single series, so one brand hue (theme
// tokens -> correct in light and dark), no legend (the panel title names
// it), hover tooltips, recessive grid/axes, and a visually hidden table
// with the same numbers for screen readers.

const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-[12px] shadow-lg ring-1 ring-border">
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-[15px] font-bold text-foreground tabular-nums">
        {payload[0].value} <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function SrTable({ caption, rows, valueLabel }: { caption: string; rows: { label: string; value: number }[]; valueLabel: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Label</th><th scope="col">{valueLabel}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td></tr>)}</tbody>
    </table>
  );
}

/** New schools per month (trend over time -> single-series area). */
export function RegistrationsChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="sa-reg-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip unit="new schools" />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#sa-reg-fill)"
              activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption="New schools per month" rows={data} valueLabel="New schools" />
    </>
  );
}

/** Schools per plan (compare magnitude -> horizontal bars, one hue). */
export function PlansChart({ data }: { data: { label: string; value: number }[] }) {
  const height = Math.max(160, data.length * 44);
  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={96} />
            <Tooltip content={<ChartTooltip unit="schools" />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
            <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption="Schools per plan" rows={data} valueLabel="Schools" />
    </>
  );
}
