"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSuperAdminToken } from "@/lib/superAdminAuth";

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }

  return <>{children}</>;
}
