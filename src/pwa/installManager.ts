// Pure install-flow logic: the browser event type, persisted user choices,
// and the single rule deciding whether the dialog may auto-open. Kept free
// of React so the rules are easy to read in one place.
import { INSTALL_SNOOZE_MS, STORAGE_KEYS } from "./config";
import type { InstallMethod } from "./platformDetection";

/** Chromium-only event; not in TypeScript's DOM lib yet. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

// Storage can throw (Safari private mode, blocked site data). The install
// prompt is a nicety, so every failure degrades to "no preference saved".
function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore -- worst case the user sees the prompt again later.
  }
}

/** "Maybe Later": hide the automatic dialog for INSTALL_SNOOZE_MS. */
export function snoozeInstallPrompt(): void {
  writeStorage(localStorage, STORAGE_KEYS.dismissedAt, String(Date.now()));
}

export function isInstallPromptSnoozed(): boolean {
  const dismissedAt = Number(readStorage(localStorage, STORAGE_KEYS.dismissedAt));
  return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < INSTALL_SNOOZE_MS;
}

export function markInstalled(): void {
  writeStorage(localStorage, STORAGE_KEYS.installed, "1");
}

/**
 * Whether this browser previously reported a successful install. Only a
 * hint: the user may uninstall later, which no browser reports back. That's
 * why Chromium's own signal (beforeinstallprompt firing again) overrides it.
 */
export function wasInstalledBefore(): boolean {
  return readStorage(localStorage, STORAGE_KEYS.installed) === "1";
}

/**
 * Asks Chromium whether this PWA is installed, from a normal browser tab.
 * Best effort: unsupported browsers (Safari, Firefox) and platforms where
 * Chromium doesn't report web apps resolve to false.
 */
export async function isAppInstalledOnDevice(): Promise<boolean> {
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<Array<{ platform: string }>> };
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((app) => app.platform === "webapp");
  } catch {
    return false;
  }
}

export function markShownThisSession(): void {
  writeStorage(sessionStorage, STORAGE_KEYS.shownThisSession, "1");
}

export function wasShownThisSession(): boolean {
  return readStorage(sessionStorage, STORAGE_KEYS.shownThisSession) === "1";
}

interface AutoShowInput {
  installMethod: InstallMethod;
  isStandalone: boolean;
  /** A captured beforeinstallprompt event is waiting to be used. */
  hasDeferredPrompt: boolean;
}

/**
 * The one rule for auto-opening the install dialog. The caller guarantees
 * the user is authenticated (the gate only renders inside protected layouts).
 */
export function shouldAutoShowInstallPrompt({ installMethod, isStandalone, hasDeferredPrompt }: AutoShowInput): boolean {
  if (isStandalone) return false;
  if (isInstallPromptSnoozed() || wasShownThisSession()) return false;

  switch (installMethod) {
    // Chromium only fires beforeinstallprompt when the app is installable
    // AND not already installed, so its presence is the most reliable
    // "not installed" signal available -- better than any stored flag.
    case "prompt":
      return hasDeferredPrompt;
    // Safari has no install API and no way to ask whether the app is on the
    // home screen, so fall back to our own record of a past install.
    case "ios":
    case "macos-safari":
      return !wasInstalledBefore();
    default:
      return false;
  }
}
