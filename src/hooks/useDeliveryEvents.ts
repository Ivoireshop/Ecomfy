import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { describeDeliveryEvent, type DeliveryEventRow, type EventAudience } from "@/lib/deliveryRpc";

type EventColumn = "shop_id" | "provider_id" | "driver_user_id";

/**
 * Notifications de livraison en temps réel (table delivery_events, lisible seulement par les personnes concernées).
 * Affiche une alerte pour chaque événement utile à `audience` puis appelle `onEvent` (pour recharger les données).
 */
export function useDeliveryEvents(column: EventColumn, value: string | null | undefined, audience: EventAudience, onEvent?: () => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!value) return;
    const channel = supabase
      .channel(`delivery-events-${column}-${value}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_events", filter: `${column}=eq.${value}` },
        (payload) => {
          const message = describeDeliveryEvent(payload.new as DeliveryEventRow, audience);
          if (message) {
            const show = message.tone === "error" ? toast.error : message.tone === "success" ? toast.success : toast.info;
            show(message.title, { description: message.description });
          }
          onEventRef.current?.();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [column, value, audience]);
}
