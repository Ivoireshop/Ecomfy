import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMessagingInstance, getToken, onMessage } from "@/lib/firebase";

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
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "registering" | "registered" | "denied" | "unsupported" | "error">("idle");

  const register = useCallback(async () => {
    setStatus("registering");
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        setStatus("unsupported"); return null;
      }
      const messaging = await getMessagingInstance();
      if (!messaging) { setStatus("unsupported"); return null; }

      const perm = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return null; }

      const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) { setStatus("error"); return null; }

      const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      if (!fcmToken) { setStatus("error"); return null; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("error"); return null; }

      await supabase.from("device_tokens").upsert(
        {
          user_id: user.id,
          shop_id: shopId ?? null,
          fcm_token: fcmToken,
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" }
      );

      setToken(fcmToken);
      setStatus("registered");

      onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        if (Notification.permission === "granted") {
          new Notification(title || "🛒 Nouvelle commande", {
            body: body || "",
            icon: "/app-icon-512.png",
          });
        }
      });

      return fcmToken;
    } catch (e) {
      console.error("[FCM]", e);
      setStatus("error");
      return null;
    }
  }, [shopId]);

  // Auto-register if perm already granted
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      register();
    }
  }, [register, shopId]);

  return { token, status, register };
}