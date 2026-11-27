import { useCallback, useEffect, useRef, useState } from "react";
import { fetchShopOrderSummary, type ShopOrderSummary } from "@/lib/shopOrderSummary";

/**
 * Indicateurs des commandes d'une boutique. `refresh` regroupe les demandes rapprochées (rafale d'évènements en temps
 * réel) en une seule lecture ; la dernière connue reste affichée si une relecture échoue.
 */
export function useShopOrderSummary(shopId: string | undefined) {
  const [state, setState] = useState<{ shopId: string; summary: ShopOrderSummary } | null>(null);
  const [failed, setFailed] = useState(false);
  // Avance à chaque relecture demandée : les Statistiques et les Finances relisent alors leurs chiffres.
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const timer = useRef<number>();

  const load = useCallback(async () => {
    if (!shopId) return;
    const current = ++request.current;
    try {
      const summary = await fetchShopOrderSummary(shopId);
      if (current !== request.current) return;
      setState({ shopId, summary });
      setFailed(false);
    } catch (error) {
      console.error("Failed to load shop order summary", error);
      if (current === request.current) setFailed(true);
    }
  }, [shopId]);

  const refresh = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setRevision((r) => r + 1);
      void load();
    }, 300);
  }, [load]);

  /** Abandonne la lecture et la relecture en attente (changement de boutique, fermeture). */
  const cancel = useCallback(() => {
    request.current++;
    window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    setFailed(false);
    void load();
    return cancel;
  }, [load, cancel]);

  return { summary: state && state.shopId === shopId ? state.summary : null, revision, failed, refresh };
}
