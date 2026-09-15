"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, Key, ShieldCheck, ShieldOff, GraduationCap,
  Heart, Loader2, Eye, EyeOff, RefreshCw, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserRecord {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: "teacher" | "non-teaching" | "parent";
  isActive: boolean;
  teacherId?: string;
  createdAt: string;
}

interface ListResponse {
  success: boolean;
  data: UserRecord[];
}

interface CountsResponse {
  success: boolean;
  data: { teachers: number; nonTeaching: number; parents: number; total: number };
}

const ROLE_TABS = [
  { key: "", label: "All", icon: Users },
  { key: "teacher", label: "Teachers", icon: GraduationCap },
  { key: "non-teaching", label: "Non-Teaching", icon: Heart },
  { key: "parent", label: "Parents", icon: Heart },
] as const;

const ROLE_COLORS: Record<string, string> = {
  teacher: "bg-blue-500/10 text-blue-600 border-blue-200",
  "non-teaching": "bg-orange-500/10 text-orange-600 border-orange-200",
  parent: "bg-rose-500/10 text-rose-600 border-rose-200",
};

async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Something went wrong.");
  return json;
}

export default function UserMasterPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({ teachers: 0, nonTeaching: 0, parents: 0, total: 0 });

  const [pwDialog, setPwDialog] = useState<{ open: boolean; user: UserRecord | null }>({ open: false, user: null });
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const [delDialog, setDelDialog] = useState<{ open: boolean; user: UserRecord | null }>({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (roleFilter) qs.set("role", roleFilter);
    if (search) qs.set("search", search);
    apiGet<ListResponse>(`/usermaster?${qs.toString()}`, token)
      .then((res) => setUsers(res.data || []))
      .catch(() => toast.error("Failed to load users."))
      .finally(() => setLoading(false));
  }, [roleFilter, search]);

  const fetchCounts = useCallback(() => {
    const token = getToken();
    if (!token) return;
    apiGet<CountsResponse>("/usermaster/counts", token)
      .then((res) => setCounts(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handlePasswordChange = async () => {
    if (!pwDialog.user || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/usermaster/${pwDialog.user.role}/${pwDialog.user.userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      await parseJson(res);
      toast.success(`Password updated for ${pwDialog.user.name}.`);
      setPwDialog({ open: false, user: null });
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (user: UserRecord) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/usermaster/${user.role}/${user.userId}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await parseJson(res);
      setUsers((prev) => prev.map((u) => (u.userId === user.userId ? { ...u, isActive: json.isActive } : u)));
      toast.success(json.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  };

  const handleDelete = async () => {
    if (!delDialog.user) return;
    const token = getToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/usermaster/${delDialog.user.role}/${delDialog.user.userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await parseJson(res);
      toast.success(`"${delDialog.user.name}" has been deleted.`);
      setUsers((prev) => prev.filter((u) => u.userId !== delDialog.user!.userId));
      setDelDialog({ open: false, user: null });
      fetchCounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554]">User Master</h1>
        <p className="text-sm text-[#64748B] mt-1">{counts.total} registered users.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: counts.total, icon: Users },
          { label: "Teachers", value: counts.teachers, icon: GraduationCap },
          { label: "Non-Teaching", value: counts.nonTeaching, icon: Heart },
          { label: "Parents", value: counts.parents, icon: Heart },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#2563EB]/10 flex items-center justify-center shrink-0">
              <s.icon className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#172554]">{s.value}</p>
              <p className="text-xs text-[#64748B]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {ROLE_TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={roleFilter === tab.key ? "default" : "outline"}
              size="sm"
              className={`gap-1.5 ${roleFilter === tab.key ? "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] border-0 text-white" : ""}`}
              onClick={() => setRoleFilter(tab.key)}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <Input placeholder="Search by name, email, phone, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchUsers(); fetchCounts(); }} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Email</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Phone</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Role</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">ID</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Status</th>
                <th className="p-3 text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-[#64748B] text-sm">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-[#64748B] text-sm">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={`${u.role}-${u.userId}`} className="hover:bg-[#F8FAFC]/60 transition-colors">
                    <td className="p-3 border-b border-[#F1F5F9]">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#2563EB]">{u.name.split(" ").map((w) => w[0]).join("")}</span>
                        </div>
                        <span className="text-sm font-medium text-[#172554]">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 border-b border-[#F1F5F9] text-sm text-[#64748B]">{u.email}</td>
                    <td className="p-3 border-b border-[#F1F5F9] text-sm text-[#64748B]">{u.phone || "-"}</td>
                    <td className="p-3 border-b border-[#F1F5F9]">
                      <span className={`text-[10px] px-2 py-1 rounded-full border font-medium capitalize ${ROLE_COLORS[u.role] || ""}`}>{u.role}</span>
                    </td>
                    <td className="p-3 border-b border-[#F1F5F9] text-xs font-mono text-[#64748B]">{u.teacherId || "-"}</td>
                    <td className="p-3 border-b border-[#F1F5F9]">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${u.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 border-b border-[#F1F5F9]">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#2563EB] hover:bg-[#2563EB]/10" title="Change Password"
                          onClick={() => { setPwDialog({ open: true, user: u }); setNewPassword(""); setShowPw(false); }}>
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${u.isActive ? "text-red-500 hover:bg-red-50" : "text-green-500 hover:bg-green-50"}`}
                          title={u.isActive ? "Deactivate" : "Activate"} onClick={() => handleToggle(u)}>
                          {u.isActive ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" title="Delete"
                          onClick={() => setDelDialog({ open: true, user: u })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={pwDialog.open} onOpenChange={(open) => { if (!open) { setPwDialog({ open: false, user: null }); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-[#2563EB]" /> Change Password
            </DialogTitle>
          </DialogHeader>
          {pwDialog.user && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-sm font-medium text-[#172554]">{pwDialog.user.name}</p>
                <p className="text-xs text-[#64748B]">{pwDialog.user.email} · <span className="capitalize">{pwDialog.user.role}</span></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748B]">New Password</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#172554]">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setPwDialog({ open: false, user: null }); setNewPassword(""); }} disabled={saving}>Cancel</Button>
                <Button className="gap-2 bg-gradient-to-r from-[#2563EB] to-[#7C3AED] border-0 text-white" onClick={handlePasswordChange} disabled={saving || !newPassword.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  {saving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={delDialog.open} onOpenChange={(open) => { if (!open) setDelDialog({ open: false, user: null }); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete User
            </DialogTitle>
          </DialogHeader>
          {delDialog.user && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-sm font-medium text-[#172554]">{delDialog.user.name}</p>
                <p className="text-xs text-[#64748B]">{delDialog.user.email} · <span className="capitalize">{delDialog.user.role}</span></p>
              </div>
              <p className="text-sm text-[#64748B]">
                This action cannot be undone. If this user has existing records (payments, homework, classes), deletion will be blocked.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDelDialog({ open: false, user: null })} disabled={deleting}>Cancel</Button>
                <Button variant="destructive" className="gap-2" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? "Deleting..." : "Delete Permanently"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
