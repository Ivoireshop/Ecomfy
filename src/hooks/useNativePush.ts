import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrderAnnouncement,
  playNotificationSound,
  speakOrderNotification,
} from "@/hooks/useOrderNotifications";
import {
  getNotificationDeviceKey,
  getStableNotificationId,
  shouldHandleOrderNotification,
} from "@/lib/notificationDevice";

let nativePushStarted = false;

/**
 * Registers the device for native push notifications (Android FCM / iOS APNs)
 * when running inside the Capacitor shell. On the web, this hook is a no-op
 * and the existing `useFCM` web flow continues to handle browser pushes.
 *
 * The native token is stored in the same `device_tokens` table so the existing
 * `send-push-notification` edge function delivers to web AND native devices.
 */
export function useNativePush(shopId?: string) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (nativePushStarted) return;
    nativePushStarted = true;

    let cleanup: Array<() => void> = [];

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { LocalNotifications } = await import("@capacitor/local-notifications");

        // Android: create a high-importance channel that uses the custom cash sound.
        if (Capacitor.getPlatform() === "android") {
          try {
            await PushNotifications.createChannel({
              id: "visualpro_orders",
              name: "Nouvelles commandes",
              description: "Notification sonore forte à chaque nouvelle commande",
              importance: 5, // IMPORTANCE_HIGH → ringtone, heads-up, screen wake
              visibility: 1,
              sound: "visualpro_cash.wav",
              vibration: true,
              lights: true,
              lightColor: "#000000",
            });
          } catch (e) {
            console.warn("[native-push] createChannel failed", e);
          }
        }

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        await LocalNotifications.requestPermissions().catch(() => undefined);

        await PushNotifications.register();

        const regHandle = await PushNotifications.addListener("registration", async (token) => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const platform = Capacitor.getPlatform();
            const deviceKey = getNotificationDeviceKey("native", platform);
            await supabase
              .from("device_tokens")
              .delete()
              .eq("user_id", user.id)
              .eq("user_agent", deviceKey)
              .neq("fcm_token", token.value);
            await supabase
              .from("device_tokens")
              .delete()
              .eq("user_id", user.id)
              .eq("user_agent", `native-${platform}`)
              .neq("fcm_token", token.value);
            await supabase
              .from("device_tokens")
              .delete()
              .eq("user_id", user.id)
              .eq("user_agent", navigator.userAgent)
              .neq("fcm_token", token.value);

            await supabase.from("device_tokens").upsert(
              {
                user_id: user.id,
                shop_id: shopId ?? null,
                fcm_token: token.value,
                user_agent: deviceKey,
                last_used_at: new Date().toISOString(),
              },
              { onConflict: "fcm_token" },
            );
          } catch (e) {
            console.error("[native-push] upsert token failed", e);
          }
        });
        cleanup.push(() => regHandle.remove());

        const errHandle = await PushNotifications.addListener("registrationError", (err) => {
          console.error("[native-push] registration error", err);
        });
        cleanup.push(() => errHandle.remove());

        // Foreground push: play sound + voice + show a local notification (so it rings).
        const recvHandle = await PushNotifications.addListener(
          "pushNotificationReceived",
          async (notification) => {
            const data = (notification.data || {}) as Record<string, string>;
            if (!shouldHandleOrderNotification(data.order_id, "native-foreground")) return;
            const orderLike = {
              customer_city: data.customer_city,
              customer_country: data.customer_country,
            };
            playNotificationSound();
            speakOrderNotification(orderLike);

            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: getStableNotificationId(data.order_id),
                    title: notification.title || "💰 Nouvelle commande VisualPro",
                    body: notification.body || getOrderAnnouncement(orderLike),
                    sound: "visualpro_cash.wav",
                    channelId: "visualpro_orders",
                    smallIcon: "ic_stat_icon_config_sample",
                    extra: data,
                  },
                ],
              });
            } catch (e) {
              console.warn("[native-push] local notification failed", e);
            }
          },
        );
        cleanup.push(() => recvHandle.remove());
      } catch (e) {
        console.error("[native-push] init failed", e);
      }
    })();

    return () => {
      cleanup.forEach((fn) => {
        try { fn(); } catch { /* noop */ }
      });
      nativePushStarted = false;
    };
  }, [shopId]);
}