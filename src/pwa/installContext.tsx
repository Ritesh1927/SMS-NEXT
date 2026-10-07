"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { useStandaloneMode } from "@/hooks/useStandaloneMode";
import { APP_NAME } from "./config";
import { getPlatformSnapshot, type PlatformInfo } from "./platformDetection";
import {
  isAppInstalledOnDevice,
  markInstalled,
  markShownThisSession,
  snoozeInstallPrompt,
  wasInstalledBefore,
  type InstallOutcome,
} from "./installManager";
import {
  getDeferredPrompt,
  getInstalledThisSession,
  showNativeInstallPrompt,
  subscribeInstallPrompt,
} from "./installPromptStore";
import { applyServiceWorkerUpdate, registerServiceWorker } from "./serviceWorker";

/**
 * What the install dialog / "Download app" entry should offer right now:
 * - "standalone":   already running as the app -- nothing to offer
 * - "prompt":       Chromium gave us beforeinstallprompt -- one-click install
 * - "ios" / "macos-safari": Safari has no install API -- manual steps
 * - "installed":    installed on this device, but we're in a browser tab --
 *                   explain how to open the app
 * - "browser-menu": no prompt available (not eligible yet, Firefox...) --
 *                   install from the browser's own menu
 */
export type InstallMode = "standalone" | "prompt" | "ios" | "macos-safari" | "installed" | "browser-menu";

interface PWAContextValue {
  /** null during SSR/hydration; detected right after mount. */
  platform: PlatformInfo | null;
  isStandalone: boolean;
  /** Running as the app, or installed on this device as far as we can tell. */
  isInstalled: boolean;
  /** Chromium handed us a beforeinstallprompt event we can trigger. */
  hasDeferredPrompt: boolean;
  /** null until the platform is known (after hydration). */
  installMode: InstallMode | null;

  installDialogOpen: boolean;
  /** Mode captured when the dialog opened, so its content can't flip mid-install. */
  dialogMode: InstallMode;
  openInstallDialog: () => void;
  /** "Maybe Later" / close: hides the dialog and snoozes auto-open for 7 days. */
  dismissInstallDialog: () => void;
  /** Closes an informational dialog (no snooze). */
  closeInstallDialog: () => void;
  /** "Install Now": triggers the browser's native install prompt. */
  promptInstall: () => Promise<InstallOutcome>;
  /** iOS/Safari "I've added it": no API can confirm it, so take the user's word. */
  confirmManualInstall: () => void;

  updateAvailable: boolean;
  applyUpdate: () => void;
}

const PWAContext = createContext<PWAContextValue | null>(null);

const subscribeNoop = () => () => {};

export function PWAProvider({ children }: { children: ReactNode }) {
  const platform = useSyncExternalStore(subscribeNoop, getPlatformSnapshot, () => null);
  const isStandalone = useStandaloneMode();
  const deferredPrompt = useSyncExternalStore(subscribeInstallPrompt, getDeferredPrompt, () => null);
  const installedThisSession = useSyncExternalStore(subscribeInstallPrompt, getInstalledThisSession, () => false);

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<InstallMode>("browser-menu");
  const [manualInstallConfirmed, setManualInstallConfirmed] = useState(false);
  const [installedOnDevice, setInstalledOnDevice] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => registerServiceWorker(setWaitingWorker), []);

  // Covers installs made before this code shipped or through the browser's
  // own UI (e.g. Chrome's address-bar icon), which never hit `appinstalled`.
  useEffect(() => {
    isAppInstalledOnDevice().then(setInstalledOnDevice);
  }, []);

  // Confirms a successful install (from our dialog or the browser's own UI).
  // installedThisSession only ever flips false -> true via `appinstalled`.
  useEffect(() => {
    if (installedThisSession) toast.success(`${APP_NAME} has been installed successfully.`);
  }, [installedThisSession]);

  // Opening as the app proves it's installed. Chromium shares storage
  // between the app window and browser tabs, so this also stops the prompt
  // showing in a tab. (iOS isolates home-screen app storage, so it can't.)
  useEffect(() => {
    if (isStandalone) markInstalled();
  }, [isStandalone]);

  let installMode: InstallMode | null = null;
  if (platform) {
    const knownInstalled = installedThisSession || installedOnDevice || manualInstallConfirmed || wasInstalledBefore();
    if (isStandalone) installMode = "standalone";
    // Chromium only fires beforeinstallprompt when the app is NOT
    // installed, so a live event outranks any stored "installed" record.
    else if (deferredPrompt) installMode = "prompt";
    else if (knownInstalled) installMode = "installed";
    else if (platform.installMethod === "ios" || platform.installMethod === "macos-safari") installMode = platform.installMethod;
    else installMode = "browser-menu";
  }

  const openInstallDialog = useCallback(() => {
    if (!installMode || installMode === "standalone") return;
    markShownThisSession();
    setDialogMode(installMode);
    setInstallDialogOpen(true);
  }, [installMode]);

  const dismissInstallDialog = useCallback(() => {
    snoozeInstallPrompt();
    setInstallDialogOpen(false);
  }, []);

  const closeInstallDialog = useCallback(() => setInstallDialogOpen(false), []);

  const promptInstall = useCallback(async () => {
    const outcome = await showNativeInstallPrompt();
    // Declining the browser's own prompt counts as "Maybe Later" too.
    if (outcome !== "accepted") snoozeInstallPrompt();
    setInstallDialogOpen(false);
    return outcome;
  }, []);

  const confirmManualInstall = useCallback(() => {
    markInstalled();
    setManualInstallConfirmed(true);
    setInstallDialogOpen(false);
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) applyServiceWorkerUpdate(waitingWorker);
  }, [waitingWorker]);

  const value = useMemo<PWAContextValue>(
    () => ({
      platform,
      isStandalone,
      isInstalled: installMode === "standalone" || installMode === "installed",
      hasDeferredPrompt: deferredPrompt !== null,
      installMode,
      installDialogOpen,
      dialogMode,
      openInstallDialog,
      dismissInstallDialog,
      closeInstallDialog,
      promptInstall,
      confirmManualInstall,
      updateAvailable: waitingWorker !== null,
      applyUpdate,
    }),
    [
      platform, isStandalone, deferredPrompt, installMode, installDialogOpen, dialogMode, openInstallDialog,
      dismissInstallDialog, closeInstallDialog, promptInstall, confirmManualInstall, waitingWorker, applyUpdate,
    ],
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA(): PWAContextValue {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWA must be used within PWAProvider");
  return ctx;
}
