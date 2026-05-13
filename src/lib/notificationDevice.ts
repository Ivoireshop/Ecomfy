const DEVICE_ID_STORAGE_KEY = "vp_notification_device_id";
const RECENT_ORDER_TTL_MS = 2 * 60 * 1000;

const recentOrders = new Map<string, number>();

export function getOrCreateNotificationDeviceId(): string {
  if (typeof window === "undefined") return "server";

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

export function getNotificationDeviceKey(kind: "web" | "native", platform?: string): string {
  const suffix = platform ? `-${platform}` : "";
  return `${kind}${suffix}:${getOrCreateNotificationDeviceId()}`;
}

export function getStableNotificationId(orderId?: string | null): number {
  const source = orderId || `order-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function shouldHandleOrderNotification(orderId?: string | null, source = "default"): boolean {
  if (!orderId) return true;
  const now = Date.now();
  const key = `${source}:${orderId}`;
  const expiresAt = recentOrders.get(key);
  if (expiresAt && expiresAt > now) return false;

  recentOrders.set(key, now + RECENT_ORDER_TTL_MS);
  recentOrders.forEach((expiry, entry) => {
    if (expiry <= now) recentOrders.delete(entry);
  });
  return true;
}