// Captures Chromium's `beforeinstallprompt` event as early as possible and
// exposes it as a tiny external store (read via useSyncExternalStore).
//
// Why module-level instead of a useEffect: the browser can fire the event
// once, shortly after load, before React has hydrated and run effects.
// Listening at module evaluation catches it; the dashboard may mount (and
// want the event) seconds later, or on a different route entirely.
import { markInstalled, type BeforeInstallPromptEvent } from "./installManager";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's own mini-infobar; we show our dialog instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    // Chromium only fires this when the app is NOT installed, so it also
    // corrects a stale "installed" record after an uninstall.
    installedThisSession = false;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisSession = true;
    markInstalled();
    emit();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function getInstalledThisSession(): boolean {
  return installedThisSession;
}

/**
 * Shows the native install prompt. Must be called from a user gesture (a
 * click). The event is single-use, so it's cleared whatever the outcome;
 * Chromium fires a fresh one later if the user declined.
 */
export async function showNativeInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  emit();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}
