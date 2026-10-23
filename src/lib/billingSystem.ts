import { supabase } from "@/integrations/supabase/client";

export type BillingStatusType = 
  | "STORE_ACTIVE"
  | "PAYMENT_DUE"
  | "GRACE_PERIOD"
  | "PAYMENT_OVERDUE"
  | "STORE_RESTRICTED"
  | "PAYMENT_CONFIRMED"
  | "STORE_REACTIVATED"
  | "active"
  | "payment_pending"
  | "locked"
  | "final_suspension";

export interface ShopInvoice {
  id: string;
  invoice_number: string;
  shop_id: string;
  orders_threshold: number;
  amount: number;
  currency: string;
  status: "PAYMENT_DUE" | "GRACE_PERIOD" | "PAYMENT_OVERDUE" | "STORE_RESTRICTED" | "PAYMENT_CONFIRMED" | "CANCELLED";
  created_at: string;
  due_date: string;
  paid_at: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  reactivated_at: string | null;
}

export interface BillingStatusInfo {
  status: BillingStatusType;
  isRestricted: boolean;
  isGracePeriod: boolean;
  isPaymentDue: boolean;
  ordersCount: number;
  threshold: number;
  amountDue: number;
  currency: string;
  dueDate: string | null;
  remainingMs: number;
  activeInvoice: ShopInvoice | null;
  invoiceNumber: string | null;
  hasInvoice: boolean;
}

/**
 * Même définition que public.is_shop_restricted() côté base : boutique suspendue OU statut restreint.
 * Le serveur reste l'autorité (la lecture directe de `orders` est refusée à une boutique restreinte) ;
 * ceci ne sert qu'à choisir la bonne voie de lecture.
 */
export const RESTRICTED_SHOP_STATUSES = ["STORE_RESTRICTED", "locked", "PAYMENT_OVERDUE", "final_suspension"];

export function isShopRowRestricted(shop: { is_suspended?: boolean | null; shop_payment_status?: string | null } | null | undefined): boolean {
  if (!shop) return false;
  return !!shop.is_suspended || RESTRICTED_SHOP_STATUSES.includes(shop.shop_payment_status || "");
}

/**
 * Le système de factures par seuil (table shop_invoices, RPC check_and_trigger_billing_threshold et
 * enforce_shop_billing_deadlines) n'existe pas sur toutes les bases. Quand PostgREST répond « introuvable »,
 * on s'en souvient pour le reste de la session au lieu de renvoyer 2 à 3 requêtes en 404 à chaque rafraîchissement
 * (le hook est monté plusieurs fois dans le tableau de bord).
 */
let invoiceSystemMissing = false;

/** Vrai tant qu'aucune requête n'a montré que le système de factures est absent de la base. */
export function isInvoiceSystemAvailable(): boolean {
  return !invoiceSystemMissing;
}

function isMissingObjectError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code || "")
    || /could not find the (table|function)|does not exist/i.test(error.message || "");
}

/** Statuts de la boutique qui ouvrent un délai de paiement (nouveau modèle et modèle historique). */
const DUE_STATUSES = ["PAYMENT_DUE", "GRACE_PERIOD", "payment_pending"];

export const BILLING_CONFIG = {
  THRESHOLD_ORDERS: 240,
  BILLING_AMOUNT: 12000,
  CURRENCY: "FCFA",
  GRACE_PERIOD_DAYS: 3,
};

/**
 * Computes billing status details for a shop
 */
export async function fetchShopBillingStatus(shopId: string): Promise<BillingStatusInfo> {
  if (!shopId) {
    return {
      status: "STORE_ACTIVE",
      isRestricted: false,
      isGracePeriod: false,
      isPaymentDue: false,
      ordersCount: 0,
      threshold: BILLING_CONFIG.THRESHOLD_ORDERS,
      amountDue: 0,
      currency: BILLING_CONFIG.CURRENCY,
      dueDate: null,
      remainingMs: 0,
      activeInvoice: null,
      invoiceNumber: null,
      hasInvoice: false,
    };
  }

  try {
    // 1. Fetch shop row & auto-check deadline
    const { data: shop } = await supabase
      .from("shops")
      .select("id, total_orders, shop_payment_status, payment_deadline, commission_balance_due, is_suspended")
      .eq("id", shopId)
      .maybeSingle();

    if (!invoiceSystemMissing) {
      // Trigger auto-check for 240 threshold if order count >= 240
      if (shop && Number(shop.total_orders || 0) >= BILLING_CONFIG.THRESHOLD_ORDERS) {
        const { error } = await supabase.rpc("check_and_trigger_billing_threshold" as any, { _shop_id: shopId });
        if (isMissingObjectError(error)) invoiceSystemMissing = true;
      }

      // Les échéances dépassées sont appliquées par la tâche planifiée du serveur (enforce_shop_billing_deadlines,
      // toutes les 5 minutes) : le navigateur ne la déclenche plus.
    }

    // Re-query updated shop state
    const { data: updatedShop } = await supabase
      .from("shops")
      .select("id, total_orders, shop_payment_status, payment_deadline, commission_balance_due, is_suspended")
      .eq("id", shopId)
      .maybeSingle();

    const rawStatus = (updatedShop?.shop_payment_status as BillingStatusType) || "STORE_ACTIVE";

    // 2. Fetch the open invoice if any (une facture réglée ou annulée n'est pas « active »)
    let invoiceList: ShopInvoice[] = [];
    if (!invoiceSystemMissing) {
      const { data: invoices, error: invoicesError } = await supabase
        .from("shop_invoices" as any)
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (isMissingObjectError(invoicesError)) invoiceSystemMissing = true;
      invoiceList = (invoices || []) as unknown as ShopInvoice[];
    }
    const activeInvoice = invoiceList.find((i) => i.status !== "PAYMENT_CONFIRMED" && i.status !== "CANCELLED") || null;

    const ordersCount = Number(updatedShop?.total_orders || 0);
    // L'échéance qui fait foi est celle de la boutique (c'est elle que le serveur applique), et seulement tant qu'un
    // délai est ouvert : l'échéance d'une ancienne facture réglée ne doit pas restreindre un solde plus récent.
    const isDueStatus = DUE_STATUSES.includes(rawStatus);
    const dueDate = isDueStatus ? (updatedShop?.payment_deadline || activeInvoice?.due_date || null) : null;
    const remainingMs = dueDate ? Math.max(0, new Date(dueDate).getTime() - Date.now()) : 0;

    // Actual real balance due from DB shops.commission_balance_due (Single Source of Truth)
    const storedBalanceDue = Math.max(0, Number(updatedShop?.commission_balance_due || 0));

    // If balance due is zero, the shop is fully paid
    if (storedBalanceDue <= 0) {
      return {
        status: "STORE_ACTIVE",
        isRestricted: false,
        isGracePeriod: false,
        isPaymentDue: false,
        ordersCount,
        threshold: BILLING_CONFIG.THRESHOLD_ORDERS,
        amountDue: 0,
        currency: BILLING_CONFIG.CURRENCY,
        dueDate: null,
        remainingMs: 0,
        activeInvoice: null,
        invoiceNumber: null,
        hasInvoice: false,
      };
    }

    const isRestricted = 
      rawStatus === "STORE_RESTRICTED" || 
      rawStatus === "locked" || 
      rawStatus === "final_suspension" ||
      rawStatus === "PAYMENT_OVERDUE" ||
      (isDueStatus && remainingMs === 0 && dueDate !== null && storedBalanceDue > 0);

    // Un règlement partiel ne ferme pas le délai : tant qu'il court et qu'un solde reste dû, le compte à rebours
    // doit rester visible (avant, il disparaissait dès que le solde passait sous 12 000 FCFA).
    const isGracePeriod = isDueStatus && remainingMs > 0 && !isRestricted && storedBalanceDue > 0;

    const isPaymentDue = storedBalanceDue > 0;

    return {
      status: isRestricted ? "STORE_RESTRICTED" : isGracePeriod ? "GRACE_PERIOD" : rawStatus,
      isRestricted,
      isGracePeriod,
      isPaymentDue,
      ordersCount,
      threshold: BILLING_CONFIG.THRESHOLD_ORDERS,
      amountDue: storedBalanceDue,
      currency: BILLING_CONFIG.CURRENCY,
      dueDate,
      remainingMs,
      activeInvoice,
      invoiceNumber: activeInvoice?.invoice_number || null,
      hasInvoice: !!activeInvoice,
    };
  } catch (err) {
    console.error("[BillingSystem] Error fetching billing status:", err);
    return {
      status: "STORE_ACTIVE",
      isRestricted: false,
      isGracePeriod: false,
      isPaymentDue: false,
      ordersCount: 0,
      threshold: BILLING_CONFIG.THRESHOLD_ORDERS,
      amountDue: 0,
      currency: BILLING_CONFIG.CURRENCY,
      dueDate: null,
      remainingMs: 0,
      activeInvoice: null,
      invoiceNumber: null,
      hasInvoice: false,
    };
  }
}

/**
 * Fetch full invoice history for a shop
 */
export async function fetchShopInvoicesHistory(shopId: string): Promise<ShopInvoice[]> {
  if (!shopId || invoiceSystemMissing) return [];
  try {
    const { data, error } = await supabase
      .from("shop_invoices" as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingObjectError(error)) invoiceSystemMissing = true;
      else console.error("[BillingSystem] Error fetching invoices:", error);
      return [];
    }
    return (data || []) as unknown as ShopInvoice[];
  } catch (e) {
    console.error("[BillingSystem] Exception fetching invoices:", e);
    return [];
  }
}

/**
 * Formats countdown timer (e.g. "2j 14h 32min 10s")
 */
export function formatGracePeriodCountdown(ms: number): string {
  if (ms <= 0) return "0j 00h 00min 00s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}j ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}s`;
}
