"use client";

import { usePWA } from "@/pwa/installContext";

/** Read-only app status: installed/standalone state and pending updates. */
export function usePWAStatus() {
  const { platform, isStandalone, isInstalled, updateAvailable, applyUpdate } = usePWA();
  return { platform, isStandalone, isInstalled, updateAvailable, applyUpdate };
}
