"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Search, Trash2, ChevronLeft, ChevronRight, Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { format } from "date-fns";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

interface LoginLogRow {
  _id: string;
  userName: string;
  email: string;
  role: string;
  ip: string;
  browser: string;
  os: string;
  device: string;
  location: string;
  loginAt: string;
}

interface LoginLogsResponse {
  success: boolean;
  data: LoginLogRow[];
  total: number;
  page: number;
  pages: number;
}

const ROLE_LABELS: Record<string, string> = { schooladmin: "Admin", teacher: "Teacher", parent: "Parent" };
const ROLE_COLORS: Record<string, string> = {
  schooladmin: "bg-blue-100 text-blue-700",
  teacher: "bg-green-100 text-green-700",
  parent: "bg-purple-100 text-purple-700",
};

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d.includes("iphone") || d.includes("android") || d.includes("mobile")) return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  if (d.includes("ipad") || d.includes("tablet")) return <Tablet className="h-4 w-4 text-muted-foreground" />;
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

export default function LoginActivityPage() {
  const [logs, setLogs] = useState<LoginLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purgeFrom, setPurgeFrom] = useState("");
  const [purgeTo, setPurgeTo] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);

  const fetchLogs = (p: number) => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    apiGet<LoginLogsResponse>(`/login-logs?${params}`, token)
      .then((res) => {
        setLogs(res.data);
        setTotal(res.total);
        setPages(res.pages);
        setPage(res.page);
      })
      .catch(() => toast.error("Failed to load login logs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, fromDate, toDate]);

  const handlePurgeClick = () => {
    if (!purgeFrom || !purgeTo) {
      toast.error("Please select both from and to dates.");
      return;
    }
    setPurgeDialogOpen(true);
  };

  const confirmPurge = async () => {
    const token = getToken();
    if (!token) return;
    setPurging(true);
    try {
      const res = await fetch("/api/login-logs/purge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from: purgeFrom, to: purgeTo }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to purge logs.");
      toast.success(json.message);
      setPurgeFrom("");
      setPurgeTo("");
      setPurgeDialogOpen(false);
      fetchLogs(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to purge logs.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Activity} title="Login Activity" subtitle="Track all user logins across your school" accent="slate" />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
              <Select
                items={[
                  { value: "__all__", label: "All Roles" },
                  { value: "schooladmin", label: "Admin" },
                  { value: "teacher", label: "Teacher" },
                  { value: "parent", label: "Parent" },
                ]}
                value={roleFilter || "__all__"}
                onValueChange={(v) => setRoleFilter(v === "__all__" ? "" : v || "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Roles</SelectItem>
                  <SelectItem value="schooladmin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Login History <span className="text-sm font-normal text-muted-foreground ml-2">({total} records)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState icon={Activity} message="No login records found." />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      <p className="font-medium text-sm text-foreground">{log.userName}</p>
                      <p className="text-xs text-muted-foreground">{log.email}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[log.role] || ""}`}>{ROLE_LABELS[log.role] || log.role}</span>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(log.loginAt), "dd MMM yyyy, hh:mm a")}</TableCell>
                    <TableCell className="text-sm font-mono">{log.ip || "-"}</TableCell>
                    <TableCell className="text-sm">{log.browser || "-"}</TableCell>
                    <TableCell className="text-sm">{log.os || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon device={log.device} />
                        <span className="text-sm">{log.device || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{log.location || "-"}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage(page - 1);
                    fetchLogs(page - 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => {
                    setPage(page + 1);
                    fetchLogs(page + 1);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Purge Login Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Select a date range to permanently delete login records.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Input type="date" value={purgeFrom} onChange={(e) => setPurgeFrom(e.target.value)} />
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input type="date" value={purgeTo} onChange={(e) => setPurgeTo(e.target.value)} />
            </div>
            <Button variant="destructive" disabled={purging || !purgeFrom || !purgeTo} onClick={handlePurgeClick}>
              {purging ? "Purging…" : "Purge Logs"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={purgeDialogOpen}
        onOpenChange={setPurgeDialogOpen}
        title="Purge Login Logs?"
        description={`Delete all login logs from ${purgeFrom} to ${purgeTo}?`}
        confirmLabel="Purge"
        loading={purging}
        onConfirm={confirmPurge}
      />
    </div>
  );
}
