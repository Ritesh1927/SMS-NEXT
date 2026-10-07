"use client";

import { usePWA } from "@/pwa/installContext";

/** Install-related slice of the PWA context, for install buttons/dialogs. */
export function useInstallPrompt() {
  const {
    platform, installMode, hasDeferredPrompt, installDialogOpen, dialogMode,
    openInstallDialog, dismissInstallDialog, closeInstallDialog, promptInstall, confirmManualInstall,
  } = usePWA();
  return {
    installMethod: platform?.installMethod ?? "none",
    os: platform?.os ?? "unknown",
    browser: platform?.browser ?? "other",
    installMode,
    hasDeferredPrompt,
    installDialogOpen,
    dialogMode,
    openInstallDialog,
    dismissInstallDialog,
    closeInstallDialog,
    promptInstall,
    confirmManualInstall,
  };
}
