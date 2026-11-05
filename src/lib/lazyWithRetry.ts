import { lazy } from "react";

// Wrap lazy() so that a stale chunk (after a redeploy) doesn't leave the user
// on a blank screen. We retry once, and if it still fails we hard-reload the
// page so the browser fetches the new asset manifest.
const RELOAD_KEY = "__chunk_reload_attempted__";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- même contrainte que React.lazy : les props du composant sont libres
export const lazyWithRetry = <T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        return await factory();
      } catch (err2) {
        if (typeof window !== "undefined") {
          const already = sessionStorage.getItem(RELOAD_KEY);
          if (!already) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // Return a never-resolving promise to avoid Suspense throwing again.
            return new Promise<T>(() => {});
          }
        }
        throw err2;
      }
    }
  });

/** Recharge la page une seule fois si un fichier du site est introuvable (nouvelle version déployée entre-temps). */
export function reloadOnceOnChunkError(): void {
  try {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  } catch {
    // storage unavailable: nothing more we can do
  }
}
