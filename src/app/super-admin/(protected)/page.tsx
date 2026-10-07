"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BarChart3, CalendarClock, Crown, GraduationCap, Heart, HeartPulse, IndianRupee, LifeBuoy, Plus, RefreshCw, School,
  ShieldCheck, Sparkles, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getSuperAdminUser } from "@/lib/superAdminAuth";
import {
  daysUntil, formatDate, formatINR, licenseHealth, saRequest, setPendingAction,
  type LicenseHealth, type PlanRecord, type PlatformStats, type SchoolRecord,
} from "@/lib/superAdminApi";
import { timeAgo } from "@/lib/bugReports/client";
import { PriorityBadge, StatusBadge } from "@/components/bugs/TicketBadges";
import { AdminPanel, EmptyBlock, KpiCard, Meter, PRIMARY_CTA, StatusPill } from "@/components/super-admin/ui";
import { PlansChart, RegistrationsChart } from "@/components/super-admin/dashboard/DashboardCharts";

interface TicketStats {
  total: number;
  unread: number;
  byStatus: Record<string, number>;
}

interface TicketRow {
  _id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  lastActivityAt: string;
  adminUnread: boolean;
  reporter: { name: string; schoolName: string };
}

const HEALTH_ROWS: { key: LicenseHealth; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "trial", label: "Trial" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
  { key: "suspended", label: "Suspended" },
  { key: "none", label: "No license" },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// Super Admin dashboard: platform KPIs, trends, license health, expiring
// licenses, latest tickets and recent schools. Read-only -- every number
// comes from the existing stats / schools / plans / tickets endpoints.
export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [admin] = useState(() => getSuperAdminUser());
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [schools, setSchools] = useState<SchoolRecord[] | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled([
      saRequest<{ data: PlatformStats }>("/superadmin/stats").then((r) => setStats(r.data)),
      saRequest<{ data: SchoolRecord[] }>("/superadmin/schools").then((r) => setSchools(r.data || [])),
      saRequest<{ data: PlanRecord[] }>("/superadmin/plans").then((r) => setPlans(r.data || [])),
      saRequest<{ data: TicketStats }>("/superadmin/tickets/stats").then((r) => setTicketStats(r.data)),
      saRequest<{ data: TicketRow[] }>("/superadmin/tickets?limit=5&sort=lastActivityAt&order=desc&archived=false").then((r) => setTickets(r.data)),
    ]).finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  const derived = useMemo(() => {
    const list = schools ?? [];
    const health = Object.fromEntries(HEALTH_ROWS.map((r) => [r.key, 0])) as Record<LicenseHealth, number>;
    list.forEach((s) => (health[licenseHealth(s)] += 1));

    // Last 12 months of registrations.
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }), value: 0 };
    });
    list.forEach((s) => {
      const d = new Date(s.createdAt);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += 1;
    });

    const byPlan = new Map<string, number>();
    list.forEach((s) => byPlan.set(s.license?.planName || "No plan", (byPlan.get(s.license?.planName || "No plan") ?? 0) + 1));

    const expiring = list
      .filter((s) => licenseHealth(s) === "expiring" || licenseHealth(s) === "expired")
      .sort((a, b) => new Date(a.license.endDate ?? 0).getTime() - new Date(b.license.endDate ?? 0).getTime())
      .slice(0, 5);

    const recent = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    const contractValue = list.reduce((sum, s) => sum + (s.license?.totalAmount || 0), 0);
    const seatsUsed = list.reduce((sum, s) => sum + (s.userCounts?.usersUsed || 0), 0);
    const seatsTotal = list.reduce((sum, s) => sum + (s.userCounts?.usersTotal || s.license?.totalUsers || 0), 0);

    return {
      health,
      months,
      plans: [...byPlan.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      expiring,
      recent,
      contractValue,
      seatsUsed,
      seatsTotal,
      newThisMonth: months[months.length - 1].value,
    };
  }, [schools]);

  const openTickets = ticketStats
    ? ["open", "in_progress", "waiting_for_information", "reopened"].reduce((n, s) => n + (ticketStats.byStatus[s] ?? 0), 0)
    : undefined;

  const registerWith = (planId?: string) => {
    setPendingAction({ type: "register-school", planId });
    router.push("/super-admin/schools");
  };

  const loadingSchools = schools === null;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[color-mix(in_oklch,var(--primary),var(--accent)_45%)] to-accent p-6 text-white shadow-[0_24px_60px_-28px_rgba(80,72,229,0.6)] sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-semibold ring-1 ring-white/25 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-3 font-heading text-[26px] leading-tight font-bold tracking-tight sm:text-3xl">
              {greeting()}, {admin?.name?.split(" ")[0] || "Admin"}
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] text-white/85">
              {loadingSchools
                ? "Loading your platform overview…"
                : `${stats?.activeSchools ?? 0} active schools · ${derived.newThisMonth} new this month · ${derived.health.expiring} license${derived.health.expiring === 1 ? "" : "s"} expiring soon`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => registerWith()} className="h-10 rounded-xl bg-white px-4 font-semibold text-primary shadow-md hover:bg-white/90">
              <Plus /> Register school
            </Button>
            <Button nativeButton={false} render={<Link href="/super-admin/tickets" />} className="h-10 rounded-xl bg-white/15 px-4 font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25">
              <LifeBuoy /> Tickets {ticketStats?.unread ? <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-primary">{ticketStats.unread}</span> : null}
            </Button>
            <Button onClick={load} aria-label="Refresh dashboard" className="h-10 w-10 rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25">
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total schools" value={stats?.totalSchools ?? 0} icon={School} href="/super-admin/schools" loading={!stats} hint={stats ? `${stats.activeSchools} active` : undefined} />
        <KpiCard label="Active schools" value={stats?.activeSchools ?? 0} icon={ShieldCheck} tone="success" loading={!stats} hint={stats && stats.totalSchools ? `${Math.round((stats.activeSchools / stats.totalSchools) * 100)}% of all schools` : undefined} />
        <KpiCard label="Teachers" value={(stats?.totalTeachers ?? 0).toLocaleString("en-IN")} icon={GraduationCap} tone="info" loading={!stats} />
        <KpiCard label="Students" value={(stats?.totalStudents ?? 0).toLocaleString("en-IN")} icon={Users} tone="accent" loading={!stats} />
        <KpiCard label="Parents" value={(stats?.totalParents ?? 0).toLocaleString("en-IN")} icon={Heart} tone="coral" loading={!stats} />
        <KpiCard label="Open tickets" value={openTickets ?? 0} icon={LifeBuoy} tone="warning" href="/super-admin/tickets" loading={!ticketStats} hint={ticketStats ? `${ticketStats.unread} unread` : undefined} />
      </section>

      {/* Trend + license health */}
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel title="School registrations" description="New schools per month, last 12 months" icon={TrendingUp} className="xl:col-span-2">
          {loadingSchools ? <Skeleton className="h-64 w-full rounded-xl" /> : <RegistrationsChart data={derived.months} />}
        </AdminPanel>

        <AdminPanel title="License health" description={`${schools?.length ?? 0} schools`} icon={HeartPulse}>
          {loadingSchools ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="space-y-3.5">
              {HEALTH_ROWS.map((row) => (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <StatusPill status={row.key} label={row.label} />
                    <span className="font-semibold tabular-nums">{derived.health[row.key]}</span>
                  </div>
                  <Meter value={derived.health[row.key]} max={Math.max(1, schools?.length ?? 1)} className="h-1" />
                </div>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/60 pt-3.5 text-[12px]">
                <div>
                  <p className="text-muted-foreground">Total license value</p>
                  <p className="font-heading text-[16px] font-bold text-foreground">{formatINR(derived.contractValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Seats in use</p>
                  <p className="font-heading text-[16px] font-bold text-foreground tabular-nums">
                    {derived.seatsUsed.toLocaleString("en-IN")} <span className="text-[12px] font-medium text-muted-foreground">/ {derived.seatsTotal.toLocaleString("en-IN")}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </AdminPanel>
      </div>

      {/* Plans + expiring + tickets */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <AdminPanel title="Schools by plan" icon={BarChart3} actions={<Link href="/super-admin/plans" className="text-[12.5px] font-semibold text-primary hover:underline">Plans</Link>}>
          {loadingSchools ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : derived.plans.length ? (
            <PlansChart data={derived.plans} />
          ) : (
            <EmptyBlock icon={Crown} title="No schools yet" />
          )}
        </AdminPanel>

        <AdminPanel
          title="Licenses needing attention"
          description="Expired or expiring within 30 days"
          icon={CalendarClock}
          bodyClassName="p-0"
          actions={<Link href="/super-admin/schools" className="text-[12.5px] font-semibold text-primary hover:underline">All schools</Link>}
        >
          {loadingSchools ? (
            <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : derived.expiring.length === 0 ? (
            <EmptyBlock icon={ShieldCheck} title="All licenses healthy" description="Nothing expires in the next 30 days." />
          ) : (
            <ul className="divide-y divide-border/60">
              {derived.expiring.map((s) => {
                const days = daysUntil(s.license.endDate);
                return (
                  <li key={s._id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/12 font-heading text-[13px] font-bold text-warning">{s.name.slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{s.name}</p>
                      <p className="text-[12px] text-muted-foreground">{s.license.planName || "No plan"} · {formatDate(s.license.endDate)}</p>
                    </div>
                    <StatusPill status={licenseHealth(s)} label={days !== null && days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`} />
                  </li>
                );
              })}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel
          title="Latest ticket activity"
          icon={LifeBuoy}
          bodyClassName="p-0"
          className="lg:col-span-2 xl:col-span-1"
          actions={<Link href="/super-admin/tickets" className="text-[12.5px] font-semibold text-primary hover:underline">View all</Link>}
        >
          {tickets === null ? (
            <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : tickets.length === 0 ? (
            <EmptyBlock icon={LifeBuoy} title="No tickets" description="Bug reports from schools will appear here." />
          ) : (
            <ul className="divide-y divide-border/60">
              {tickets.map((t) => (
                <li key={t._id}>
                  <Link href={`/super-admin/tickets/${t._id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                    <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", t.adminUnread ? "bg-destructive" : "bg-border")} aria-label={t.adminUnread ? "Unread" : undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{t.title}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{t.ticketNumber} · {t.reporter.name} · {t.reporter.schoolName || "System"}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                        <span className="text-[11.5px] text-muted-foreground">{timeAgo(t.lastActivityAt)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      {/* Recent schools + plan catalogue */}
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel
          title="Recently registered"
          icon={School}
          bodyClassName="p-0"
          className="xl:col-span-2"
          actions={<Link href="/super-admin/schools" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">Manage schools <ArrowRight className="h-3.5 w-3.5" /></Link>}
        >
          {loadingSchools ? (
            <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : derived.recent.length === 0 ? (
            <EmptyBlock icon={School} title="No schools yet" action={<Button className={cn(PRIMARY_CTA, "h-10 px-5")} onClick={() => registerWith()}><Plus /> Register school</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border/60">
                    <th scope="col" className="px-5 py-2.5">School</th>
                    <th scope="col" className="px-3 py-2.5">Plan</th>
                    <th scope="col" className="px-3 py-2.5">Users</th>
                    <th scope="col" className="px-3 py-2.5">Registered</th>
                    <th scope="col" className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {derived.recent.map((s) => (
                    <tr key={s._id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-[12px] text-muted-foreground">{s.code}</p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{s.license?.planName || "No plan"}</td>
                      <td className="px-3 py-3 tabular-nums">{s.userCounts.usersUsed || 0} / {s.userCounts.usersTotal || s.license?.totalUsers || 0}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatDate(s.createdAt)}</td>
                      <td className="px-5 py-3"><StatusPill status={s.isActive ? "active" : "inactive"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Subscription plans" description="Pick one to register a school" icon={Crown} bodyClassName="p-3">
          {plans.filter((p) => p.isActive).length === 0 ? (
            <EmptyBlock icon={Crown} title="No active plans" description="Create plans in Subscription Plans." action={<Button variant="outline" className="rounded-xl" nativeButton={false} render={<Link href="/super-admin/plans" />}>Open plans</Button>} />
          ) : (
            <ul className="space-y-2">
              {plans.filter((p) => p.isActive).map((p) => (
                <li key={p._id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-border/60 transition hover:ring-primary/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Crown className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{p.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      <IndianRupee className="-mt-0.5 inline h-3 w-3" />{p.pricePerUser}/user/mo · {p.includedUsers} free
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => registerWith(p._id)}>
                    <Plus /> Use
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
