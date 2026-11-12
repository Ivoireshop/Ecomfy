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

// Le hook est monté 5 fois dans le tableau de bord (bandeau, modale, section seuil, écran verrouillé, page). Chaque
// instance relançait son propre chargement complet à chaque événement temps réel / retour d'onglet : 5 chargements
// pour un seul changement (panne du 12/11/2026 : plus de 100 lectures de `shops` en 3 minutes depuis un navigateur).
// Les instances partagent désormais un seul chargement par boutique :
//  - "force" (défaut) : lit la base, sauf si un chargement est déjà en cours (alors on s'y joint) ;
//  - "cached" (ouverture d'un composant) : réutilise un résultat de moins de MIN_INTERVAL_MS ;
//  - "debounced" (événements temps réel) : regroupe les rafales en un seul chargement, au plus tôt MIN_INTERVAL_MS
//    après le précédent, donc aucun changement n'est perdu.
const MIN_INTERVAL_MS = 3_000;
type RefreshMode = "force" | "cached" | "debounced";
type BillingSnapshot = { status: BillingStatusInfo; history: ShopInvoice[] };
const inflightLoads = new Map<string, Promise<BillingSnapshot>>();
const pendingDebounced = new Map<string, Promise<BillingSnapshot>>();
const lastSnapshots = new Map<string, { at: number; value: BillingSnapshot }>();

function loadBillingSnapshot(shopId: string, mode: RefreshMode): Promise<BillingSnapshot> {
  const last = lastSnapshots.get(shopId);
  const age = last ? Date.now() - last.at : Infinity;

  if (mode === "debounced") {
    const pending = pendingDebounced.get(shopId);
    if (pending) return pending;
    const p = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, MIN_INTERVAL_MS - age)))
      .then(() => loadBillingSnapshot(shopId, "force"))
      .finally(() => pendingDebounced.delete(shopId));
    pendingDebounced.set(shopId, p);
    return p;
  }

  const running = inflightLoads.get(shopId);
  if (running) return running;
  if (mode === "cached" && last && age < MIN_INTERVAL_MS) return Promise.resolve(last.value);

  const p = Promise.all([fetchShopBillingStatus(shopId), fetchShopInvoicesHistory(shopId)])
    .then(([status, history]) => {
      const value = { status, history };
      lastSnapshots.set(shopId, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflightLoads.delete(shopId));
  inflightLoads.set(shopId, p);
  return p;
}

export function useBillingSystem(shopId: string | null | undefined) {
  const [billingInfo, setBillingInfo] = useState<BillingStatusInfo | null>(null);
  const [invoices, setInvoices] = useState<ShopInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Dernier état connu, lu par le minuteur sans le relancer à chaque changement.
  const billingInfoRef = useRef<BillingStatusInfo | null>(null);
  billingInfoRef.current = billingInfo;

  // Par défaut le rafraîchissement lit la base (appel explicite, ex. après un paiement). `opts.mode` n'est lu que s'il
  // est valide : le hook est aussi passé tel quel comme gestionnaire d'événement (l'argument est alors un événement).
  const refreshBilling = useCallback(async (opts?: { mode?: RefreshMode }) => {
    if (!shopId) return;
    try {
      const mode = opts?.mode === "cached" || opts?.mode === "debounced" ? opts.mode : "force";
      const { status: statusData, history: historyData } = await loadBillingSnapshot(shopId, mode);
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
        refreshBilling({ mode: "debounced" });
      })
      .subscribe();
    let invoiceChannel: ReturnType<typeof supabase.channel> | null = null;
    refreshBilling({ mode: "cached" }).then(() => {
      if (cancelled || !isInvoiceSystemAvailable()) return;
      invoiceChannel = supabase
        .channel(`billing_invoices_${shopId}_${suffix}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "shop_invoices", filter: `shop_id=eq.${shopId}` }, () => {
          refreshBilling({ mode: "debounced" });
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
