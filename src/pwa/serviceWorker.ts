// Registers /sw.js and reports when a newer deploy's worker is waiting.
// Activation is deliberately user-driven (UpdateBanner -> applyUpdate) so a
// tab never swaps code underneath someone mid-form.
import { SERVICE_WORKER_URL, UPDATE_CHECK_INTERVAL_MS } from "./config";

export function isServiceWorkerSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Registers the worker and calls `onUpdateReady` whenever a new version has
 * installed and is waiting. Returns a cleanup function.
 *
 * Production only: in `next dev`, a caching worker would fight Turbopack's
 * HMR and serve stale chunks. Test with `next build && next start`.
 */
export function registerServiceWorker(onUpdateReady: (worker: ServiceWorker) => void): () => void {
  if (!isServiceWorkerSupported() || process.env.NODE_ENV !== "production") return () => {};

  let disposed = false;
  let intervalId: number | undefined;
  let registration: ServiceWorkerRegistration | undefined;

  // A waiting worker only means "update" if a previous one already controls
  // this page; on the very first visit, the first worker isn't an update.
  const reportIfWaiting = (worker: ServiceWorker | null) => {
    if (!disposed && worker && navigator.serviceWorker.controller) onUpdateReady(worker);
  };

  const checkForUpdate = () => {
    registration?.update().catch(() => {
      // Offline or server hiccup -- the next check will retry.
    });
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") checkForUpdate();
  };

  navigator.serviceWorker
    // updateViaCache "none": always revalidate sw.js with the server, never
    // trust the HTTP cache, so a deploy is noticed on the next check.
    .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
    .then((reg) => {
      if (disposed) return;
      registration = reg;
      reportIfWaiting(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") reportIfWaiting(installing);
        });
      });

      // School staff keep the dashboard open all day; poll hourly and
      // whenever the tab/app comes back to the foreground.
      intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", onVisible);
    })
    .catch((err) => {
      // Never fatal: the app works exactly as before without a worker.
      console.warn("[pwa] Service worker registration failed:", err);
    });

  return () => {
    disposed = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * Activates the waiting worker and reloads once it takes control. The
 * reload is what makes the page pick up the new deploy's JS/CSS; user data
 * lives on the server and in localStorage, so nothing is lost.
 */
export function applyServiceWorkerUpdate(worker: ServiceWorker): void {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  worker.postMessage({ type: "SKIP_WAITING" });
}
