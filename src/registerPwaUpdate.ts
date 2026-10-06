/**
 * Auto-registers the Service Worker safely without forcing disruptive
 * page reloads during active merchant editing sessions or file picker dialogs.
 */
export function initPwaAutoUpdate() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Periodically check for updates every 30 minutes in background
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[SW] Registration error:", err);
      });
  });
}
