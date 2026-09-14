"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchoolAdminDashboard } from "@/components/dashboard/SchoolAdminDashboard";

const ROLE_LABELS: Record<string, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex flex-1 flex-col bg-[#F8FAFC]">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[#172554] tracking-tight">EduNivo</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" /> Logout
        </Button>
      </header>

      <main className="flex-1 px-6 py-10">
        {user.role === "schooladmin" ? (
          <div className="mx-auto max-w-5xl">
            <SchoolAdminDashboard schoolName={user.schoolName} />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-bold text-[#172554]">Welcome, {user.name}</h1>
            <p className="text-sm text-[#64748B] mt-1">
              You&apos;re signed in as {ROLE_LABELS[user.role] || user.role}
              {user.schoolName ? ` at ${user.schoolName}` : ""}.
            </p>

            <Card className="mt-6 rounded-2xl border-[#E2E8F0]">
              <CardHeader>
                <CardTitle className="text-base text-[#172554]">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={user.name} />
                <Row label="Email" value={user.email} />
                <Row label="Role" value={ROLE_LABELS[user.role] || user.role} />
                {user.schoolName && <Row label="School" value={user.schoolName} />}
                {user.schoolCode && <Row label="School Code" value={user.schoolCode} />}
                {user.teacherId && <Row label="Teacher ID" value={user.teacherId} />}
              </CardContent>
            </Card>

            <p className="mt-6 text-xs text-[#94A3B8]">
              A full dashboard for this role hasn&apos;t been built yet — school admin is first.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F1F5F9] py-1.5 last:border-0">
      <span className="text-[#64748B]">{label}</span>
      <span className="font-medium text-[#172554]">{value}</span>
    </div>
  );
}
