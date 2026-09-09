import { useEffect, useState, useCallback } from "react";
import { 
  BillingStatusInfo, 
  ShopInvoice, 
  fetchShopBillingStatus, 
  fetchShopInvoicesHistory, 
  confirmBillingPayment,
  formatGracePeriodCountdown
} from "@/lib/billingSystem";
import { supabase } from "@/integrations/supabase/client";

export function useBillingSystem(shopId: string | null | undefined) {
  const [billingInfo, setBillingInfo] = useState<BillingStatusInfo | null>(null);
  const [invoices, setInvoices] = useState<ShopInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);

  const refreshBilling = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    refreshBilling();

    // 1. Subscribe to shop status changes
    const shopSub = supabase
      .channel(`billing_shop_${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shops", filter: `id=eq.${shopId}` }, () => {
        refreshBilling();
      })
      .subscribe();

    // 2. Subscribe to shop_invoices changes
    const invoiceSub = supabase
      .channel(`billing_invoices_${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_invoices", filter: `shop_id=eq.${shopId}` }, () => {
        refreshBilling();
      })
      .subscribe();

    // 3. Live 1-second ticker for remaining countdown
    const timer = setInterval(() => {
      setBillingInfo((prev) => {
        if (!prev || !prev.dueDate) return prev;
        const newMs = Math.max(0, new Date(prev.dueDate).getTime() - Date.now());
        const isExpired = newMs === 0 && prev.remainingMs > 0;
        if (isExpired) {
          // Grace period just expired, refresh
          setTimeout(refreshBilling, 500);
        }
        return {
          ...prev,
          remainingMs: newMs,
        };
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(shopSub);
      supabase.removeChannel(invoiceSub);
    };
  }, [shopId, refreshBilling]);

  const handleConfirmPayment = async (paymentRef?: string, method = "online") => {
    if (!shopId || !billingInfo) return { success: false, message: "Boutique introuvable." };
    setProcessingPayment(true);
    try {
      const activeInvoiceId = billingInfo.activeInvoice?.id || null;
      const res = await confirmBillingPayment(shopId, activeInvoiceId, paymentRef, method);
      if (res.success) {
        await refreshBilling();
      }
      return res;
    } finally {
      setProcessingPayment(false);
    }
  };

  return {
    billingInfo,
    invoices,
    loading,
    processingPayment,
    refreshBilling,
    handleConfirmPayment,
    formattedCountdown: billingInfo ? formatGracePeriodCountdown(billingInfo.remainingMs) : "",
  };
}
