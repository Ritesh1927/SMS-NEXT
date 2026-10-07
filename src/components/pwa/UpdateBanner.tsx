"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAStatus } from "@/hooks/usePWAStatus";
import { APP_NAME } from "@/pwa/config";

/**
 * Non-intrusive notice shown once a new deploy has finished downloading in
 * the background (its service worker is installed and waiting).
 * - Update Now: activates it and reloads into the new version. Sign-in
 *   lives in localStorage, so the session survives the reload.
 * - Later: hides the notice for this page load; the new version then
 *   activates by itself once every EduNivo tab/window has been closed.
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = usePWAStatus();
  const [hidden, setHidden] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!updateAvailable || hidden) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Below lg the dashboard has a fixed bottom nav; float above it.
      className="fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-in overflow-hidden rounded-2xl bg-card/90 shadow-[0_24px_60px_-20px_rgba(37,30,140,0.45)] ring-1 ring-primary/15 backdrop-blur-xl duration-300 fade-in-0 slide-in-from-bottom-4 lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0 lg:w-[400px] dark:ring-white/10"
    >
      <div className="h-1 bg-gradient-to-r from-primary to-accent" />
      <div className="flex items-start gap-3 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-semibold text-foreground">A new version of {APP_NAME} is ready.</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Already downloaded. Update in a second, without signing out.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-lg bg-gradient-to-r from-primary to-accent font-semibold shadow-md shadow-primary/25 hover:opacity-95"
              onClick={() => {
                setUpdating(true);
                applyUpdate();
              }}
              disabled={updating}
            >
              {updating && <Loader2 className="animate-spin" />}
              {updating ? "Updating…" : "Update Now"}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" onClick={() => setHidden(true)} disabled={updating}>
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
