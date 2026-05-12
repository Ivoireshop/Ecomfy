import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const NOTIFICATION_SOUNDS = [
  { id: "cash", label: "💰 Caisse enregistreuse (Ka-ching)", file: "/sounds/visualpro-cash.mp3" },
  { id: "coins", label: "🪙 Pluie de pièces", file: "/sounds/visualpro-coins.mp3" },
  { id: "bell", label: "🔔 Cloche de boutique", file: "/sounds/visualpro-bell.mp3" },
  { id: "chime", label: "🎶 Carillon élégant", file: "/sounds/visualpro-chime.mp3" },
] as const;

export type NotificationSoundId = typeof NOTIFICATION_SOUNDS[number]["id"];

export const DEFAULT_SOUND: NotificationSoundId = "cash";

export function getSoundFile(id?: string | null): string {
  const found = NOTIFICATION_SOUNDS.find(s => s.id === id);
  return (found || NOTIFICATION_SOUNDS[0]).file;
}

export function getSavedSoundId(): NotificationSoundId {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  const v = localStorage.getItem("vp_notif_sound") as NotificationSoundId | null;
  return NOTIFICATION_SOUNDS.some(s => s.id === v) ? (v as NotificationSoundId) : DEFAULT_SOUND;
}

export function getSavedVolume(): number {
  if (typeof window === "undefined") return 1;
  const v = parseFloat(localStorage.getItem("vp_notif_volume") || "1");
  return isNaN(v) ? 1 : Math.min(1, Math.max(0, v));
}

export function playNotificationSound() {
  try {
    const a = new Audio(getSoundFile(getSavedSoundId()));
    a.volume = getSavedVolume();
    a.preload = "auto";
    a.play().catch(() => {});
  } catch {}
}

/**
 * Subscribes to new orders for a shop (or all shops of the current user)
 * and fires a native browser/PWA notification + sound when one arrives.
 */
export function useOrderNotifications(shopId?: string) {
  useEffect(() => {
    // Play sound when the FCM service worker posts a "new-order" event
    // (covers the case where the order arrives via push, not realtime).
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "vp-new-order") {
        playNotificationSound();
      }
    };
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }
    return () => {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);

  useEffect(() => {
    const channelName = shopId ? `orders-notify-${shopId}` : `orders-notify-all`;
    const filter = shopId ? `shop_id=eq.${shopId}` : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", ...(filter ? { filter } : {}) },
        (payload) => {
          const order: any = payload.new;
          const voiceEnabled = localStorage.getItem("vp_voice_notify") === "on";
          playNotificationSound();
          if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
            try {
              const totalFmt = Number(order.total || 0).toLocaleString("fr-FR");
              const firstName = String(order.customer_name || "").split(" ")[0] || "";
              const u = new SpeechSynthesisUtterance(
                `Vous avez une nouvelle commande${firstName ? " de " + firstName : ""}, montant ${totalFmt} francs.`,
              );
              u.lang = "fr-FR";
              u.rate = 1;
              u.pitch = 1;
              const voices = window.speechSynthesis.getVoices();
              const fr = voices.find(v => v.lang?.toLowerCase().startsWith("fr"));
              if (fr) u.voice = fr;
              setTimeout(() => {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
              }, 900);
            } catch {}
          }
          // Fire system notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
                body: `${order.customer_name} • ${Number(order.total).toLocaleString("fr-FR")} FCFA`,
                icon: "/app-icon-512.png",
                badge: "/app-icon-512.png",
                tag: `order-${order.id}`,
                renotify: true,
                requireInteraction: true,
                silent: false,
                vibrate: [300, 80, 300, 80, 700],
              };
              const n = new Notification("💰 Nouvelle commande VisualPro", options);
              n.onclick = () => {
                window.focus();
                window.location.href = `/shop-editor/${order.shop_id}`;
                n.close();
              };
            } catch {}
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}