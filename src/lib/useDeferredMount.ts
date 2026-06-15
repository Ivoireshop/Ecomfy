import { useEffect, useState } from "react";

/**
 * Returns `true` only after first paint + an idle window, so heavy/non-critical
 * subtrees (chat assistants, social proof toasts, reviews, etc.) don't compete
 * with the LCP image and the "Order now" button on public shop/product pages.
 */
export function useDeferredMount(delayMs = 1500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fire = () => { if (!cancelled) setReady(true); };
    const w = typeof window !== "undefined" ? (window as any) : null;
    const ric: ((cb: () => void, opts?: { timeout: number }) => number) | undefined =
      w?.requestIdleCallback;
    let idleId: number | undefined;
    const t = setTimeout(() => {
      if (ric) idleId = ric(fire, { timeout: 1000 });
      else fire();
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (idleId != null && w?.cancelIdleCallback) w.cancelIdleCallback(idleId);
    };
  }, [delayMs]);
  return ready;
}