"use client";

import { useAuth } from "@/contexts/AuthContext";
import AdminFeesPage from "@/components/dashboard/fees/AdminFeesPage";
import ParentFeesTab from "@/components/dashboard/fees/ParentFeesTab";

export default function FeesPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "parent") return <ParentFeesTab />;
  return <AdminFeesPage />;
}
