import { supabase } from "@/integrations/supabase/client";

// Fonctions SQL de la migration 20261116110000 : absentes des types générés, on type l'appel ici.
type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => RpcResult;

export interface ScanItem {
  product_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  scanned: boolean;
}

export interface ScanStatus {
  enabled: boolean;
  items: ScanItem[];
}

export async function fetchDeliveryScanStatus(deliveryId: string): Promise<ScanStatus> {
  const { data, error } = await rpc("get_delivery_scan_status", { p_delivery_id: deliveryId });
  if (error) throw new Error(error.message);
  const r = data as Partial<ScanStatus> | null;
  return { enabled: !!r?.enabled, items: r?.items ?? [] };
}

export interface ScanResult {
  ok: boolean;
  alreadyScanned: boolean;
  insufficientStock: boolean;
  productName: string;
  quantity: number;
  error: string;
}

export async function scanProductForDelivery(deliveryId: string, code: string): Promise<ScanResult> {
  const { data, error } = await rpc("driver_scan_product", { p_delivery_id: deliveryId, p_code: code });
  const r = data as {
    success?: boolean; already_scanned?: boolean; insufficient_stock?: boolean;
    product_name?: string; quantity?: number; error?: string;
  } | null;
  return {
    ok: !error && !!r?.success,
    alreadyScanned: !!r?.already_scanned,
    insufficientStock: !!r?.insufficient_stock,
    productName: r?.product_name ?? "",
    quantity: r?.quantity ?? 0,
    error: r?.error || error?.message || "Scan non enregistré.",
  };
}
