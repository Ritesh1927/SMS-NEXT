"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Plus, Pencil, Trash2, Loader2, Check, X, Crown, Star, Zap, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSuperAdminToken, clearSuperAdminAuth } from "@/lib/superAdminAuth";

interface PlanRecord {
  _id: string;
  name: string;
  pricePerUser: number;
  includedUsers: number;
  features: string[];
  isActive: boolean;
}

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

const PLAN_ICONS: Record<string, typeof Star> = {
  free: Star, basic: Zap, standard: Crown, premium: Crown,
};

function authHeaders(token: string, json = false): HeadersInit {
  return json ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${token}` };
}

async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Something went wrong.");
  return json;
}

export default function PlansManagementPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", pricePerUser: 0, includedUsers: 2, features: [] as string[], isActive: true,
  });

  const fetchPlans = async () => {
    const token = getSuperAdminToken();
    if (!token) return;
    try {
      const res = await fetch("/api/superadmin/plans", { headers: authHeaders(token) });
      const json = await parseJson(res);
      setPlans(json.data || []);
    } catch {
      toast.error("Error", { description: "Failed to load plans." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    fetchPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ name: "", pricePerUser: 0, includedUsers: 2, features: [], isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (plan: PlanRecord) => {
    setEditingPlan(plan);
    setForm({ name: plan.name, pricePerUser: plan.pricePerUser, includedUsers: plan.includedUsers, features: [...plan.features], isActive: plan.isActive });
    setDialogOpen(true);
  };

  const toggleFeature = (key: string) => {
    setForm((f) => ({ ...f, features: f.features.includes(key) ? f.features.filter((k) => k !== key) : [...f.features, key] }));
  };

  const handleSave = async () => {
    const token = getSuperAdminToken();
    if (!token) return;
    if (!form.name.trim()) {
      toast.error("Error", { description: "Plan name required." });
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        const res = await fetch(`/api/superadmin/plans/${editingPlan._id}`, {
          method: "PUT", headers: authHeaders(token, true), body: JSON.stringify(form),
        });
        await parseJson(res);
        toast.success("Plan Updated", { description: `${form.name} updated.` });
      } else {
        const res = await fetch("/api/superadmin/plans", {
          method: "POST", headers: authHeaders(token, true), body: JSON.stringify(form),
        });
        await parseJson(res);
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

  const handleDelete = async (plan: PlanRecord) => {
    const token = getSuperAdminToken();
    if (!token || !confirm(`Delete plan "${plan.name}"? Schools using it will be set to trial mode.`)) return;
    try {
      const res = await fetch(`/api/superadmin/plans/${plan._id}`, { method: "DELETE", headers: authHeaders(token) });
      await parseJson(res);
      toast.success("Deleted", { description: `${plan.name} deleted.` });
      fetchPlans();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const handleLogout = () => {
    clearSuperAdminAuth();
    router.push("/super-admin/login");
  };

  return (
    <div className="min-h-screen bg-muted/50">
      <div className="bg-card border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/super-admin")} className="gap-1.5 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Plans Management</h1>
            <p className="text-xs text-muted-foreground">Create and manage subscription plans</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-primary to-accent text-white border-0 rounded-xl">
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
          <Button variant="outline" onClick={handleLogout} className="rounded-xl">Logout</Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No plans created yet.</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Create your first plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const Icon = PLAN_ICONS[plan.name.toLowerCase()] || Crown;
              return (
                <div key={plan._id} className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-foreground">{plan.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(plan)} className="h-8 w-8 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(plan)} className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price Per User</span>
                      <span className="font-medium">₹{plan.pricePerUser}/user/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Free Users</span>
                      <span className="font-medium">{plan.includedUsers}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Features ({plan.features.length}/{ALL_FEATURES.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {plan.features.slice(0, 6).map((f) => (
                        <span key={f} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {ALL_FEATURES.find((af) => af.key === f)?.label || f}
                        </span>
                      ))}
                      {plan.features.length > 6 && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          +{plan.features.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${plan.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="text-xs text-muted-foreground">{plan.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">
              {editingPlan ? `Edit ${editingPlan.name}` : "Create Plan"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 mt-2 pr-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Plan Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Basic, Standard, Premium"
                disabled={!!editingPlan}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Price Per User (₹/user/month)</Label>
                <Input type="number" value={form.pricePerUser} onChange={(e) => setForm((f) => ({ ...f, pricePerUser: Number(e.target.value) }))} className="rounded-xl" min={0} />
                <p className="text-[11px] text-gray-400">Monthly charge per extra user beyond free users</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Free Users Included</Label>
                <Input type="number" value={form.includedUsers} onChange={(e) => setForm((f) => ({ ...f, includedUsers: Number(e.target.value) }))} className="rounded-xl" min={1} />
                <p className="text-[11px] text-gray-400">Users included in plan at no extra cost</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-gray-200">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-gray-500">Enable this plan for assignment</p>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            <div className="border-t border-gray-200 pt-3">
              <Label className="text-xs font-semibold mb-3 block">
                Features ({form.features.length}/{ALL_FEATURES.length} selected)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_FEATURES.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFeature(f.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                      form.features.includes(f.key)
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {form.features.includes(f.key) ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 opacity-30 shrink-0" />
                    )}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 flex gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-accent text-white border-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
