import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShopPaymentStatus = "active" | "payment_pending" | "locked" | "final_suspension";

export interface ShopPaymentInfo {
  status: ShopPaymentStatus;
  amountDue: number;
  threshold: number;
  thresholdReachedAt: string | null;
  firstDeadline: string | null;
  lockedAt: string | null;
  secondDeadline: string | null;
  finalSuspensionAt: string | null;
  isLocked: boolean;
  isFinal: boolean;
  isPending: boolean;
  canOperate: boolean;
  deadline: string | null;
  remainingMs: number;
}

export const SUPPORT_WHATSAPP = "22507581527 61".replace(/\s+/g, "");

export const supportWhatsappLink = (message: string) =>
  `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;

export function computeShopPaymentInfo(shop: any): ShopPaymentInfo {
  const status = ((shop?.shop_payment_status as ShopPaymentStatus) || "active");
  const isLocked = status === "locked";
  const isFinal = status === "final_suspension";
  const isPending = status === "payment_pending";
  const deadline = isFinal
    ? shop?.final_suspension_at ?? null
    : isLocked
      ? shop?.second_deadline_at ?? null
      : isPending
        ? shop?.first_deadline_at ?? shop?.payment_deadline ?? null
        : null;
  const remainingMs = deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : 0;
  return {
    status,
    amountDue: Number(shop?.commission_balance_due) || 0,
    threshold: Number(shop?.commission_threshold) || 12000,
    thresholdReachedAt: shop?.threshold_reached_at ?? null,
    firstDeadline: shop?.first_deadline_at ?? null,
    lockedAt: shop?.locked_at ?? null,
    secondDeadline: shop?.second_deadline_at ?? null,
    finalSuspensionAt: shop?.final_suspension_at ?? null,
    isLocked,
    isFinal,
    isPending,
    canOperate: !isLocked && !isFinal,
    deadline,
    remainingMs,
  };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0j 00h 00min";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${d}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min`;
}

export function useShopPaymentStatus(shopId: string | null | undefined): ShopPaymentInfo | null {
  const [info, setInfo] = useState<ShopPaymentInfo | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let mounted = true;
    let enforcing = false;

    const load = async () => {
      const { data } = await supabase
        .from("shops")
        .select(
          "id, commission_balance_due, commission_threshold, shop_payment_status, threshold_reached_at, first_deadline_at, locked_at, second_deadline_at, final_suspension_at, payment_deadline",
        )
        .eq("id", shopId)
        .maybeSingle();
      if (mounted && data) setInfo(computeShopPaymentInfo(data));
    };
    void load();

    const maybeEnforce = async (current: ShopPaymentInfo | null) => {
      if (!current || enforcing) return;
      const dl = current.deadline ? new Date(current.deadline).getTime() : 0;
      const shouldEscalate =
        (current.status === "payment_pending" || current.status === "locked") &&
        dl > 0 &&
        dl <= Date.now();
      if (!shouldEscalate) return;
      enforcing = true;
      try {
        // @ts-ignore - RPC added via migration
        await supabase.rpc("enforce_shop_payment_state_for", { _shop_id: shopId });
        await load();
      } finally {
        enforcing = false;
      }
    };

    const channel = supabase
      .channel(`shop_payment_status_${shopId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shops", filter: `id=eq.${shopId}` }, (payload) => {
        setInfo(computeShopPaymentInfo(payload.new));
      })
      .subscribe();

    const tick = window.setInterval(() => {
      setInfo((prev) => {
        if (!prev) return prev;
        const next = { ...prev, remainingMs: prev.deadline ? Math.max(0, new Date(prev.deadline).getTime() - Date.now()) : 0 };
        if (next.remainingMs === 0) void maybeEnforce(next);
        return next;
      });
    }, 1000);

    // Enforce right away on mount in case we arrive past the deadline
    const initialEnforce = window.setTimeout(async () => {
      const { data } = await supabase
        .from("shops")
        .select(
          "id, commission_balance_due, commission_threshold, shop_payment_status, threshold_reached_at, first_deadline_at, locked_at, second_deadline_at, final_suspension_at, payment_deadline",
        )
        .eq("id", shopId)
        .maybeSingle();
      if (!mounted || !data) return;
      const computed = computeShopPaymentInfo(data);
      setInfo(computed);
      void maybeEnforce(computed);
    }, 300);

    return () => {
      mounted = false;
      window.clearInterval(tick);
      window.clearTimeout(initialEnforce);
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  return info;
}