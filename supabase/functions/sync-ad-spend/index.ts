import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function syncMeta(accountId: string, token: string) {
  // accountId may be "act_xxx" or "xxx"
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = `https://graph.facebook.com/v19.0/${id}/insights?fields=spend,account_currency,date_start,date_stop&time_increment=1&date_preset=maximum&limit=500&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Meta API error ${res.status}`);
  }
  const rows: Array<{ spend: string; account_currency?: string; date_start: string }> = json.data || [];
  return rows.map((r) => ({
    spend_date: r.date_start,
    amount: Number(r.spend || 0),
    currency: r.account_currency || "XOF",
    raw: r,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return ok({ success: false, error: "Non authentifié" });

    const { ad_account_id } = await req.json().catch(() => ({}));
    if (!ad_account_id) return ok({ success: false, error: "ad_account_id requis" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: acc, error: accErr } = await admin
      .from("ad_accounts")
      .select("id, shop_id, user_id, provider, account_id, access_token")
      .eq("id", ad_account_id)
      .maybeSingle();

    if (accErr || !acc) return ok({ success: false, error: "Compte introuvable" });

    // Verify ownership through shops table
    const { data: shop } = await admin
      .from("shops")
      .select("id, user_id")
      .eq("id", acc.shop_id)
      .maybeSingle();
    if (!shop || shop.user_id !== user.id) {
      return ok({ success: false, error: "Accès refusé" });
    }

    let daily: Array<{ spend_date: string; amount: number; currency: string; raw: any }> = [];
    let currency = "XOF";
    try {
      if (acc.provider === "meta") {
        daily = await syncMeta(acc.account_id, acc.access_token);
      } else {
        throw new Error(`Provider ${acc.provider} non supporté pour le moment`);
      }
      if (daily.length > 0) currency = daily[0].currency || "XOF";
    } catch (e) {
      await admin
        .from("ad_accounts")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: (e as Error).message.slice(0, 500),
        })
        .eq("id", acc.id);
      return ok({ success: false, error: (e as Error).message });
    }

    if (daily.length > 0) {
      const rows = daily.map((d) => ({
        ad_account_id: acc.id,
        shop_id: acc.shop_id,
        spend_date: d.spend_date,
        amount: d.amount,
        currency: d.currency,
        raw: d.raw,
      }));
      const { error: upErr } = await admin
        .from("ad_spend_daily")
        .upsert(rows, { onConflict: "ad_account_id,spend_date" });
      if (upErr) {
        return ok({ success: false, error: upErr.message });
      }
    }

    const total = daily.reduce((s, r) => s + r.amount, 0);
    await admin
      .from("ad_accounts")
      .update({
        total_spend: total,
        currency,
        last_synced_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
      })
      .eq("id", acc.id);

    return ok({ success: true, days: daily.length, total, currency });
  } catch (e) {
    return ok({ success: false, error: (e as Error).message });
  }
});