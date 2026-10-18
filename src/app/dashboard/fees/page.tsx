"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import AdminFeesPage from "@/components/dashboard/fees/AdminFeesPage";
import ParentFeesTab from "@/components/dashboard/fees/ParentFeesTab";
import { PageLoader } from "@/components/PageLoader";

export default function FeesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isNonTeachingStaff = user?.role === "teacher" && user?.staffType === "non-teaching";
  const [staffFeesOpen, setStaffFeesOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNonTeachingStaff) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { sections: Record<string, { open: boolean }> } }>("/roles/my-permissions", token)
      .then((res) => setStaffFeesOpen(!!res.data.sections.fees?.open))
      .catch(() => setStaffFeesOpen(false));
  }, [isNonTeachingStaff]);

  // Fee management is a schooladmin console -- a teaching teacher landing
  // here (e.g. a stale bookmark, now that the sidebar link is gone) would
  // only see a broken, all-zeros page, so they're still sent back. A
  // non-teaching staffer with the Fees section's "open" grant is the one
  // exception, exempted below instead.
  useEffect(() => {
    if (user?.role === "teacher" && !isNonTeachingStaff) router.replace("/dashboard");
    else if (isNonTeachingStaff && staffFeesOpen === false) router.replace("/dashboard");
  }, [user, isNonTeachingStaff, staffFeesOpen, router]);

  if (!user) return null;
  if (user.role === "teacher" && !isNonTeachingStaff) return null;
  if (isNonTeachingStaff && staffFeesOpen !== true) return <PageLoader label="Loading..." />;

  if (user.role === "parent") return <ParentFeesTab />;
  return <AdminFeesPage />;
}
