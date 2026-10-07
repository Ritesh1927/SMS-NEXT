"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import { PageLoader } from "@/components/PageLoader";
import { InstallPromptGate } from "@/components/pwa/InstallPromptGate";
import { ReportBugButton } from "@/components/bugs/ReportBugButton";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";

export default function SuperAdminProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSuperAdminToken()) {
      router.replace("/super-admin/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: one-time client-side auth check on mount, no external subscription to model this as.
    setReady(true);
  }, [router]);

  if (!ready) {
    return <PageLoader fullScreen dark />;
  }

  // Sidebar + header chrome for every protected Super Admin page.
  return (
    <>
      <SuperAdminShell>{children}</SuperAdminShell>
      <InstallPromptGate />
      <ReportBugButton track="superadmin" />
    </>
  );
}
