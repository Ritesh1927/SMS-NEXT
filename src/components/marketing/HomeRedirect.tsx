"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSuperAdminToken } from "@/lib/superAdminAuth";

/**
 * "/" is both the public homepage and the installed app's start_url.
 * Signed-in users and installed-app launches keep their old behaviour:
 * school users -> /dashboard, super admins -> /super-admin, an installed app
 * with nobody signed in -> /login. Everyone else sees the homepage.
 *
 * HOME_REDIRECT_SCRIPT (homeRedirectScript.ts) does this before first paint on a full page load (no
 * flash of the homepage); this component covers client-side navigations
 * to "/", where inline scripts don't run.
 */
export function HomeRedirect() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const target = isAuthenticated ? "/dashboard" : getSuperAdminToken() ? "/super-admin" : standalone ? "/login" : null;
    if (target) router.replace(target);
  }, [loading, isAuthenticated, router]);

  return null;
}
