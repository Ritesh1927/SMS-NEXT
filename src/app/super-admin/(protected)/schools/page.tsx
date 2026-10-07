"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, CalendarClock, CheckCircle2, Key, MoreHorizontal, Pencil, Plus, Power, RefreshCw, School, Search, ShieldOff, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  SA_PENDING_ACTION_EVENT, daysUntil, formatDate, formatINR, licenseHealth, saRequest, takePendingAction,
  type LicenseHealth, type PlanRecord, type PlatformStats, type SchoolRecord,
} from "@/lib/superAdminApi";
import {
  AdminPageHeader, EmptyBlock, ErrorBlock, KpiCard, Meter, PRIMARY_CTA, StatusPill, SURFACE,
} from "@/components/super-admin/ui";
import { ColumnsMenu, DataTable, ExportButton, exportCsv, useColumnVisibility, type Column } from "@/components/super-admin/DataTable";
import { EditSchoolDialog, RegisterSchoolDialog, RenewLicenseDialog } from "@/components/super-admin/schools/SchoolDialogs";

const ALL = "__all";
type Filters = { status: string; plan: string; license: string };
const EMPTY_FILTERS: Filters = { status: ALL, plan: ALL, license: ALL };

const LICENSE_OPTIONS: { value: LicenseHealth; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring in 30 days" },
  { value: "expired", label: "Expired" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
  { value: "none", label: "No license" },
];

// Super Admin > School Management > Schools. All school actions that used
// to live on the dashboard, with the same API calls: list/search, register,
// edit, renew license, reset admin password, toggle attendance edit,
// activate/deactivate and delete.
export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerPlanId, setRegisterPlanId] = useState<string | null>(null);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [renewSchool, setRenewSchool] = useState<SchoolRecord | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ id: string; name: string } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingSchool, setDeletingSchool] = useState(false);

  const fetchStats = useCallback(() => {
    saRequest<{ data: PlatformStats }>("/superadmin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const fetchSchools = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = query ? `?search=${encodeURIComponent(query)}` : "";
    saRequest<{ data: SchoolRecord[] }>(`/superadmin/schools${qs}`)
      .then((r) => setSchools(r.data || []))
      .catch(() => {
        setError("Failed to load schools.");
        toast.error("Error", { description: "Failed to load schools." });
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount / search change
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    fetchStats();
    saRequest<{ data: PlanRecord[] }>("/superadmin/plans").then((r) => setPlans(r.data || [])).catch(() => {});
  }, [fetchStats]);

  // Debounced server search (same ?search= endpoint as before).
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Header quick action / command palette hand-offs.
  useEffect(() => {
    const consume = () => {
      const register = takePendingAction("register-school");
      if (register) {
        setRegisterPlanId(register.planId ?? null);
        setRegisterOpen(true);
      }
      const searchAction = takePendingAction("search-schools");
      if (searchAction) setSearch(searchAction.query);
    };
    consume();
    window.addEventListener(SA_PENDING_ACTION_EVENT, consume);
    return () => window.removeEventListener(SA_PENDING_ACTION_EVENT, consume);
  }, []);

  const refresh = () => {
    fetchSchools();
    fetchStats();
  };

  // ---- Row actions (unchanged requests) ----
  const handleToggle = async (school: SchoolRecord) => {
    try {
      const json = await saRequest(`/superadmin/schools/${school._id}/toggle`, { method: "PATCH" });
      setSchools((prev) => prev.map((s) => (s._id === school._id ? { ...s, isActive: json.isActive } : s)));
      toast.success("Success", { description: json.message });
      fetchStats();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const handleToggleAttendanceEdit = async (school: SchoolRecord) => {
    try {
      const json = await saRequest(`/superadmin/schools/${school._id}/allow-attendance-edit`, { method: "PATCH" });
      setSchools((prev) => prev.map((s) => (s._id === school._id ? { ...s, allowAttendanceEdit: json.allowAttendanceEdit } : s)));
      toast.success("Success", { description: json.message });
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    setResettingPassword(true);
    try {
      const json = await saRequest(`/superadmin/schools/${resetPasswordTarget.id}/reset-password`, { method: "POST" });
      toast.success("Password Reset", { description: `New password: ${json.newPassword}` });
      setResetPasswordTarget(null);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingSchool(true);
    try {
      await saRequest(`/superadmin/schools/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Deleted", { description: "School deleted." });
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setDeletingSchool(false);
    }
  };

  // ---- Client-side filters on the loaded list ----
  const filtered = useMemo(
    () =>
      schools.filter((s) => {
        if (filters.status !== ALL && (filters.status === "active") !== s.isActive) return false;
        if (filters.plan !== ALL && (s.license?.planName || "__none") !== filters.plan) return false;
        if (filters.license !== ALL && licenseHealth(s) !== filters.license) return false;
        return true;
      }),
    [schools, filters],
  );
  const planOptions = useMemo(() => {
    const names = new Set(schools.map((s) => s.license?.planName || "__none"));
    plans.forEach((p) => names.add(p.name));
    return [...names].map((n) => ({ value: n, label: n === "__none" ? "No plan" : n }));
  }, [schools, plans]);
  const expiringCount = useMemo(() => schools.filter((s) => licenseHealth(s) === "expiring").length, [schools]);
  const activeFilterCount = Object.values(filters).filter((v) => v !== ALL).length;

  const actionsFor = (s: SchoolRecord) => (
    <SchoolActions
      school={s}
      onRenew={() => setRenewSchool(s)}
      onEdit={() => setEditSchool(s)}
      onResetPassword={() => setResetPasswordTarget({ id: s._id, name: s.name })}
      onToggleAttendance={() => handleToggleAttendanceEdit(s)}
      onToggleActive={() => handleToggle(s)}
      onDelete={() => setDeleteTarget({ id: s._id, name: s.name })}
    />
  );

  const columns: Column<SchoolRecord>[] = [
    {
      id: "school",
      header: "School",
      pinned: true,
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-[13px] font-bold text-primary">
            {s.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{s.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{s.adminEmail}{s.phone ? ` · ${s.phone}` : ""}</p>
          </div>
        </div>
      ),
      csv: (s) => s.name,
      className: "max-w-[280px]",
    },
    { id: "code", header: "Code", cell: (s) => <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-muted-foreground">{s.code}</span>, csv: (s) => s.code },
    {
      id: "admin",
      header: "Admin",
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{s.adminName}</p>
          {s.adminPhone && <p className="text-[12px] text-muted-foreground">{s.adminPhone}</p>}
        </div>
      ),
      csv: (s) => `${s.adminName} <${s.adminEmail}>`,
    },
    {
      id: "users",
      header: "Users",
      cell: (s) => {
        const total = s.userCounts.usersTotal || s.license?.totalUsers || 0;
        const used = s.userCounts.usersUsed || 0;
        return (
          <div className="w-36">
            <p className="text-[13px]"><b className="tabular-nums">{used}</b><span className="text-muted-foreground"> / {total}</span></p>
            <Meter value={used} max={total} className="mt-1" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {s.userCounts.admin || 0}A · {s.userCounts.teachers}T · {s.userCounts.students}S{s.userCounts.parents > 0 ? ` · ${s.userCounts.parents}P` : ""}
            </p>
          </div>
        );
      },
      csv: (s) => `${s.userCounts.usersUsed || 0}/${s.userCounts.usersTotal || s.license?.totalUsers || 0}`,
    },
    {
      id: "plan",
      header: "Plan",
      cell: (s) => <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary capitalize">{s.license?.planName || "No Plan"}</span>,
      csv: (s) => s.license?.planName || "No Plan",
    },
    {
      id: "license",
      header: "License",
      cell: (s) => {
        const health = licenseHealth(s);
        const days = daysUntil(s.license?.endDate ?? null);
        return s.license?.endDate ? (
          <div className="space-y-1">
            <StatusPill status={health} />
            <p className="text-[12px] text-muted-foreground">
              {formatDate(s.license.endDate)}
              {days !== null && days >= 0 && days <= 60 ? ` · ${days}d left` : ""}
            </p>
            {s.license.totalAmount > 0 && <p className="text-[11px] text-muted-foreground">{formatINR(s.license.totalAmount)} total</p>}
          </div>
        ) : (
          <StatusPill status="none" />
        );
      },
      csv: (s) => (s.license?.endDate ? `${licenseHealth(s)} until ${formatDate(s.license.endDate)}` : "No license"),
    },
    {
      id: "attendance",
      header: "Attendance edit",
      defaultHidden: true,
      cell: (s) => <StatusPill tone={s.allowAttendanceEdit ? "progress" : "neutral"} label={s.allowAttendanceEdit ? "Allowed" : "Locked"} />,
      csv: (s) => (s.allowAttendanceEdit ? "Allowed" : "Locked"),
    },
    {
      id: "created",
      header: "Created",
      defaultHidden: true,
      cell: (s) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(s.createdAt)}</span>,
      csv: (s) => formatDate(s.createdAt),
    },
    { id: "status", header: "Status", cell: (s) => <StatusPill status={s.isActive ? "active" : "inactive"} />, csv: (s) => (s.isActive ? "Active" : "Inactive") },
    { id: "actions", header: "", pinned: true, cell: actionsFor, headerClassName: "w-14", className: "text-right" },
  ];
  const { visible, hidden, toggle } = useColumnVisibility(columns);

  return (
    <>
      <AdminPageHeader
        icon={School}
        title="Schools"
        description="Register, manage and renew every school on the platform."
        actions={
          <Button
            className={cn(PRIMARY_CTA, "h-10 px-4")}
            onClick={() => {
              setRegisterPlanId(null);
              setRegisterOpen(true);
            }}
          >
            <Plus /> Register school
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total schools" value={stats?.totalSchools ?? "—"} icon={School} loading={!stats} />
        <KpiCard label="Active" value={stats?.activeSchools ?? "—"} icon={CheckCircle2} tone="success" loading={!stats} />
        <KpiCard label="Inactive" value={stats ? stats.totalSchools - stats.activeSchools : "—"} icon={ShieldOff} tone="danger" loading={!stats} />
        <KpiCard label="Licenses expiring ≤ 30 days" value={loading ? "—" : expiringCount} icon={CalendarClock} tone="warning" loading={loading && !schools.length} />
      </div>

      <section className={cn(SURFACE, "overflow-hidden")}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schools by name, code or email…" aria-label="Search schools" className="h-10 rounded-xl pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            <FilterSelect label="Plan" value={filters.plan} onChange={(v) => setFilters((f) => ({ ...f, plan: v }))} options={planOptions} />
            <FilterSelect label="License" value={filters.license} onChange={(v) => setFilters((f) => ({ ...f, license: v }))} options={LICENSE_OPTIONS} />
            {activeFilterCount > 0 && (
              <Button variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X /> Clear
              </Button>
            )}
            <ColumnsMenu columns={columns} hidden={hidden} onToggle={toggle} />
            <ExportButton onClick={() => exportCsv(filtered, visible, `schools-${new Date().toISOString().slice(0, 10)}.csv`)} disabled={!filtered.length} />
            <Button variant="outline" className="h-10 rounded-xl" onClick={refresh} aria-label="Refresh">
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {error && !schools.length ? (
          <ErrorBlock message={error} onRetry={fetchSchools} />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <DataTable
                columns={visible}
                rows={filtered}
                rowKey={(s) => s._id}
                loading={loading && !schools.length}
                minWidth={1040}
                empty={<EmptyState onRegister={() => setRegisterOpen(true)} filtered={!!query || activeFilterCount > 0} />}
              />
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border/60 md:hidden">
              {loading && !schools.length
                ? Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-4"><Skeleton className="h-20 w-full rounded-xl" /></li>)
                : filtered.length === 0
                  ? <li><EmptyState onRegister={() => setRegisterOpen(true)} filtered={!!query || activeFilterCount > 0} /></li>
                  : filtered.map((s) => {
                      const total = s.userCounts.usersTotal || s.license?.totalUsers || 0;
                      return (
                        <li key={s._id} className="flex gap-3 p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading font-bold text-primary">{s.name.slice(0, 1).toUpperCase()}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{s.name}</p>
                                <p className="truncate text-[12px] text-muted-foreground">{s.code} · {s.adminName}</p>
                              </div>
                              {actionsFor(s)}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <StatusPill status={s.isActive ? "active" : "inactive"} />
                              <StatusPill status={licenseHealth(s)} />
                              <span className="text-[11.5px] text-muted-foreground">{s.license?.planName || "No plan"}</span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                              <Meter value={s.userCounts.usersUsed || 0} max={total} className="flex-1" />
                              <span className="shrink-0 tabular-nums">{s.userCounts.usersUsed || 0}/{total}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
            </ul>
          </>
        )}
        {!loading && filtered.length > 0 && (
          <p className="border-t border-border/60 px-5 py-3 text-[12px] text-muted-foreground">
            Showing <b className="text-foreground">{filtered.length}</b> of {schools.length} school{schools.length === 1 ? "" : "s"}
          </p>
        )}
      </section>

      <RegisterSchoolDialog open={registerOpen} onOpenChange={setRegisterOpen} plans={plans} initialPlanId={registerPlanId} onCreated={refresh} />
      <EditSchoolDialog school={editSchool} onClose={() => setEditSchool(null)} onSaved={fetchSchools} />
      <RenewLicenseDialog school={renewSchool} onClose={() => setRenewSchool(null)} onRenewed={fetchSchools} />
      <ConfirmDialog
        open={!!resetPasswordTarget}
        onOpenChange={(o) => !o && setResetPasswordTarget(null)}
        title="Reset admin password?"
        description={resetPasswordTarget ? `A new password will be generated for the admin of ${resetPasswordTarget.name}. It's shown once, so note it down.` : undefined}
        confirmLabel="Reset password"
        loading={resettingPassword}
        onConfirm={handleResetPassword}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this school?"
        description={deleteTarget ? `${deleteTarget.name} will be permanently deleted. This can't be undone.` : undefined}
        confirmLabel="Delete school"
        variant="destructive"
        loading={deletingSchool}
        onConfirm={handleDelete}
      />
    </>
  );
}

function SchoolActions({
  school, onRenew, onEdit, onResetPassword, onToggleAttendance, onToggleActive, onDelete,
}: {
  school: SchoolRecord;
  onRenew: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleAttendance: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${school.name}`} className="rounded-lg" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
        <DropdownMenuItem onClick={onRenew} className="gap-2.5 rounded-lg"><CalendarClock /> Renew license</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="gap-2.5 rounded-lg"><Pencil /> Edit details</DropdownMenuItem>
        <DropdownMenuItem onClick={onResetPassword} className="gap-2.5 rounded-lg"><Key /> Reset admin password</DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleAttendance} className="gap-2.5 rounded-lg">
          <CalendarCheck /> {school.allowAttendanceEdit ? "Disable attendance edit" : "Enable attendance edit"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleActive} className="gap-2.5 rounded-lg"><Power /> {school.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive" className="gap-2.5 rounded-lg"><Trash2 /> Delete school</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const items = [{ value: ALL, label: `${label}: All` }, ...options.map((o) => ({ value: o.value, label: `${label}: ${o.label}` }))];
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange((v as string) || ALL)}>
      <SelectTrigger aria-label={label} className={cn("h-10 data-[size=default]:h-10 rounded-xl", value !== ALL && "border-primary/50 bg-primary/[0.05] text-primary")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ onRegister, filtered }: { onRegister: () => void; filtered: boolean }) {
  return filtered ? (
    <EmptyBlock icon={Search} title="No schools match" description="Try a different search or clear the filters." />
  ) : (
    <EmptyBlock
      icon={School}
      title="No schools yet"
      description="Register the first school to get started."
      action={<Button className={cn(PRIMARY_CTA, "h-10 px-5")} onClick={onRegister}><Plus /> Register school</Button>}
    />
  );
}
