import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import type { DeliveryDispatch } from "@/types/delivery";

/** Courses transmises par une boutique, rafraîchies à chaque changement de statut (cahier des charges §10). */
export function useShopDispatches(shopId: string) {
  const [dispatches, setDispatches] = useState<DeliveryDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setDispatches(await deliveryService.getShopDispatches(shopId));
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`shop-dispatches-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_dispatches", filter: `shop_id=eq.${shopId}` }, () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId, reload]);

  return { dispatches, loading, reload };
}
