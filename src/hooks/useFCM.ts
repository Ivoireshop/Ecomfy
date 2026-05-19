import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getMessagingInstance, getToken, onMessage } from "@/lib/firebase";
import { getOrderAnnouncement, playNotificationSound, speakOrderNotification } from "@/hooks/useOrderNotifications";
import { getNotificationDeviceKey, shouldHandleOrderNotification } from "@/lib/notificationDevice";

const FCM_SW_URL = "/firebase-messaging-sw.js?v=4";
const TOKEN_STORAGE_KEY = "vp_fcm_token";
const TOKEN_DATE_STORAGE_KEY = "vp_fcm_registered_at";
const TOKEN_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
let foregroundUnsubscribe: (() => void) | null = null;
let registrationPromise: Promise<string | null> | null = null;

let cachedVapid: string | null = null;
async function fetchVapidKey(): Promise<string | null> {
  if (cachedVapid) return cachedVapid;
  try {
    const { data, error } = await supabase.functions.invoke("get-vapid-key");
    if (error) return null;
    cachedVapid = (data as any)?.key || null;
    return cachedVapid;
  } catch { return null; }
}

export function useFCM(shopId?: string) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [status, setStatus] = useState<"idle" | "registering" | "registered" | "denied" | "unsupported" | "error">(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return "idle";
    return Notification.permission === "granted" && localStorage.getItem(TOKEN_STORAGE_KEY) ? "registered" : "idle";
  });

  const register = useCallback(async () => {
    if (registrationPromise) return registrationPromise;

    registrationPromise = (async () => {
    setStatus("registering");
    try {
      if (Capacitor.isNativePlatform()) {
        setStatus("unsupported"); return null;
      }
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        setStatus("unsupported"); return null;
      }
      const messaging = await getMessagingInstance();
      if (!messaging) { setStatus("unsupported"); return null; }

      const perm = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return null; }

      const swReg = await navigator.serviceWorker.register(FCM_SW_URL, { scope: "/" });
      await swReg.update().catch(() => undefined);
      await navigator.serviceWorker.ready;
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        console.error("[FCM] no VAPID key from edge function");
        setStatus("error"); return null;
      }

      const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      if (!fcmToken) {
        console.error("[FCM] getToken returned empty");
        setStatus("error"); return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[FCM] no auth user");
        setStatus("error"); return null;
      }

      const deviceKey = getNotificationDeviceKey("web");
      await supabase
        .from("device_tokens")
        .delete()
        .eq("user_id", user.id)
        .neq("fcm_token", fcmToken);

      const { error: upsertErr } = await supabase.from("device_tokens").upsert(
        {
          user_id: user.id,
          shop_id: shopId ?? null,
          fcm_token: fcmToken,
          user_agent: deviceKey,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" }
      );
      if (upsertErr) {
        console.error("[FCM] upsert failed", upsertErr);
        setStatus("error"); return null;
      }

      setToken(fcmToken);
      setStatus("registered");
      localStorage.setItem(TOKEN_STORAGE_KEY, fcmToken);
      localStorage.setItem(TOKEN_DATE_STORAGE_KEY, new Date().toISOString());

      foregroundUnsubscribe?.();
      foregroundUnsubscribe = onMessage(messaging, (payload) => {
        const data = payload.data || {};
        const { title, body } = payload.notification || {};
        if (!shouldHandleOrderNotification(data.order_id, "web-foreground")) return;
        const orderLike = {
          customer_city: data.customer_city,
          customer_country: data.customer_country,
        };
        playNotificationSound();
        speakOrderNotification(orderLike);
        if (Notification.permission === "granted") {
          const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
            body: body || data.body || getOrderAnnouncement(orderLike),
            icon: "/app-icon-512.png",
            badge: "/app-icon-512.png",
            tag: data.order_id ? `visualpro-order-${data.order_id}` : "visualpro-order",
            renotify: false,
            requireInteraction: true,
            silent: false,
            vibrate: [300, 80, 300, 80, 700],
          };
          new Notification(title || data.title || "💰 Nouvelle commande VisualPro", options);
        }
      });

      return fcmToken;
    } catch (e) {
      console.error("[FCM]", e);
      setStatus("error");
      return null;
    } finally {
      registrationPromise = null;
    }
    })();

    return registrationPromise;
  }, [shopId]);

  // Auto-register if perm already granted
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const registeredAt = Date.parse(localStorage.getItem(TOKEN_DATE_STORAGE_KEY) || "");
      const hasFreshToken = !!localStorage.getItem(TOKEN_STORAGE_KEY)
        && Number.isFinite(registeredAt)
        && Date.now() - registeredAt < TOKEN_REFRESH_INTERVAL_MS;

      if (!hasFreshToken) {
        register();
      }
    }
  }, [register, shopId]);

  return { token, status, register };
}