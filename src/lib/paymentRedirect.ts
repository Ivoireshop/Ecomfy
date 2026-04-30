// Detect if app runs inside an iframe (Lovable preview, etc.).
// In that case, popups & cross-origin redirects are unreliable —
// we must break out to the top window.
const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const openPaymentWindow = (): Window | null => {
  // No pre-opened window: it causes "stuck loading" tabs when the
  // subsequent redirect is slow or blocked. We redirect at call time.
  return null;
};

export const redirectToPaymentUrl = (paymentUrl: string, _paymentWindow?: Window | null) => {
  if (!paymentUrl) return;

  // Inside an iframe (Lovable preview), force top-level navigation so
  // GeniusPay isn't blocked by frame-ancestors / X-Frame-Options.
  if (isInIframe()) {
    try {
      if (window.top) {
        window.top.location.href = paymentUrl;
        return;
      }
    } catch {
      // Cross-origin top — fall through to window.open.
    }
    const opened = window.open(paymentUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = paymentUrl;
    }
    return;
  }

  // Standalone tab → navigate in place (most reliable, no popup blocker).
  window.location.href = paymentUrl;
};

export const closePaymentWindow = (_paymentWindow?: Window | null) => {
  // No-op: we no longer pre-open a window.
};