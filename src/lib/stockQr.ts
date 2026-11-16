import { supabase } from "@/integrations/supabase/client";

// Les trois fonctions SQL du stock par QR (migration 20261116100000) ne sont pas dans les types générés ; on type l'appel ici.
type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => RpcResult;

export interface ScannedProduct {
  product_id: string;
  shop_id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
}

export async function getProductStockQr(productId: string): Promise<{ code?: string; disabled?: boolean; failed?: boolean }> {
  const { data, error } = await rpc("get_or_create_product_stock_qr", { p_product_id: productId });
  if (error) return error.message.includes("stock_qr_disabled") ? { disabled: true } : { failed: true };
  return { code: data as string };
}

export async function lookupProductByStockQr(code: string): Promise<ScannedProduct | null> {
  const { data, error } = await rpc("lookup_product_by_stock_qr", { p_code: code });
  const r = data as (ScannedProduct & { found?: boolean }) | null;
  return !error && r?.found ? r : null;
}

export async function recordStockMovement(p: {
  shopId: string; productId: string; type: "restock" | "adjustment"; quantity: number; notes?: string;
}): Promise<{ ok: boolean; newStock: number; error: string }> {
  const { data, error } = await rpc("record_stock_movement", {
    p_shop_id: p.shopId, p_product_id: p.productId, p_variant_id: null, p_unit_code: null,
    p_movement_type: p.type, p_quantity: p.quantity, p_notes: p.notes ?? null,
  });
  const r = data as { success?: boolean; new_stock?: number; error?: string } | null;
  if (error || !r?.success) return { ok: false, newStock: 0, error: r?.error || error?.message || "Mouvement non enregistré." };
  return { ok: true, newStock: r.new_stock ?? 0, error: "" };
}
