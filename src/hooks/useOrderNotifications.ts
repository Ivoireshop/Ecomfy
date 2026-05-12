import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to new orders for a shop (or all shops of the current user)
 * and fires a native browser/PWA notification + sound when one arrives.
 * Works on mobile when the app is installed to the home screen and opened.
 */
export function useOrderNotifications(shopId?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load notification sound (data URI, very short ping)
    audioRef.current = new Audio(
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACgAA0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0aGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGv////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAQKAAAAAAAAAoAxXYJTAAAAAAAAAAAAAAAAAAAA//uQZAAAAlEAUf0EQACSwAo/oIgAEzwBR/QRgAJpgCj+gjAATEhETBP6XFm////////1k0NRRoaGhpKMaC4uLkS4uMjJEuLjJEuLkSJEuPyL/L8CAAA=",
    );
    audioRef.current.preload = "auto";
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
          // Voice announcement (preferred) + fallback ping
          const voiceEnabled = localStorage.getItem("vp_voice_notify") !== "off";
          let spoke = false;
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
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(u);
              spoke = true;
            } catch {}
          }
          if (!spoke) {
            try { audioRef.current?.play().catch(() => {}); } catch {}
          }
          // Fire system notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification("🛒 Nouvelle commande", {
                body: `${order.customer_name} • ${Number(order.total).toLocaleString("fr-FR")} FCFA`,
                icon: "/app-icon-512.png",
                badge: "/app-icon-512.png",
                tag: `order-${order.id}`,
              });
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