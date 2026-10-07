"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, Pencil, Plus, Save, School, Star, Trash2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { SA_PENDING_ACTION_EVENT, formatINR, saRequest, setPendingAction, takePendingAction, type PlanRecord } from "@/lib/superAdminApi";
import { AdminPageHeader, EmptyBlock, PRIMARY_CTA, StatusPill, SURFACE } from "@/components/super-admin/ui";

const ALL_FEATURES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "students", label: "Students" },
  { key: "teachers", label: "Teachers" },
  { key: "classes", label: "Classes" },
  { key: "attendance", label: "Attendance" },
  { key: "exams", label: "Exams" },
  { key: "fees", label: "Fees" },
  { key: "payments", label: "Online Payments" },
  { key: "notices", label: "Notices" },
  { key: "chat", label: "Chat" },
  { key: "homework", label: "Homework" },
  { key: "materials", label: "Study Materials" },
  { key: "timetable", label: "Timetable" },
  { key: "library", label: "Library" },
  { key: "transport", label: "Transport" },
  { key: "events", label: "Events" },
  { key: "reports", label: "Reports" },
  { key: "ai", label: "AI Assistant" },
];

const PLAN_ICONS: Record<string, typeof Star> = { free: Star, basic: Zap, standard: Crown, premium: Crown };
const EMPTY_FORM = { name: "", pricePerUser: 0, includedUsers: 2, features: [] as string[], isActive: true };

// Super Admin > School Management > Subscription Plans. Same requests as
// before (list / create / update / delete); redesigned cards and editor.
export default function PlansManagementPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<PlanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlans = async () => {
    try {
      const json = await saRequest("/superadmin/plans");
      setPlans(json.data || []);
    } catch {
      toast.error("Error", { description: "Failed to load plans." });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    fetchPlans();
    // "Create plan" from the header quick actions.
    const consume = () => takePendingAction("create-plan") && openCreate();
    consume();
    window.addEventListener(SA_PENDING_ACTION_EVENT, consume);
    return () => window.removeEventListener(SA_PENDING_ACTION_EVENT, consume);
  }, []);

  const openEdit = (plan: PlanRecord) => {
    setEditingPlan(plan);
    setForm({ name: plan.name, pricePerUser: plan.pricePerUser, includedUsers: plan.includedUsers, features: [...plan.features], isActive: plan.isActive });
    setDialogOpen(true);
  };

  const toggleFeature = (key: string) =>
    setForm((f) => ({ ...f, features: f.features.includes(key) ? f.features.filter((k) => k !== key) : [...f.features, key] }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Error", { description: "Plan name required." });
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        await saRequest(`/superadmin/plans/${editingPlan._id}`, { method: "PUT", body: form });
        toast.success("Plan Updated", { description: `${form.name} updated.` });
      } else {
        await saRequest("/superadmin/plans", { method: "POST", body: form });
        toast.success("Plan Created", { description: `${form.name} created.` });
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await saRequest(`/superadmin/plans/${deleteTarget._id}`, { method: "DELETE" });
      toast.success("Deleted", { description: `${deleteTarget.name} deleted.` });
      setDeleteTarget(null);
      fetchPlans();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setDeleting(false);
    }
  };

  const registerWith = (plan: PlanRecord) => {
    setPendingAction({ type: "register-school", planId: plan._id });
    router.push("/super-admin/schools");
  };

  return (
    <>
      <AdminPageHeader
        icon={Crown}
        title="Subscription Plans"
        description="Pricing, free users and the features each school gets."
        actions={<Button onClick={openCreate} className={cn(PRIMARY_CTA, "h-10 px-4")}><Plus /> Create plan</Button>}
      />

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className={SURFACE}>
          <EmptyBlock
            icon={Crown}
            title="No plans yet"
            description="Create your first subscription plan to start registering schools."
            action={<Button onClick={openCreate} className={cn(PRIMARY_CTA, "h-10 px-5")}><Plus /> Create your first plan</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.name.toLowerCase()] || Crown;
            return (
              <article key={plan._id} className={cn(SURFACE, "group/plan flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-24px_rgba(37,30,140,0.45)]", !plan.isActive && "opacity-80")}>
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-heading text-[17px] font-bold text-foreground">{plan.name}</h3>
                      <StatusPill status={plan.isActive ? "active" : "inactive"} className="mt-0.5" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(plan)} aria-label={`Edit ${plan.name}`} className="rounded-lg">
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(plan)} aria-label={`Delete ${plan.name}`} className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 />
                    </Button>
                  </div>
                </header>

                <div className="mt-5 flex items-end gap-1">
                  <span className="font-heading text-3xl font-extrabold tracking-tight text-foreground">{formatINR(plan.pricePerUser)}</span>
                  <span className="pb-1 text-[13px] text-muted-foreground">/ user / month</span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {plan.includedUsers} free users included
                </p>

                <div className="mt-5 border-t border-border/60 pt-4">
                  <p className="mb-2.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Features · {plan.features.length}/{ALL_FEATURES.length}
                  </p>
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {plan.features.slice(0, 8).map((f) => (
                      <li key={f} className="flex items-center gap-1.5 truncate text-[12.5px] text-foreground/85">
                        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                        {ALL_FEATURES.find((af) => af.key === f)?.label || f}
                      </li>
                    ))}
                  </ul>
                  {plan.features.length > 8 && <p className="mt-2 text-[12px] text-muted-foreground">+{plan.features.length - 8} more</p>}
                </div>

                {plan.isActive && (
                  <Button variant="outline" className="mt-5 h-10 w-full rounded-xl" onClick={() => registerWith(plan)}>
                    <School /> Register a school on {plan.name}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Create / edit plan */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_40px_90px_-30px_rgba(37,30,140,0.45)] ring-1 ring-border/60 sm:max-w-3xl max-lg:pb-0">
          <div className="flex items-start gap-3 border-b border-border/60 px-6 pt-6 pb-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="font-heading text-[17px] font-bold">{editingPlan ? `Edit ${editingPlan.name}` : "Create Plan"}</DialogTitle>
              <DialogDescription className="text-[12.5px]">Pricing applies to users beyond the free allowance.</DialogDescription>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-3">
              <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Basics</h3>
              <div className="space-y-1.5">
                <Label>Plan name <span className="text-destructive" aria-hidden>*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic, Standard, Premium" disabled={!!editingPlan} className="h-11 rounded-xl" />
                {editingPlan && <p className="text-[11.5px] text-muted-foreground">Plan names can&apos;t be changed after creation.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Price per user (₹ / user / month)</Label>
                  <Input type="number" value={form.pricePerUser} onChange={(e) => setForm((f) => ({ ...f, pricePerUser: Number(e.target.value) }))} className="h-11 rounded-xl" min={0} />
                  <p className="text-[11.5px] text-muted-foreground">Monthly charge per extra user beyond free users</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Free users included</Label>
                  <Input type="number" value={form.includedUsers} onChange={(e) => setForm((f) => ({ ...f, includedUsers: Number(e.target.value) }))} className="h-11 rounded-xl" min={1} />
                  <p className="text-[11.5px] text-muted-foreground">Users included at no extra cost</p>
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3 ring-1 ring-border/60">
                <span>
                  <span className="block text-[13.5px] font-semibold">Active</span>
                  <span className="block text-[12px] text-muted-foreground">Enable this plan for assignment to schools</span>
                </span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} aria-label="Active" />
              </label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Features · {form.features.length}/{ALL_FEATURES.length}</h3>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-primary hover:underline"
                  onClick={() => setForm((f) => ({ ...f, features: f.features.length === ALL_FEATURES.length ? [] : ALL_FEATURES.map((a) => a.key) }))}
                >
                  {form.features.length === ALL_FEATURES.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_FEATURES.map((f) => {
                  const on = form.features.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleFeature(f.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] ring-1 transition-all",
                        on ? "bg-primary/[0.06] font-semibold text-primary ring-primary/50" : "text-muted-foreground ring-border hover:ring-primary/30",
                      )}
                    >
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-white" : "border-border")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="flex gap-3 border-t border-border/60 bg-muted/30 px-6 py-4 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-11 flex-1 rounded-xl sm:flex-none">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className={cn(PRIMARY_CTA, "h-11 flex-1 sm:ml-auto sm:flex-none sm:px-8")}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget ? `Delete plan "${deleteTarget.name}"?` : "Delete plan?"}
        description="Schools using it will be set to trial mode."
        confirmLabel="Delete plan"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
