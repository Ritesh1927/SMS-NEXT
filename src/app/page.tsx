"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";
import { getSuperAdminToken } from "@/lib/superAdminAuth";

export default function Home() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;
    // "/" is also the installed app's start_url, so a super admin launching
    // the app lands on their own console instead of the school login.
    router.replace(isAuthenticated ? "/dashboard" : getSuperAdminToken() ? "/super-admin" : "/login");
  }, [loading, isAuthenticated, router]);

  return <PageLoader fullScreen />;
}
