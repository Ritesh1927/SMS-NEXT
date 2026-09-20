"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ChevronRight, Loader2, Save, Layout } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, EmptyStateCompact } from "@/components/EmptyState";
import { PERMISSION_GROUPS, PAGE_GROUPS } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";

interface TeacherItem {
  _id: string;
  name: string;
  email: string;
  teacherId: string;
}

interface PermissionEntry {
  teacher: TeacherItem;
  permissions: string[];
  pages: string[];
}

interface ListResponse {
  success: boolean;
  data: PermissionEntry[];
}

interface DetailResponse {
  success: boolean;
  data: { permissions: string[]; pages: string[] };
}

export default function RolesPermissionsPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [selected, setSelected] = useState<TeacherItem | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    apiGet<ListResponse>("/permissions", token)
      .then((res) => setTeachers(res.data.map((d) => d.teacher)))
      .catch(() => toast.error("Failed to load teachers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    load();
  }, [load]);

  const selectTeacher = async (t: TeacherItem) => {
    setSelected(t);
    setLoadingPerms(true);
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiGet<DetailResponse>(`/permissions/${t._id}`, token);
      setPerms(res.data.permissions || []);
      setPages(res.data.pages || []);
    } catch {
      setPerms([]);
      setPages([]);
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePerm = (key: string) => {
    setPerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const togglePage = (key: string) => {
    setPages((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = async () => {
    if (!selected) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/permissions/${selected._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: perms, pages }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save.");
      toast.success(`Permissions saved for ${selected.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Shield} title="Roles & Permissions" subtitle="Assign page access and permissions to teachers" accent="slate" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher list */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Teachers</h2>
          </div>
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <EmptyStateCompact message="No teachers found." />
          ) : (
            <div className="divide-y divide-border">
              {teachers.map((t) => (
                <button
                  key={t._id}
                  onClick={() => selectTeacher(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${
                    selected?._id === t._id ? "bg-muted border-l-[3px] border-l-primary" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.teacherId}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Permissions panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="rounded-2xl border border-border bg-card h-full flex items-center justify-center min-h-[300px]">
              <EmptyState icon={Shield} message="Select a teacher to manage permissions" />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {perms.length} perms · {pages.length} pages
                  </Badge>
                  <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-accent border-0 text-white" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              </div>
              <div className="p-4">
                {loadingPerms ? (
                  <div className="space-y-6">
                    {Array.from({ length: 2 }).map((_, g) => (
                      <div key={g}>
                        <Skeleton className="h-4 w-32 mb-3" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-xl" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Layout className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Access</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">Control which pages appear in the teacher&apos;s sidebar navigation. Leave everything off to allow all pages.</p>
                      <div className="space-y-4">
                        {PAGE_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-foreground mb-2">{group.label}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.keys.map(({ key, label }) => (
                                <PermissionRow key={key} label={label} checked={pages.includes(key)} onToggle={() => togglePage(key)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Permissions</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">Control what actions the teacher can perform on each page.</p>
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-foreground mb-2">{group.label}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.keys.map(({ key, label }) => (
                                <PermissionRow key={key} label={label} checked={perms.includes(key)} onToggle={() => togglePerm(key)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${checked ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-5 w-9 shrink-0 appearance-none rounded-full bg-border checked:bg-primary transition-colors relative cursor-pointer before:absolute before:h-4 before:w-4 before:rounded-full before:bg-card before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-4"
      />
    </div>
  );
}
