"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AdminFeesPage from "@/components/dashboard/fees/AdminFeesPage";
import ParentFeesTab from "@/components/dashboard/fees/ParentFeesTab";

export default function FeesPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Fee management is a schooladmin console -- its APIs are admin-only, so
  // a teacher landing here (e.g. a stale bookmark, now that the sidebar
  // link is gone) would only see a broken, all-zeros page. Send them back
  // to their dashboard instead.
  useEffect(() => {
    if (user?.role === "teacher") router.replace("/dashboard");
  }, [user, router]);

  if (!user || user.role === "teacher") return null;

  if (user.role === "parent") return <ParentFeesTab />;
  return <AdminFeesPage />;
}
