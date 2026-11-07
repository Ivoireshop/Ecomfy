import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import type { DeliveryNotification } from "@/types/delivery";

/**
 * Notifications de vérification (table delivery_notifications, lisible par leur seul destinataire) :
 * liste, compteur de non lues, et alerte en direct à chaque nouvelle ligne (Realtime respecte la RLS).
 */
export function useDeliveryNotifications(onNew?: (n: DeliveryNotification) => void) {
  const [items, setItems] = useState<DeliveryNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seen = useRef<Set<string>>(new Set());
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const refresh = useCallback(async () => {
    try {
      const list = await deliveryService.listNotifications(30);
      list.forEach((n) => seen.current.add(n.id));
      setItems(list);
    } catch (e) {
      console.warn("[useDeliveryNotifications] chargement impossible:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    void refresh();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`delivery-notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as DeliveryNotification;
          if (seen.current.has(n.id)) return;
          seen.current.add(n.id);
          setItems((prev) => [n, ...prev].slice(0, 30));
          const show = n.tone === "error" ? toast.error : n.tone === "success" ? toast.success : n.tone === "warning" ? toast.warning : toast.info;
          show(n.title, { description: n.body ?? undefined });
          onNewRef.current?.(n);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      await deliveryService.markNotificationsRead();
    } catch (e) {
      console.warn("[useDeliveryNotifications] marquage impossible:", e);
      void refresh();
    }
  }, [refresh]);

  const unread = items.filter((n) => !n.read_at).length;
  return { items, unread, loading, refresh, markAllRead };
}
