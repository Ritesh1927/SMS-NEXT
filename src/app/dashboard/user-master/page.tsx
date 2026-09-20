"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, Key, ShieldCheck, ShieldOff, GraduationCap,
  Heart, Briefcase, Loader2, Eye, EyeOff, RefreshCw, Trash2, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";

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

const ROLE_COLORS: Record<string, string> = {
  teacher: "bg-blue-500/10 text-blue-600 border-blue-200",
  "non-teaching": "bg-orange-500/10 text-orange-600 border-orange-200",
  parent: "bg-rose-500/10 text-rose-600 border-rose-200",
};

const ROLE_AVATAR: Record<string, string> = {
  teacher: "bg-blue-500/10 text-blue-600",
  "non-teaching": "bg-orange-500/10 text-orange-600",
  parent: "bg-rose-500/10 text-rose-600",
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
      <PageHeader icon={UserCog} title="User Master" subtitle={`${counts.total} registered users.`} accent="slate" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatFilterCard
          icon={Users}
          color="#4F46E5"
          colorDark="#4338CA"
          value={counts.total}
          label="Total Users"
          active={roleFilter === ""}
          onClick={() => setRoleFilter("")}
        />
        <StatFilterCard
          icon={GraduationCap}
          color="#3B82F6"
          colorDark="#2563EB"
          value={counts.teachers}
          label="Teachers"
          sublabel={counts.total > 0 ? `${Math.round((counts.teachers / counts.total) * 100)}% of users` : undefined}
          active={roleFilter === "teacher"}
          onClick={() => setRoleFilter(roleFilter === "teacher" ? "" : "teacher")}
        />
        <StatFilterCard
          icon={Briefcase}
          color="#F97316"
          colorDark="#EA580C"
          value={counts.nonTeaching}
          label="Non-Teaching"
          sublabel={counts.total > 0 ? `${Math.round((counts.nonTeaching / counts.total) * 100)}% of users` : undefined}
          active={roleFilter === "non-teaching"}
          onClick={() => setRoleFilter(roleFilter === "non-teaching" ? "" : "non-teaching")}
        />
        <StatFilterCard
          icon={Heart}
          color="#F43F5E"
          colorDark="#E11D48"
          value={counts.parents}
          label="Parents"
          sublabel={counts.total > 0 ? `${Math.round((counts.parents / counts.total) * 100)}% of users` : undefined}
          active={roleFilter === "parent"}
          onClick={() => setRoleFilter(roleFilter === "parent" ? "" : "parent")}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input placeholder="Search by name, email, phone, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {roleFilter !== "" && (
          <button
            type="button"
            onClick={() => setRoleFilter("")}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter ×
          </button>
        )}
        <Button variant="outline" size="sm" onClick={() => { fetchUsers(); fetchCounts(); }} className="gap-1.5 sm:ml-auto">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Email</th>
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Phone</th>
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Role</th>
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">ID</th>
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Status</th>
                <th className="p-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="p-3 border-b border-border">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-36" /></td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-14" /></td>
                    <td className="p-3 border-b border-border"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="p-0"><EmptyState icon={UserCog} message="No users found." /></td></tr>
              ) : (
                users.map((u) => (
                  <tr key={`${u.role}-${u.userId}`} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${ROLE_AVATAR[u.role] || "bg-primary/10 text-primary"}`}>
                          <span className="text-xs font-bold">{u.name.split(" ").map((w) => w[0]).join("")}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 border-b border-border text-sm text-muted-foreground">{u.email}</td>
                    <td className="p-3 border-b border-border text-sm text-muted-foreground">{u.phone || "-"}</td>
                    <td className="p-3 border-b border-border">
                      <span className={`text-[10px] px-2 py-1 rounded-full border font-medium capitalize ${ROLE_COLORS[u.role] || ""}`}>{u.role}</span>
                    </td>
                    <td className="p-3 border-b border-border text-xs font-mono text-muted-foreground">{u.teacherId || "-"}</td>
                    <td className="p-3 border-b border-border">
                      <span className={statusPillClass(u.isActive ? "success" : "destructive")}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 border-b border-border">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Change Password"
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
              <Key className="h-5 w-5 text-primary" /> Change Password
            </DialogTitle>
          </DialogHeader>
          {pwDialog.user && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium text-foreground">{pwDialog.user.name}</p>
                <p className="text-xs text-muted-foreground">{pwDialog.user.email} · <span className="capitalize">{pwDialog.user.role}</span></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">New Password</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setPwDialog({ open: false, user: null }); setNewPassword(""); }} disabled={saving}>Cancel</Button>
                <Button className="gap-2 bg-gradient-to-r from-primary to-accent border-0 text-white" onClick={handlePasswordChange} disabled={saving || !newPassword.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  {saving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={delDialog.open}
        onOpenChange={(open) => { if (!open) setDelDialog({ open: false, user: null }); }}
        title={`Delete "${delDialog.user?.name ?? "User"}"?`}
        description="This action cannot be undone. If this user has existing records (payments, homework, classes), deletion will be blocked."
        confirmLabel="Delete Permanently"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
