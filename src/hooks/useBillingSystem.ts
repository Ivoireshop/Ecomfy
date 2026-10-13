import { useEffect, useState, useCallback } from "react";
import { 
  BillingStatusInfo, 
  ShopInvoice, 
  fetchShopBillingStatus, 
  fetchShopInvoicesHistory, 
  formatGracePeriodCountdown
} from "@/lib/billingSystem";
import { supabase } from "@/integrations/supabase/client";

export function useBillingSystem(shopId: string | null | undefined) {
  const [billingInfo, setBillingInfo] = useState<BillingStatusInfo | null>(null);
  const [invoices, setInvoices] = useState<ShopInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

    // Realtime subscription with unique channel ID per hook instance to prevent duplicate channel errors
    const channelId = `billing_${shopId}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "shops", filter: `id=eq.${shopId}` }, () => {
        refreshBilling();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_invoices", filter: `shop_id=eq.${shopId}` }, () => {
        refreshBilling();
      })
      .subscribe();

    // Live 1-second ticker for remaining countdown
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
      supabase.removeChannel(channel);
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
