"use client";

import { UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchoolAdminDashboard } from "@/components/dashboard/SchoolAdminDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { PageHeader } from "@/components/PageHeader";

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
    return <SchoolAdminDashboard adminName={user.name} schoolName={user.schoolName} />;
  }

  if (user.role === "parent") {
    return <ParentDashboard />;
  }

  if (user.role === "teacher") {
    return <TeacherDashboard />;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        icon={UserCircle}
        title={`Welcome, ${user.name}`}
        subtitle={`You're signed in as ${ROLE_LABELS[user.role] || user.role}${user.schoolName ? ` at ${user.schoolName}` : ""}.`}
      />

      <Card className="mt-6 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Account</CardTitle>
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

      <p className="mt-6 text-xs text-muted-foreground">
        A full dashboard for this role hasn&apos;t been built yet — school admin is first.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
