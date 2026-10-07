"use client";

import { useEffect, useState } from "react";
import { usePWA } from "@/pwa/installContext";
import { INSTALL_PROMPT_DELAY_MS } from "@/pwa/config";
import { shouldAutoShowInstallPrompt } from "@/pwa/installManager";

/**
 * Auto-opens the install dialog a few seconds after an authenticated shell
 * mounts. Rendered only inside the protected layouts (dashboard and
 * super-admin), so "the user is logged in" is guaranteed by placement --
 * one gate for every role, present and future, with no per-role logic.
 */
export function InstallPromptGate() {
  const { platform, isStandalone, hasDeferredPrompt, installDialogOpen, openInstallDialog } = usePWA();
  const [delayElapsed, setDelayElapsed] = useState(false);

  // The layout persists across in-app navigation, so this runs once per
  // login/page load rather than restarting on every route change.
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayElapsed(true), INSTALL_PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Re-evaluated if beforeinstallprompt arrives after the delay; the
  // session/snooze checks inside guarantee it opens at most once.
  useEffect(() => {
    if (!delayElapsed || !platform || installDialogOpen) return;
    if (shouldAutoShowInstallPrompt({ installMethod: platform.installMethod, isStandalone, hasDeferredPrompt })) {
      openInstallDialog();
    }
  }, [delayElapsed, platform, isStandalone, hasDeferredPrompt, installDialogOpen, openInstallDialog]);

  return null;
}
