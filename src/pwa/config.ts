// Single source of truth for PWA identity, timings and storage keys, shared
// by the manifest (app/manifest.ts), the install flow and the update flow.

export const APP_NAME = "EduNivo";
export const APP_FULL_NAME = "EduNivo School ERP";
export const APP_DESCRIPTION =
  "EduNivo School Management System: attendance, exams, fees, homework and communication for every role.";

// Hex equivalents of the brand tokens in globals.css (--primary, --background).
// Used where CSS variables can't reach: manifest, splash screen, OS title bar.
export const THEME_COLOR = "#5048e5";
export const BACKGROUND_COLOR = "#eff0f6";

/** Delay after the dashboard mounts before the install dialog may appear. */
export const INSTALL_PROMPT_DELAY_MS = 4500;

/** How long "Maybe Later" suppresses the automatic install dialog. */
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** How often an open tab asks the server whether a new version shipped. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export const SERVICE_WORKER_URL = "/sw.js";

export const STORAGE_KEYS = {
  /** localStorage: timestamp of the last "Maybe Later" / dismissal. */
  dismissedAt: "sms_next_pwa_install_dismissed_at",
  /** localStorage: set once the browser reports a successful install. */
  installed: "sms_next_pwa_installed",
  /** sessionStorage: the dialog already auto-opened in this tab session. */
  shownThisSession: "sms_next_pwa_install_shown",
} as const;

/** Custom link scheme the installed app handles (manifest protocol_handlers). */
export const APP_PROTOCOL = "web+edunivo";
