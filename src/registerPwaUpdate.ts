/**
 * Auto-registers the Service Worker and automatically reloads the page
 * whenever a new deployment/version is activated, ensuring users (and founders)
 * always land directly on the latest version without needing to manual refresh.
 */
export function initPwaAutoUpdate() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  let reloading = false;

  // Listen for SW controller change -> new SW took over
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // If a new worker is waiting, activate it immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // On new update found
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });

        // Periodically check for updates every 10 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 10 * 60 * 1000);

        // Check for updates whenever tab becomes visible
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration error:", err);
      });
  });
}
