// Connect Ads : connexion Meta par OAuth. Le jeton reste côté serveur (Edge Function meta-ads-oauth) :
// le navigateur ne voit jamais que des identifiants, des noms et des statuts.
import { supabase } from "@/integrations/supabase/client";

export interface MetaBusiness { id: string; name: string }
export interface MetaAdAccountChoice {
  account_id: string;
  name: string;
  currency: string | null;
  status: number | null; // 1 = actif
  business_id: string | null;
}
export interface MetaConnectionStatus {
  connected: boolean;
  expired?: boolean;
  metaUserName?: string | null;
  expiresAt?: string | null;
  canListBusinesses?: boolean;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-ads-oauth", { body });
  if (error) throw new Error(error.message || "Service Meta indisponible.");
  if (!data?.success) throw new Error(data?.error || "Opération Meta refusée.");
  return data as T;
}

export const MetaAdsService = {
  /** Redirige vers Meta pour autoriser Ecomfy. */
  async startConnection(shopId: string): Promise<void> {
    const res = await invoke<{ authUrl: string }>({ action: "get_auth_url", shop_id: shopId });
    window.location.assign(res.authUrl);
  },

  exchangeCode(code: string, state: string) {
    return invoke<{ shopId: string; metaUserName: string | null; businesses: MetaBusiness[]; canListBusinesses: boolean }>({
      action: "exchange_code", code, state,
    });
  },

  status(shopId: string) {
    return invoke<MetaConnectionStatus>({ action: "status", shop_id: shopId });
  },

  /** `businessId` null = comptes personnels de l'utilisateur Meta. */
  async listAccounts(shopId: string, businessId: string | null): Promise<MetaAdAccountChoice[]> {
    return (await invoke<{ accounts: MetaAdAccountChoice[] }>({ action: "list_accounts", shop_id: shopId, business_id: businessId })).accounts;
  },

  connectAccounts(shopId: string, accounts: { account_id: string; business_id: string | null }[]) {
    return invoke<{ connected: { id: string; account_id: string }[]; failed: { account_id: string; error: string }[] }>({
      action: "connect_accounts", shop_id: shopId, accounts,
    });
  },

  async disconnect(shopId: string): Promise<void> {
    await invoke({ action: "disconnect", shop_id: shopId });
  },

  /** Synchronise un compte ; renvoie un message d'erreur ou null. */
  async syncAccount(adAccountId: string): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke("sync-ad-spend", { body: { ad_account_id: adAccountId } });
    if (error || !data?.success) return data?.error || error?.message || "Synchronisation échouée";
    return null;
  },
};
