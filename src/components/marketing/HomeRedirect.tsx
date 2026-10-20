"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "/" is both the public homepage and the installed app's start_url.
 * Signed-in school users keep their old behaviour (-> /dashboard), and an
 * installed app with nobody signed in goes to /login. Everyone else sees
 * the homepage -- including a lingering superadmin session: "/" is the
 * public marketing URL, and auto-resuming the internal admin console from a
 * stale token (no re-auth) on a link anyone could open is a bigger surprise
 * than convenience. A superadmin returns via their own bookmark/URL to
 * /super-admin instead.
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
    const target = isAuthenticated ? "/dashboard" : standalone ? "/login" : null;
    if (target) router.replace(target);
  }, [loading, isAuthenticated, router]);

  return null;
}
