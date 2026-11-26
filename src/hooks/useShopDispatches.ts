import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import type { ShopDispatchSummary } from "@/types/delivery";

/** Courses transmises par une boutique, rafraîchies à chaque changement de statut (cahier des charges §10). */
export function useShopDispatches(shopId: string) {
  const [dispatches, setDispatches] = useState<ShopDispatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Avance à chaque lecture réussie : le suivi relit alors la page affichée.
  const [revision, setRevision] = useState(0);
  // Plusieurs changements rapprochés lancent plusieurs lectures : seule la dernière compte.
  const request = useRef(0);

  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const rows = await deliveryService.getShopDispatchSummaries(shopId);
      if (current !== request.current) return;
      setDispatches(rows);
      setError(false);
      setLoading(false);
      setRevision((r) => r + 1);
    } catch (e) {
      console.error("Error fetching shop dispatches:", e);
      // La dernière liste connue reste ; tant qu'aucune lecture n'a réussi, on ne sait pas quelles commandes sont libres.
      if (current === request.current) setError(true);
    }
  }, [shopId]);

  useEffect(() => {
    setDispatches([]);
    setLoading(true);
    setError(false);
    reload();
    const channel = supabase
      .channel(`shop-dispatches-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_dispatches", filter: `shop_id=eq.${shopId}` }, () => { reload(); })
      .subscribe();
    return () => {
      request.current++;
      supabase.removeChannel(channel);
    };
  }, [shopId, reload]);

  return { dispatches, loading, error, revision, reload };
}
