"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchoolAdminDashboard } from "@/components/dashboard/SchoolAdminDashboard";

const ROLE_LABELS: Record<string, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "schooladmin") {
    return <SchoolAdminDashboard schoolName={user.schoolName} />;
  }

  return (
    <div className="max-w-2xl">
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
