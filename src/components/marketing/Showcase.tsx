"use client";

import { useState } from "react";
import {
  BarChart3, Bell, BookOpen, CalendarCheck, Check, GraduationCap, IndianRupee, LayoutDashboard, MessageSquare, Settings, ShieldCheck, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOWCASE_POINTS } from "./content";
import { BTN_PRIMARY } from "./styles";
import { GradientText, SectionHeading } from "./ui";
import { Reveal } from "./motion";

// Product tour: an interactive dashboard inside a laptop. The numbers are
// illustrative UI, not customer data.

const TABS = {
  overview: {
    label: "Overview",
    kpis: [
      { label: "Total Students", value: "1,248", tone: "text-primary" },
      { label: "Teachers", value: "86", tone: "text-[#6D28D9]" },
      { label: "Fees Collected", value: "₹8.45L", tone: "text-success" },
      { label: "Pending Fees", value: "₹1.25L", tone: "text-[#BE123C]" },
    ],
    chartTitle: "Student attendance · this week",
    bars: [78, 92, 85, 96, 88, 94],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  fees: {
    label: "Fees",
    kpis: [
      { label: "Collected", value: "₹8.45L", tone: "text-success" },
      { label: "Due this month", value: "₹2.10L", tone: "text-[#B45309]" },
      { label: "Online payments", value: "74%", tone: "text-primary" },
      { label: "Defaulters", value: "23", tone: "text-[#BE123C]" },
    ],
    chartTitle: "Fee collection · last 6 months",
    bars: [55, 62, 70, 66, 84, 97],
    labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  },
  attendance: {
    label: "Attendance",
    kpis: [
      { label: "Present today", value: "1,203", tone: "text-success" },
      { label: "Absent", value: "45", tone: "text-[#BE123C]" },
      { label: "Late", value: "12", tone: "text-[#B45309]" },
      { label: "Avg. this term", value: "94.6%", tone: "text-primary" },
    ],
    chartTitle: "Attendance by class",
    bars: [96, 91, 94, 89, 97, 93],
    labels: ["I", "II", "III", "IV", "V", "VI"],
  },
} as const;
type TabKey = keyof typeof TABS;

const SIDEBAR = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users, label: "Students" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: IndianRupee, label: "Fees" },
  { icon: BookOpen, label: "Exams" },
  { icon: MessageSquare, label: "Messages" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
];

const ACTIVITY = [
  { icon: Users, tone: "bg-primary/15 text-primary", text: "New admission · Class 5-B", time: "2m" },
  { icon: IndianRupee, tone: "bg-success/15 text-success", text: "Fee received · ₹12,500", time: "8m" },
  { icon: CalendarCheck, tone: "bg-warning/25 text-[#B45309]", text: "Leave approved · Ms. Rao", time: "21m" },
  { icon: GraduationCap, tone: "bg-[#A78BFA]/20 text-[#6D28D9]", text: "Exam results published", time: "1h" },
];

export function DashboardShowcase() {
  const [tab, setTab] = useState<TabKey>("overview");
  const data = TABS[tab];

  return (
    <section id="features" className="relative scroll-mt-20 overflow-hidden bg-white py-20 sm:py-28 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Laptop */}
        <Reveal className="relative">
          <div className="ms-glow pointer-events-none absolute -inset-8 rounded-[48px] bg-[radial-gradient(circle_at_40%_40%,rgba(141,97,245,0.45),transparent_65%)] blur-2xl" aria-hidden />
          <div className="relative mx-auto max-w-[680px]">
            {/* Screen */}
            <div className="rounded-[22px] bg-[#0F172A] p-2.5 shadow-[0_40px_80px_-30px_rgba(16,24,40,0.55)] ring-1 ring-black/40 sm:p-3">
              <div className="flex overflow-hidden rounded-[14px] bg-[#F8F8FE] text-left" style={{ aspectRatio: "16 / 10" }}>
                {/* Sidebar */}
                <div className="hidden w-[22%] shrink-0 flex-col gap-0.5 bg-[#1E1B4B] p-2.5 sm:flex">
                  <div className="mb-2 flex items-center gap-1.5 px-1.5 py-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent"><GraduationCap className="h-3 w-3 text-white" /></span>
                    <span className="text-[10px] font-bold text-white">EduNivo</span>
                  </div>
                  {SIDEBAR.map((s, i) => (
                    <span key={s.label} className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8.5px] font-medium", i === 0 ? "bg-white/12 text-white" : "text-white/55")}>
                      <s.icon className="h-2.5 w-2.5" /> {s.label}
                    </span>
                  ))}
                </div>
                {/* Main */}
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-[11px] font-bold text-foreground sm:text-[13px]">Dashboard</span>
                    <div role="tablist" aria-label="Dashboard view" className="flex gap-0.5 rounded-lg bg-white p-0.5 ring-1 ring-foreground/[0.06]">
                      {(Object.keys(TABS) as TabKey[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={tab === k}
                          onClick={() => setTab(k)}
                          className={cn("rounded-md px-1.5 py-0.5 text-[8.5px] font-semibold transition-all sm:px-2 sm:text-[10px]", tab === k ? "bg-gradient-to-r from-primary to-accent text-white shadow" : "text-muted-foreground hover:text-foreground")}
                        >
                          {TABS[k].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div key={tab} className="grid grid-cols-4 gap-1.5 animate-in fade-in-0 duration-300 sm:gap-2">
                    {data.kpis.map((k) => (
                      <div key={k.label} className="rounded-lg bg-white p-1.5 ring-1 ring-foreground/[0.05] sm:p-2">
                        <p className="truncate text-[7px] text-muted-foreground sm:text-[8.5px]">{k.label}</p>
                        <p className={cn("font-heading text-[10px] font-extrabold sm:text-[13px]", k.tone)}>{k.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid min-h-0 flex-1 grid-cols-[1.6fr_1fr] gap-1.5 sm:gap-2">
                    <div className="flex min-h-0 flex-col rounded-lg bg-white p-2 ring-1 ring-foreground/[0.05]">
                      <p className="text-[7.5px] font-semibold text-foreground/80 sm:text-[9px]">{data.chartTitle}</p>
                      <div key={tab} className="mt-1.5 flex min-h-0 flex-1 items-end gap-1 sm:gap-1.5">
                        {data.bars.map((h, i) => (
                          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
                            <span className="ms-bar w-full rounded-t bg-gradient-to-t from-primary to-accent" style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
                            <span className="text-[6.5px] text-muted-foreground/70 sm:text-[7.5px]">{data.labels[i]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-2 ring-1 ring-foreground/[0.05]">
                      <p className="text-[7.5px] font-semibold text-foreground/80 sm:text-[9px]">Recent activity</p>
                      <ul className="mt-1.5 space-y-1 sm:space-y-1.5">
                        {ACTIVITY.map((a) => (
                          <li key={a.text} className="flex items-center gap-1">
                            <span className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded sm:h-4 sm:w-4", a.tone)}><a.icon className="h-2 w-2 sm:h-2.5 sm:w-2.5" /></span>
                            <span className="min-w-0 flex-1 truncate text-[6.5px] text-foreground/80 sm:text-[8px]">{a.text}</span>
                            <span className="text-[6px] text-muted-foreground/70 sm:text-[7px]">{a.time}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Base */}
            <div className="mx-auto h-3 w-[108%] -translate-x-[3.7%] rounded-b-[18px] bg-gradient-to-b from-[#CBD5E1] to-[#94A3B8] shadow-[0_18px_30px_-12px_rgba(16,24,40,0.4)]" aria-hidden>
              <div className="mx-auto h-1.5 w-24 rounded-b-lg bg-[#64748B]/40" />
            </div>

            {/* Floating widgets */}
            <div className="ms-float absolute -top-6 -right-2 hidden items-center gap-2.5 rounded-2xl bg-white/90 p-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] ring-1 ring-white backdrop-blur-xl sm:flex lg:-right-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#16A34A] to-[#4ADE80] text-white"><ShieldCheck className="h-4.5 w-4.5" /></span>
              <span><span className="block text-[11px] text-muted-foreground">Data backup</span><span className="block text-[13px] font-bold text-foreground">Secured · Daily</span></span>
            </div>
            <div className="ms-float-alt absolute -bottom-8 -left-2 hidden items-center gap-2.5 rounded-2xl bg-white/90 p-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] ring-1 ring-white backdrop-blur-xl sm:flex lg:-left-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-warning text-white"><Bell className="h-4.5 w-4.5" /></span>
              <span><span className="block text-[11px] text-muted-foreground">Parents notified</span><span className="block text-[13px] font-bold text-foreground">1,120 in 3 seconds</span></span>
            </div>
          </div>
          <p className="mt-12 text-center text-[12.5px] text-muted-foreground">Try the tabs: the dashboard is interactive.</p>
        </Reveal>

        {/* Copy: heading first on phones/tablets, beside the laptop on desktop */}
        <div className="order-first lg:order-none">
          <SectionHeading
            align="left"
            eyebrow="Product tour"
            title={<>One Dashboard. <GradientText>Every Insight.</GradientText></>}
            description="See your entire school at a glance. Live numbers for attendance, fees, academics and communication update the moment something happens, so principals and administrators always act on real data."
          />
          <Reveal delay={120}>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {SHOWCASE_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 rounded-2xl bg-[#F8F8FE] px-4 py-3 ring-1 ring-primary/20 transition-colors hover:bg-primary/10">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#16A34A] to-[#4ADE80] text-white shadow-sm">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[14.5px] font-semibold text-foreground">{p}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" className={cn(BTN_PRIMARY, "mt-9")}>See it with your school&apos;s data</a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
