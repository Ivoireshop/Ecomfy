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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = Date.now();
    const horizon = new Date(now + 7 * 86400000).toISOString();

    // Fetch all accounts with a known expiry within the next 7 days (or already expired)
    const { data: accounts, error } = await admin
      .from("ad_accounts")
      .select("id, shop_id, user_id, provider, account_id, account_label, token_expires_at, token_expiry_notified_at")
      .not("token_expires_at", "is", null)
      .lte("token_expires_at", horizon);

    if (error) return ok({ success: false, error: error.message });

    let notified = 0;
    const results: any[] = [];

    for (const acc of accounts || []) {
      const expMs = new Date(acc.token_expires_at as string).getTime();
      const daysRemaining = Math.ceil((expMs - now) / 86400000);

      // Skip if we already notified within the last 24h for the same expiry milestone
      if (acc.token_expiry_notified_at) {
        const sinceMs = now - new Date(acc.token_expiry_notified_at).getTime();
        if (sinceMs < 24 * 3600 * 1000) continue;
      }

      // Get shop name + owner email
      const { data: shop } = await admin
        .from("shops")
        .select("id, business_name, user_id")
        .eq("id", acc.shop_id)
        .maybeSingle();
      if (!shop) continue;

      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", shop.user_id)
        .maybeSingle();
      if (!profile?.email) continue;

      const manageUrl = "https://visuelpro.cloud/shop-manager";

      const { error: emailErr } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "ad-token-expiring",
          recipientEmail: profile.email,
          idempotencyKey: `ad-token-${acc.id}-${Math.floor(expMs / 86400000)}`,
          templateData: {
            shopName: shop.business_name || "votre boutique",
            accountLabel: acc.account_label || `act_${acc.account_id}`,
            daysRemaining: Math.max(0, daysRemaining),
            expiresAt: acc.token_expires_at,
            manageUrl,
          },
        },
      });

      results.push({ id: acc.id, daysRemaining, sent: !emailErr, error: emailErr?.message });
      if (!emailErr) {
        notified++;
        await admin
          .from("ad_accounts")
          .update({ token_expiry_notified_at: new Date().toISOString() })
          .eq("id", acc.id);
      }
    }

    return ok({ success: true, scanned: accounts?.length || 0, notified, results });
  } catch (e) {
    return ok({ success: false, error: (e as Error).message });
  }
});