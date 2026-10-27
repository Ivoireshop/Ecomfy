import { useEffect, useRef, useState, useCallback } from "react";
import { 
  BillingStatusInfo, 
  ShopInvoice, 
  fetchShopBillingStatus, 
  fetchShopInvoicesHistory, 
  formatGracePeriodCountdown,
  isInvoiceSystemAvailable
} from "@/lib/billingSystem";
import { supabase } from "@/integrations/supabase/client";

export function useBillingSystem(shopId: string | null | undefined) {
  const [billingInfo, setBillingInfo] = useState<BillingStatusInfo | null>(null);
  const [invoices, setInvoices] = useState<ShopInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Dernier état connu, lu par le minuteur sans le relancer à chaque changement.
  const billingInfoRef = useRef<BillingStatusInfo | null>(null);
  billingInfoRef.current = billingInfo;

  const refreshBilling = useCallback(async () => {
    if (!shopId) return;
    try {
      const [statusData, historyData] = await Promise.all([
        fetchShopBillingStatus(shopId),
        fetchShopInvoicesHistory(shopId)
      ]);
      setBillingInfo(statusData);
      setInvoices(historyData);
    } catch (e) {
      console.error("[useBillingSystem] Refresh error:", e);
    } finally {
      // Le chargement n'est « en cours » qu'à l'ouverture : un rafraîchissement temps réel (chaque commande modifie
      // la boutique) remplaçait auparavant toute la section par un indicateur de chargement.
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);

    // Un abonnement à une table absente de la base fait échouer tout le canal : les changements de la boutique
    // (solde, statut) et ceux des factures passent donc par deux canaux, et le second n'existe que si le système
    // de factures est déployé (connu après la première lecture).
    let cancelled = false;
    const suffix = Math.random().toString(36).substring(2, 8);
    const shopChannel = supabase
      .channel(`billing_${shopId}_${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shops", filter: `id=eq.${shopId}` }, () => {
        refreshBilling();
      })
      .subscribe();
    let invoiceChannel: ReturnType<typeof supabase.channel> | null = null;
    refreshBilling().then(() => {
      if (cancelled || !isInvoiceSystemAvailable()) return;
      invoiceChannel = supabase
        .channel(`billing_invoices_${shopId}_${suffix}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "shop_invoices", filter: `shop_id=eq.${shopId}` }, () => {
          refreshBilling();
        })
        .subscribe();
    });

    // Live 1-second ticker for remaining countdown
    const timer = setInterval(() => {
      const prev = billingInfoRef.current;
      if (!prev || !prev.dueDate) return;
      const newMs = Math.max(0, new Date(prev.dueDate).getTime() - Date.now());
      if (newMs === prev.remainingMs) return;
      // Délai tout juste écoulé : on relit l'état côté serveur.
      if (newMs === 0 && prev.remainingMs > 0) setTimeout(refreshBilling, 500);
      setBillingInfo({ ...prev, remainingMs: newMs });
    }, 1000);

    // Retour sur l'onglet (par exemple après avoir payé sur la page du prestataire) : on relit l'état sans attendre
    // le temps réel, qui peut être indisponible.
    const onVisible = () => { if (document.visibilityState === "visible") refreshBilling(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      supabase.removeChannel(shopChannel);
      if (invoiceChannel) supabase.removeChannel(invoiceChannel);
    };
  }, [shopId, refreshBilling]);

  return {
    billingInfo,
    invoices,
    loading,
    refreshBilling,
    formattedCountdown: billingInfo ? formatGracePeriodCountdown(billingInfo.remainingMs) : "",
  };
}
