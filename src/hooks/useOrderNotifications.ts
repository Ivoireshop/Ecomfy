import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildOrderNotification } from "@/lib/notificationFormat";

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

function getOrderPlace(order: any): string {
  return String(order?.customer_city || order?.customer_country || "").trim();
}

function getFirstProductName(order: any): string {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const first = items[0]?.product_name;
  return String(first || "").trim();
}

export function getOrderAnnouncement(order: any): string {
  const place = getOrderPlace(order);
  const product = getFirstProductName(order);
  if (product && place) return `Tu as une nouvelle commande de ${product} à ${place}.`;
  if (product) return `Tu as une nouvelle commande de ${product}.`;
  if (place) return `Tu as une nouvelle commande de ${place}.`;
  return `Tu as une nouvelle commande.`;
}

/**
 * Texte riche affiché DANS la notification (push & système).
 * Inclut nom, téléphone, ville/pays et total — pour que le commerçant
 * voie toutes les infos sans devoir ouvrir l'app.
 */
export function getOrderNotificationBody(order: any): string {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  return buildOrderNotification(
    {
      customer_name: order?.customer_name,
      customer_phone: order?.customer_phone,
      customer_city: order?.customer_city,
      customer_country: order?.customer_country,
      total: order?.total,
      items,
    },
    order?.shop_name || "",
    order?.notification_settings || {},
  ).body;
}

export function playNotificationSound() {
  try {
    const file = getSoundFile(getSavedSoundId());
    const volume = getSavedVolume();
    [0, 700].forEach((delay) => {
      window.setTimeout(() => {
        try {
          const a = new Audio(file);
          a.volume = volume;
          a.preload = "auto";
          a.play().catch(() => {});
        } catch {}
      }, delay);
    });
    navigator.vibrate?.([300, 80, 300, 80, 700]);
  } catch {}
}

export function speakOrderNotification(order: any) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("vp_voice_notify") !== "on") return;
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(getOrderAnnouncement(order));
    u.lang = "fr-FR";
    u.rate = 1;
    u.pitch = 1;
    const assignVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const fr = voices.find(v => v.lang?.toLowerCase().startsWith("fr"));
      if (fr) u.voice = fr;
    };
    assignVoice();
    setTimeout(() => {
      assignVoice();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }, 900);
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
          playNotificationSound();
          speakOrderNotification(order);
          // NOTE: la notification système visuelle est gérée UNIQUEMENT par le push FCM
          // (useFCM / service worker / native push) afin d'éviter les doublons.
          // Ici on ne joue que le son + la voix pour un feedback immédiat dans l'onglet.
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