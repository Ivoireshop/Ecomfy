import { supabase } from "@/integrations/supabase/client";

// Fonctions serveur du module de livraison (migrations 20261105100000 et 20261105110000). Les types générés de Supabase
// ne les connaissent pas encore : on passe par un client typé localement plutôt que par `any`.
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function deliveryRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export type ProviderRole = "owner" | "admin" | "dispatcher" | "cashier";

export interface ProviderInfo {
  provider_id: string;
  company_name: string;
  member_role: ProviderRole;
  is_active: boolean;
}

export interface ProviderDeliveryRow {
  delivery_id: string;
  order_id: string;
  order_number: string | null;
  status: string;
  driver_id: string | null;
  failure_reason: string | null;
  customer_name: string | null;
  customer_city: string | null;
  total_amount: number | null;
  payment_status: string | null;
  cash_status: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ProviderDriverRow {
  member_id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
}

export interface ProviderPaymentRow {
  payment_id: string;
  delivery_id: string;
  order_number: string | null;
  customer_name: string | null;
  driver_name: string | null;
  amount_collected: number;
  status: "collected_by_driver" | "remitted_to_company" | "remitted_to_shop";
  collected_at: string;
  remitted_to_company_at: string | null;
  remitted_to_shop_at: string | null;
}

export const canManageDeliveries = (role?: ProviderRole | null) => role === "owner" || role === "admin" || role === "dispatcher";
export const canManageCash = (role?: ProviderRole | null) => role === "owner" || role === "admin" || role === "cashier";

// --- Preuves de livraison (stockage privé « delivery-proofs », chemin <id de livraison>/<fichier>) ---

/** Dépose la signature (image encodée du canevas) dans le stockage privé et renvoie son chemin. */
export async function uploadDeliveryProof(deliveryId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${deliveryId}/signature-${Date.now()}.png`;
  const { error } = await supabase.storage.from("delivery-proofs").upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Dépôt de la signature impossible : ${error.message}`);
  return path;
}

/** Ouvre une preuve : lien signé de courte durée (chemin du stockage) ou, pour une ancienne preuve, l'image encodée. */
export async function openDeliveryProof(ref: string): Promise<void> {
  let url: string;
  if (ref.startsWith("data:")) {
    url = URL.createObjectURL(await (await fetch(ref)).blob());
  } else if (/^https?:\/\//.test(ref)) {
    url = ref;
  } else {
    const { data, error } = await supabase.storage.from("delivery-proofs").createSignedUrl(ref, 120);
    if (error || !data?.signedUrl) throw new Error(error?.message || "Preuve introuvable.");
    url = data.signedUrl;
  }
  window.open(url, "_blank", "noopener");
}

// --- Événements (notifications) ---

export interface DeliveryEventRow {
  id: string;
  delivery_id: string;
  order_id: string;
  kind: "created" | "assigned" | "status" | "cash";
  status: string | null;
  detail: string | null;
  order_number: string | null;
}

export type EventAudience = "shop" | "provider" | "driver";

export interface EventMessage {
  title: string;
  description?: string;
  tone: "success" | "error" | "info";
}

const fcfa = (v: string | null) => (v && !Number.isNaN(Number(v)) ? `${Number(v).toLocaleString("fr-FR")} FCFA` : "");

/** Message affiché pour un événement, selon qui le reçoit ; null = pas de notification. */
export function describeDeliveryEvent(ev: DeliveryEventRow, audience: EventAudience): EventMessage | null {
  const ref = ev.order_number ? `#${ev.order_number}` : "";
  if (ev.kind === "assigned" && audience === "driver") {
    return { title: "Nouvelle course", description: `La commande ${ref} vous a été assignée.`, tone: "info" };
  }
  if (ev.kind === "status") {
    const cancelled = !!ev.detail && ev.detail.startsWith("Commande annulée");
    if (ev.status === "failed") {
      if (audience === "driver") return cancelled ? { title: "Course annulée", description: `La commande ${ref} a été annulée par la boutique.`, tone: "error" } : null;
      return { title: `Échec de livraison ${ref}`, description: ev.detail || undefined, tone: "error" };
    }
    if (audience === "shop" && (ev.status === "in_transit" || ev.status === "picked_up")) return { title: `Commande ${ref} en route`, tone: "info" };
    if (audience !== "driver" && ev.status === "delivered") return { title: `Commande ${ref} livrée`, tone: "success" };
    if (audience !== "driver" && ev.status === "returned") return { title: `Colis ${ref} retourné à la boutique`, tone: "info" };
  }
  if (ev.kind === "cash" && audience === "shop") {
    if (ev.status === "collected_by_driver") return { title: `Argent encaissé ${ref}`, description: `${fcfa(ev.detail)} encaissés par le livreur.`, tone: "info" };
    if (ev.status === "remitted_to_shop") return { title: `Argent reversé ${ref}`, description: `${fcfa(ev.detail)} reversés par le prestataire.`, tone: "success" };
  }
  return null;
}
