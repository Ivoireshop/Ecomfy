// Accès front à l'API Ecomfy Pay côté marchand : clés, destinations de webhooks, livraisons, paiements sandbox et page de
// paiement sandbox. Les tables ecomfy_api_* ne figurent pas encore dans src/integrations/supabase/types.ts (fichier généré) :
// l'accès non typé est concentré ici, les composants ne manipulent que les types exportés.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables absentes des types générés ; typage rétabli par les interfaces ci-dessous
const db = supabase as any;

export const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecomfy-pay-api`;

export const WEBHOOK_EVENTS = ["payment.succeeded", "payment.failed", "payment.cancelled", "payment.expired", "payment.refunded"] as const;

export interface ApiKeyRow {
  id: string;
  name: string;
  livemode: boolean;
  key_prefix: string;
  last4: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface WebhookEndpointRow {
  id: string;
  url: string;
  livemode: boolean;
  events: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DeliveryRow {
  id: string;
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  next_attempt_at: string;
  last_http_status: number | null;
  last_error: string | null;
  created_at: string;
  event_type: string;
  livemode: boolean;
  endpoint_url: string;
}

export interface SandboxPaymentRow {
  id: string;
  public_id: string;
  amount: number;
  status: string;
  client_reference: string | null;
  failure_code: string | null;
  checkout_url: string | null;
  created_at: string;
}

// Le projet n'active pas strictNullChecks : un type « union discriminée » ne se rétrécit pas, d'où des champs facultatifs.
export interface CreateResult { success: boolean; id?: string; secret?: string; error?: string }

const ERRORS: Record<string, string> = {
  kyc_required: "Votre vérification d'identité (KYC) doit être validée avant de créer une clé de production.",
  too_many_keys: "Limite atteinte : 10 clés actives par boutique et par mode. Révoquez-en une.",
  too_many_endpoints: "Limite atteinte : 5 destinations par boutique et par mode.",
  invalid_url: "URL invalide : elle doit commencer par https:// et pointer vers un site public.",
  invalid_events: "Choisissez au moins un événement valide.",
  invalid_name: "Le nom doit faire de 1 à 60 caractères.",
  not_found: "Introuvable.",
};
const explain = (code: unknown): string => (typeof code === "string" && ERRORS[code]) || "Une erreur est survenue. Réessayez.";

async function createWithSecret(fn: string, args: Record<string, unknown>): Promise<CreateResult> {
  const { data, error } = await db.rpc(fn, args);
  if (error) return { success: false, error: "Une erreur est survenue. Réessayez." };
  if (!data?.success) return { success: false, error: explain(data?.error) };
  return { success: true, id: data.id as string, secret: data.secret as string };
}

export const payDevApi = {
  async listKeys(shopId: string): Promise<ApiKeyRow[]> {
    const { data } = await db
      .from("ecomfy_api_keys")
      .select("id, name, livemode, key_prefix, last4, last_used_at, revoked_at, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    return (data ?? []) as ApiKeyRow[];
  },

  createKey: (shopId: string, livemode: boolean, name: string) =>
    createWithSecret("create_ecomfy_api_key", { p_shop_id: shopId, p_livemode: livemode, p_name: name }),

  async revokeKey(id: string): Promise<boolean> {
    const { data, error } = await db.rpc("revoke_ecomfy_api_key", { p_key_id: id });
    return !error && !!data?.success;
  },

  async listEndpoints(shopId: string): Promise<WebhookEndpointRow[]> {
    const { data } = await db
      .from("ecomfy_api_webhook_endpoints")
      .select("id, url, livemode, events, description, is_active, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    return (data ?? []) as WebhookEndpointRow[];
  },

  createEndpoint: (shopId: string, url: string, livemode: boolean, events: string[], description: string) =>
    createWithSecret("create_ecomfy_webhook_endpoint", {
      p_shop_id: shopId, p_url: url, p_livemode: livemode, p_events: events.length ? events : ["*"], p_description: description || null,
    }),

  async rotateSecret(id: string): Promise<{ success: boolean; secret?: string; error?: string }> {
    const { data, error } = await db.rpc("rotate_ecomfy_webhook_secret", { p_endpoint_id: id });
    if (error || !data?.success) return { success: false, error: explain(data?.error) };
    return { success: true, secret: data.secret as string };
  },

  async setEndpointActive(id: string, active: boolean): Promise<boolean> {
    const { error } = await db.from("ecomfy_api_webhook_endpoints").update({ is_active: active }).eq("id", id);
    return !error;
  },

  async deleteEndpoint(id: string): Promise<boolean> {
    const { error } = await db.from("ecomfy_api_webhook_endpoints").delete().eq("id", id);
    return !error;
  },

  async listDeliveries(shopId: string): Promise<DeliveryRow[]> {
    const { data: endpoints } = await db.from("ecomfy_api_webhook_endpoints").select("id, url").eq("shop_id", shopId);
    const urlById: Record<string, string> = Object.fromEntries((endpoints ?? []).map((e: { id: string; url: string }) => [e.id, e.url]));
    if (!Object.keys(urlById).length) return [];
    const { data } = await db
      .from("ecomfy_api_webhook_deliveries")
      .select("id, status, attempts, next_attempt_at, last_http_status, last_error, created_at, endpoint_id, ecomfy_api_events(type, livemode)")
      .in("endpoint_id", Object.keys(urlById))
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((d: Record<string, unknown>) => {
      const ev = d.ecomfy_api_events as { type: string; livemode: boolean } | null;
      return {
        id: d.id, status: d.status, attempts: d.attempts, next_attempt_at: d.next_attempt_at, last_http_status: d.last_http_status,
        last_error: d.last_error, created_at: d.created_at, event_type: ev?.type ?? "?", livemode: !!ev?.livemode,
        endpoint_url: urlById[d.endpoint_id as string] ?? "",
      } as DeliveryRow;
    });
  },

  async listSandboxPayments(shopId: string): Promise<SandboxPaymentRow[]> {
    const { data } = await db
      .from("ecomfy_api_payments")
      .select("id, public_id, amount, status, client_reference, failure_code, checkout_url, created_at")
      .eq("shop_id", shopId)
      .eq("livemode", false)
      .order("created_at", { ascending: false })
      .limit(10);
    return (data ?? []) as SandboxPaymentRow[];
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Page de paiement sandbox (publique, sans clé : l'identifiant du paiement fait office de secret)
// ---------------------------------------------------------------------------------------------------------------------
export interface SandboxCheckout {
  id: string;
  status: "pending" | "succeeded" | "failed" | "cancelled" | "expired" | "refunded";
  amount: number;
  currency: string;
  description: string | null;
  payment_method: string;
  business_name: string | null;
  success_url: string | null;
  cancel_url: string | null;
}

export type SandboxScenario = "success" | "insufficient_funds" | "declined" | "cancelled" | "expired";

export const sandboxCheckoutApi = {
  async get(id: string): Promise<SandboxCheckout | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/sandbox/checkout/${encodeURIComponent(id)}`);
      return res.ok ? ((await res.json()) as SandboxCheckout) : null;
    } catch {
      return null;
    }
  },

  async complete(id: string, scenario: SandboxScenario): Promise<{ ok: boolean; redirect_url?: string | null; code?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/sandbox/checkout/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, redirect_url: (body.redirect_url as string | null) ?? null };
      return { ok: false, code: body?.error?.code ?? "error" };
    } catch {
      return { ok: false, code: "network" };
    }
  },
};
