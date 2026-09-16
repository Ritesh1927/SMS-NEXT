"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AdminTeacherExams } from "@/components/dashboard/AdminTeacherExams";
import { ParentExams } from "@/components/dashboard/ParentExams";

export default function ExamsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "parent") return <ParentExams />;
  return <AdminTeacherExams />;
}
