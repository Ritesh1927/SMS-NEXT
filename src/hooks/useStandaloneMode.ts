"use client";

import { useSyncExternalStore } from "react";
import { isRunningStandalone, onStandaloneChange } from "@/pwa/platformDetection";

/**
 * True when running as the installed app (own window, no browser UI).
 * Always false during SSR and hydration, then reflects the real value.
 */
export function useStandaloneMode(): boolean {
  return useSyncExternalStore(onStandaloneChange, isRunningStandalone, () => false);
}
