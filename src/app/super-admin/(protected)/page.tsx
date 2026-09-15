"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, School, Users, GraduationCap, Heart, Plus, Search,
  Pencil, Trash2, Power, Key, RefreshCw, Loader2, Crown, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

interface SchoolRecord {
  _id: string; name: string; code: string; address: string; phone: string;
  email: string; adminName: string; adminEmail: string; adminPhone: string;
  isActive: boolean; isVerified: boolean;
  license: {
    planName: string; includedUsers: number; extraUsers: number; totalUsers: number;
    pricePerUser: number; months: number; totalAmount: number;
    startDate: string | null; endDate: string | null; status: string;
  };
  userCounts: { admin: number; teachers: number; students: number; parents: number; usersUsed: number; usersTotal: number };
  createdAt: string;
}

function authHeaders(token: string, json = false): HeadersInit {
  return json ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${token}` };
}

async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Something went wrong.");
  return json;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ totalSchools: 0, activeSchools: 0, totalTeachers: 0, totalStudents: 0, totalParents: 0 });
  const [plans, setPlans] = useState<PlanRecord[]>([]);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "", address: "", phone: "", email: "",
    adminName: "", adminEmail: "", adminPhone: "",
    startDate: "", endDate: "", extraUsers: 0,
  });
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ code: string; password: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", phone: "", email: "", adminName: "", adminPhone: "" });
  const [saving, setSaving] = useState(false);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSchool, setRenewSchool] = useState<SchoolRecord | null>(null);
  const [renewForm, setRenewForm] = useState({ endDate: "", extraUsers: 0 });

  const fetchStats = useCallback(async () => {
    const token = getSuperAdminToken();
    if (!token) return;
    try {
      const res = await fetch("/api/superadmin/stats", { headers: authHeaders(token) });
      const json = await parseJson(res);
      setStats(json.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    const token = getSuperAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/superadmin/schools${qs}`, { headers: authHeaders(token) });
      const json = await parseJson(res);
      setSchools(json.data || []);
    } catch {
      toast.error("Error", { description: "Failed to load schools." });
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchPlans = useCallback(async () => {
    const token = getSuperAdminToken();
    if (!token) return;
    try {
      const res = await fetch("/api/superadmin/plans", { headers: authHeaders(token) });
      const json = await parseJson(res);
      setPlans(json.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    fetchStats(); fetchSchools(); fetchPlans();
  }, [fetchStats, fetchSchools, fetchPlans]);

  const calcMonths = () => {
    if (!createForm.startDate || !createForm.endDate) return 0;
    const start = new Date(createForm.startDate);
    const end = new Date(createForm.endDate);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)) || 1;
  };

  const calcTotal = () => calcMonths() * (createForm.extraUsers || 0) * (selectedPlan?.pricePerUser || 0);
  const calcTotalUsers = () => (selectedPlan?.includedUsers || 0) + (createForm.extraUsers || 0);

  const openRegister = (plan: PlanRecord) => {
    setSelectedPlan(plan);
    setCreateForm({ name: "", address: "", phone: "", email: "", adminName: "", adminEmail: "", adminPhone: "", startDate: "", endDate: "", extraUsers: 0 });
    setCreatedResult(null);
    setRegisterOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const token = getSuperAdminToken();
    if (!token) return;
    if (!createForm.startDate || !createForm.endDate) {
      toast.error("Required", { description: "License start and end dates are required." });
      return;
    }
    setCreating(true);
    try {
      const payload = {
        ...createForm,
        planId: selectedPlan?._id,
        planName: selectedPlan?.name,
        months: calcMonths(),
        totalAmount: calcTotal(),
        totalUsers: calcTotalUsers(),
        includedUsers: selectedPlan?.includedUsers || 0,
        pricePerUser: selectedPlan?.pricePerUser || 0,
      };
      const res = await fetch("/api/superadmin/schools", {
        method: "POST", headers: authHeaders(token, true), body: JSON.stringify(payload),
      });
      const json = await parseJson(res);
      setCreatedResult({ code: json.data.code, password: json.data.generatedPassword });
      toast.success("School Created!", { description: `${createForm.name} has been registered.` });
      fetchSchools(); fetchStats();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getSuperAdminToken();
    if (!token || !editSchool) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/schools/${editSchool._id}`, {
        method: "PUT", headers: authHeaders(token, true), body: JSON.stringify(editForm),
      });
      await parseJson(res);
      toast.success("Updated", { description: "School details updated." });
      setEditOpen(false); fetchSchools();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (school: SchoolRecord) => {
    const token = getSuperAdminToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/superadmin/schools/${school._id}/toggle`, {
        method: "PATCH", headers: authHeaders(token),
      });
      const json = await parseJson(res);
      setSchools((prev) => prev.map((s) => (s._id === school._id ? { ...s, isActive: json.isActive } : s)));
      toast.success("Success", { description: json.message });
      fetchStats();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    const token = getSuperAdminToken();
    if (!token || !confirm(`Reset admin password for "${name}"?`)) return;
    try {
      const res = await fetch(`/api/superadmin/schools/${id}/reset-password`, { method: "POST", headers: authHeaders(token) });
      const json = await parseJson(res);
      toast.success("Password Reset", { description: `New password: ${json.newPassword}` });
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const handleDelete = async (id: string) => {
    const token = getSuperAdminToken();
    if (!token || !confirm("Delete this school? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/superadmin/schools/${id}`, { method: "DELETE", headers: authHeaders(token) });
      await parseJson(res);
      toast.success("Deleted", { description: "School deleted." });
      fetchSchools(); fetchStats();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    }
  };

  const openRenew = (school: SchoolRecord) => {
    setRenewSchool(school);
    const lastEnd = school.license?.endDate ? school.license.endDate.split("T")[0] : new Date().toISOString().split("T")[0];
    setRenewForm({ endDate: lastEnd, extraUsers: school.license?.extraUsers || 0 });
    setRenewOpen(true);
  };

  const handleRenew = async () => {
    const token = getSuperAdminToken();
    if (!token || !renewSchool) return;
    if (!renewForm.endDate) {
      toast.error("Required", { description: "New end date is required." });
      return;
    }
    setSaving(true);
    try {
      const startDate = renewSchool.license?.endDate || new Date().toISOString().split("T")[0];
      const start = new Date(startDate);
      const end = new Date(renewForm.endDate);
      const diffMs = end.getTime() - start.getTime();
      const months = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
      const newExtra = renewForm.extraUsers;
      const pricePerUser = renewSchool.license?.pricePerUser || 0;
      const includedUsers = renewSchool.license?.includedUsers || 0;
      const totalAmount = months * newExtra * pricePerUser;
      const totalUsers = includedUsers + newExtra;

      const res = await fetch(`/api/superadmin/schools/${renewSchool._id}`, {
        method: "PUT",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          license: { endDate: renewForm.endDate, extraUsers: newExtra, totalUsers, months, totalAmount, status: "active" },
        }),
      });
      await parseJson(res);
      toast.success("License Renewed", { description: `License extended to ${renewForm.endDate}.` });
      setRenewOpen(false); fetchSchools();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearSuperAdminAuth();
    router.push("/super-admin/login");
  };

  const months = calcMonths();
  const totalAmount = calcTotal();
  const totalUsers = calcTotalUsers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">EduNivo</h1>
              <p className="text-[11px] text-white/50">Super Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => router.push("/super-admin/plans")}>Plans</Button>
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Schools", value: stats.totalSchools, icon: School },
            { label: "Active", value: stats.activeSchools, icon: School },
            { label: "Teachers", value: stats.totalTeachers, icon: GraduationCap },
            { label: "Students", value: stats.totalStudents, icon: Users },
            { label: "Parents", value: stats.totalParents, icon: Heart },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-white/70" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Available Plans</h3>
            <span className="text-xs text-white/40">Choose a plan to register a school</span>
          </div>
          {plans.length === 0 ? (
            <div className="text-center py-10">
              <Crown className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/50">No plans created yet.</p>
              <p className="text-xs text-white/30 mt-1">Go to <strong>Plans</strong> to create subscription plans.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {plans.filter((p) => p.isActive).map((plan) => (
                <div key={plan._id} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-4 w-4 text-white/50" />
                    <span className="text-sm font-semibold text-white">{plan.name}</span>
                  </div>
                  <div className="space-y-1 text-xs text-white/50 mb-4">
                    <p>₹{plan.pricePerUser}/user/month</p>
                    <p>{plan.includedUsers} free users included</p>
                    <p>{plan.features.length} features</p>
                  </div>
                  <Button size="sm" className="mt-auto w-full h-8 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#7C3AED] border-0 text-white text-xs"
                    onClick={() => openRegister(plan)}>
                    <Plus className="h-3 w-3 mr-1" /> Choose Plan
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl w-72" />
          </div>
          <Button variant="outline" onClick={() => { fetchSchools(); fetchStats(); }} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400 text-sm">Loading...</td></tr>
                ) : schools.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400 text-sm">No schools found.</td></tr>
                ) : schools.map((s) => {
                  const totalU = s.userCounts.usersTotal || s.license?.totalUsers || 0;
                  const usersUsed = s.userCounts.usersUsed || 0;
                  const usagePercent = totalU > 0 ? Math.round((usersUsed / totalU) * 100) : 0;
                  return (
                    <tr key={s._id} className="hover:bg-gray-50/50 transition-colors border-t border-gray-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.adminEmail}</p>
                          {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">{s.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{s.adminName}</p>
                        {s.adminPhone && <p className="text-xs text-gray-400">{s.adminPhone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="font-semibold text-gray-900">{usersUsed}</span>
                          <span className="text-gray-400"> / {totalU}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                          <div className={`h-1.5 rounded-full ${usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-[#2563EB]"}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {s.userCounts.admin || 0}A · {s.userCounts.teachers}T · {s.userCounts.students}S
                          {s.userCounts.parents > 0 && <span> · {s.userCounts.parents}P</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize bg-primary/10 text-primary border-primary/20">
                          {s.license?.planName || "No Plan"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.license?.endDate ? (
                          <div>
                            <p className="text-xs text-gray-900 font-medium">
                              {new Date(s.license.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {s.license.startDate && `From ${new Date(s.license.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                            </p>
                            {s.license.totalAmount > 0 && (
                              <p className="text-[10px] text-gray-400">₹{s.license.totalAmount} total</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No License</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${s.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:bg-green-50"
                            title="Renew License" onClick={() => openRenew(s)}>
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#2563EB] hover:bg-[#2563EB]/10"
                            title="Edit" onClick={() => { setEditSchool(s); setEditForm({ name: s.name, address: s.address, phone: s.phone, email: s.email, adminName: s.adminName, adminPhone: s.adminPhone }); setEditOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                            title="Reset Admin Password" onClick={() => handleResetPassword(s._id, s.name)}>
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className={`h-8 w-8 ${s.isActive ? "text-amber-500 hover:bg-amber-50" : "text-green-500 hover:bg-green-50"}`}
                            title={s.isActive ? "Deactivate" : "Activate"} onClick={() => handleToggle(s)}>
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                            title="Delete" onClick={() => handleDelete(s._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Register School Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-[#2563EB]" /> Register New School
            </DialogTitle>
          </DialogHeader>
          {createdResult ? (
            <div className="space-y-4 mt-2">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800 mb-2">School Created Successfully!</p>
                <div className="space-y-1 text-sm text-green-700">
                  <p>School Code: <span className="font-mono font-bold">{createdResult.code}</span></p>
                  <p>Admin Password: <span className="font-mono font-bold">{createdResult.password}</span></p>
                </div>
                <p className="text-xs text-green-600 mt-2">Share these credentials with the school admin. Password cannot be recovered.</p>
              </div>
              <Button className="w-full rounded-xl" onClick={() => setRegisterOpen(false)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <Label className="text-xs font-semibold text-gray-500">Plan Type</Label>
                <p className="text-sm font-semibold text-gray-900 mt-1">{selectedPlan?.name || "None"}</p>
                <p className="text-xs text-gray-500">₹{selectedPlan?.pricePerUser || 0}/user/month · {selectedPlan?.includedUsers || 0} free users · {selectedPlan?.features?.length || 0} features</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">School Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">School Name *</Label>
                    <Input placeholder="e.g. Delhi Public School" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Phone</Label>
                    <Input placeholder="9876543210" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Email</Label>
                    <Input placeholder="school@email.com" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Address</Label>
                    <Input placeholder="Full address" value={createForm.address} onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))} className="rounded-xl" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Admin Name *</Label>
                    <Input placeholder="Full name" value={createForm.adminName} onChange={(e) => setCreateForm((f) => ({ ...f, adminName: e.target.value }))} required className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Admin Phone</Label>
                    <Input placeholder="9876543210" value={createForm.adminPhone} onChange={(e) => setCreateForm((f) => ({ ...f, adminPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="rounded-xl" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Admin Email *</Label>
                    <Input placeholder="admin@email.com (login credentials sent here)" value={createForm.adminEmail} onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))} required className="rounded-xl" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">License</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">License Start Date *</Label>
                    <Input type="date" value={createForm.startDate} onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))} required className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">License End Date *</Label>
                    <Input type="date" value={createForm.endDate} onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))} required className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-500">Extra Users (beyond {selectedPlan?.includedUsers || 0} free)</Label>
                    <Input type="number" min={0} value={createForm.extraUsers} onChange={(e) => setCreateForm((f) => ({ ...f, extraUsers: Number(e.target.value) }))} className="rounded-xl" />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 w-full">
                      <p className="text-xs text-gray-500">Total Users</p>
                      <p className="text-lg font-bold text-gray-900">{totalUsers}</p>
                      <p className="text-[10px] text-gray-400">{selectedPlan?.includedUsers || 0} free + {createForm.extraUsers || 0} extra</p>
                    </div>
                  </div>
                </div>
              </div>

              {createForm.startDate && createForm.endDate && createForm.extraUsers > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Cost Summary</p>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div className="flex justify-between"><span>Duration</span><span className="font-medium">{months} month{months !== 1 ? "s" : ""}</span></div>
                    <div className="flex justify-between"><span>Extra Users</span><span className="font-medium">{createForm.extraUsers}</span></div>
                    <div className="flex justify-between"><span>Price Per User/Month</span><span className="font-medium">₹{selectedPlan?.pricePerUser || 0}</span></div>
                    <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-lg">₹{totalAmount}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={creating} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] border-0 text-white">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {creating ? "Creating..." : "Register School"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit School Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#2563EB]" /> Edit School
            </DialogTitle>
          </DialogHeader>
          {editSchool && (
            <form onSubmit={handleEdit} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500">School Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500">Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Admin Name</Label>
                  <Input value={editForm.adminName} onChange={(e) => setEditForm((f) => ({ ...f, adminName: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500">Admin Phone</Label>
                  <Input value={editForm.adminPhone} onChange={(e) => setEditForm((f) => ({ ...f, adminPhone: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] border-0 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Renew License Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" /> Renew License
            </DialogTitle>
          </DialogHeader>
          {renewSchool && (
            <div className="space-y-4 mt-2">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-1 text-sm">
                <p className="font-medium text-gray-900">{renewSchool.name}</p>
                <p className="text-xs text-gray-500">Plan: {renewSchool.license?.planName || "None"}</p>
                {renewSchool.license?.endDate && (
                  <p className="text-xs text-gray-500">
                    Current expiry: {new Date(renewSchool.license.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500">New Expiry Date</Label>
                <Input type="date" value={renewForm.endDate} onChange={(e) => setRenewForm((f) => ({ ...f, endDate: e.target.value }))} className="rounded-xl" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-500">
                  Extra Users (currently {renewSchool.license?.extraUsers || 0})
                </Label>
                <Input type="number" min={0} value={renewForm.extraUsers} onChange={(e) => setRenewForm((f) => ({ ...f, extraUsers: Number(e.target.value) }))} className="rounded-xl" />
              </div>

              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-sm space-y-1">
                <div className="flex justify-between text-blue-800">
                  <span>Total Users</span>
                  <span className="font-bold">{(renewSchool.license?.includedUsers || 0) + renewForm.extraUsers}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRenewOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={handleRenew} disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-green-600 border-0 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                  Renew
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
