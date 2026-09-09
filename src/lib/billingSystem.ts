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
    };
  }

  try {
    // 1. Fetch shop row & auto-check deadline
    const { data: shop } = await supabase
      .from("shops")
      .select("id, total_orders, shop_payment_status, payment_deadline, commission_balance_due, is_suspended")
      .eq("id", shopId)
      .maybeSingle();

    // Trigger auto-check for 240 threshold if order count >= 240
    if (shop && Number(shop.total_orders || 0) >= BILLING_CONFIG.THRESHOLD_ORDERS) {
      await supabase.rpc("check_and_trigger_billing_threshold" as any, { _shop_id: shopId });
    }

    // Auto-check deadlines (if 3-day grace period expired)
    await supabase.rpc("enforce_shop_billing_deadlines" as any);

    // Re-query updated shop state
    const { data: updatedShop } = await supabase
      .from("shops")
      .select("id, total_orders, shop_payment_status, payment_deadline, commission_balance_due, is_suspended")
      .eq("id", shopId)
      .maybeSingle();

    const rawStatus = (updatedShop?.shop_payment_status as BillingStatusType) || "STORE_ACTIVE";

    // 2. Fetch active invoice if any
    const { data: invoices } = await supabase
      .from("shop_invoices" as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    const invoiceList = (invoices || []) as unknown as ShopInvoice[];
    const activeInvoice = invoiceList.find((i) => i.status !== "PAYMENT_CONFIRMED" && i.status !== "CANCELLED") || invoiceList[0] || null;

    const ordersCount = Number(updatedShop?.total_orders || 0);
    const dueDate = activeInvoice?.due_date || updatedShop?.payment_deadline || null;
    const remainingMs = dueDate ? Math.max(0, new Date(dueDate).getTime() - Date.now()) : 0;

    const isRestricted = 
      rawStatus === "STORE_RESTRICTED" || 
      rawStatus === "locked" || 
      rawStatus === "final_suspension" ||
      rawStatus === "PAYMENT_OVERDUE" ||
      (remainingMs === 0 && dueDate !== null && activeInvoice?.status !== "PAYMENT_CONFIRMED");

    const isGracePeriod = 
      (rawStatus === "PAYMENT_DUE" || rawStatus === "GRACE_PERIOD" || rawStatus === "payment_pending") &&
      remainingMs > 0 &&
      !isRestricted;

    const isPaymentDue = ordersCount >= BILLING_CONFIG.THRESHOLD_ORDERS || isGracePeriod || isRestricted;

    return {
      status: isRestricted ? "STORE_RESTRICTED" : isGracePeriod ? "GRACE_PERIOD" : rawStatus,
      isRestricted,
      isGracePeriod,
      isPaymentDue,
      ordersCount,
      threshold: BILLING_CONFIG.THRESHOLD_ORDERS,
      amountDue: isPaymentDue ? BILLING_CONFIG.BILLING_AMOUNT : 0,
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
  if (!shopId) return [];
  try {
    const { data, error } = await supabase
      .from("shop_invoices" as any)
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[BillingSystem] Error fetching invoices:", error);
      return [];
    }
    return (data || []) as unknown as ShopInvoice[];
  } catch (e) {
    console.error("[BillingSystem] Exception fetching invoices:", e);
    return [];
  }
}

/**
 * Confirms payment for an invoice and restores shop access automatically
 */
export async function confirmBillingPayment(
  shopId: string, 
  invoiceId?: string | null, 
  paymentRef?: string,
  method = "online"
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc("confirm_invoice_payment" as any, {
      p_shop_id: shopId,
      p_invoice_id: invoiceId || null,
      p_payment_reference: paymentRef || null,
      p_payment_method: method,
    });

    if (error) {
      console.error("[BillingSystem] Payment confirmation RPC error:", error);
      return { success: false, message: error.message };
    }

    const res = data as any;
    return {
      success: res?.success || false,
      message: res?.message || "Paiement confirmé avec succès.",
    };
  } catch (err: any) {
    console.error("[BillingSystem] Payment confirmation exception:", err);
    return { success: false, message: err.message || "Erreur de traitement du paiement." };
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
