import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAuthorizedCron, cronUnauthorizedResponse } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron worker: réconcilie les paiements `pending` en interrogeant GeniusPay
 * AVANT de les marquer en échec. Si GeniusPay confirme le paiement, on
 * applique le même crédit que le webhook (activation boutique, abonnement,
 * commission, crédits…). Sinon, si le paiement est trop vieux, on le bascule
 * en `failed`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const apiKey = Deno.env.get("GENIUSPAY_API_KEY");
  const apiSecret = Deno.env.get("GENIUSPAY_API_SECRET");

  // Délais (en minutes) :
  // - REVERIFY_AFTER : on commence à interroger GeniusPay
  // - FAIL_AFTER    : on bascule définitivement en échec si toujours non payé
  const REVERIFY_AFTER = 10;
  const FAIL_AFTER = 120; // 2 heures

  const sinceIso = new Date(Date.now() - REVERIFY_AFTER * 60_000).toISOString();

  const { data: pendings, error } = await supabase
    .from("payments")
    .select("id, user_id, amount, transaction_id, payment_method, metadata, created_at")
    .eq("status", "pending")
    .lt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("reconcile-pending-payments query error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let confirmed = 0, stillPending = 0, failed = 0, errors = 0;

  for (const p of pendings || []) {
    const meta = (p.metadata || {}) as Record<string, unknown>;
    const paymentType = (meta.payment_type as string) || "subscription";
    const shopId = typeof meta.shop_id === "string" ? meta.shop_id : null;
    const reference = p.transaction_id || (meta.order_id as string) || null;
    const ageMin = (Date.now() - new Date(p.created_at as string).getTime()) / 60_000;

    if (!reference || !apiKey || !apiSecret) {
      if (ageMin >= FAIL_AFTER) {
        await markFailed(supabase, p.id, meta, "missing_reference_or_keys");
        failed++;
      } else {
        stillPending++;
      }
      continue;
    }

    try {
      const resp = await fetch(`https://pay.genius.ci/api/v1/merchant/payments/${reference}`, {
        method: "GET",
        headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret },
      });
      const json: any = await resp.json().catch(() => ({}));
      const remote = json?.data || json;
      const remoteStatus: string | undefined = remote?.status;

      if (remoteStatus === "completed" || remoteStatus === "paid") {
        // Marquer payé
        await supabase.from("payments").update({
          status: "completed",
          payment_method: remote?.payment_method || remote?.provider || p.payment_method || "geniuspay",
        }).eq("id", p.id);

        // Appliquer le crédit selon le type
        try {
          if (paymentType === "shop_activation" && shopId) {
            await supabase.rpc("apply_shop_activation", {
              p_shop_id: shopId,
              p_user_id: p.user_id,
              p_amount: Number(p.amount) || 0,
              p_transaction_reference: reference,
              p_payment_method: remote?.payment_method || "geniuspay",
            });
          } else if (paymentType === "commission_payment" && shopId) {
            await supabase.rpc("apply_commission_payment", {
              p_shop_id: shopId,
              p_amount: Number(p.amount) || 0,
              p_transaction_reference: reference,
              p_created_by: p.user_id,
              p_payment_method: remote?.payment_method || "geniuspay",
              p_notes: "Réconciliation automatique GeniusPay",
            });
          } else if (paymentType === "shop_subscription" && shopId) {
            await supabase.rpc("apply_shop_subscription", {
              p_shop_id: shopId,
              p_user_id: p.user_id,
              p_plan: (meta.plan as string) || "starter",
              p_amount: Number(p.amount) || 0,
              p_transaction_reference: reference,
              p_payment_method: remote?.payment_method || "geniuspay",
            });
          } else if (paymentType === "credits") {
            const size = Number(meta.credits_size || 0);
            if (size > 0) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("purchased_credits, has_showcase_access")
                .eq("id", p.user_id).single();
              await supabase.from("profiles").update({
                purchased_credits: (profile?.purchased_credits || 0) + size,
                has_showcase_access: size >= 50 || profile?.has_showcase_access,
              }).eq("id", p.user_id);
              await supabase.from("credit_purchases").insert({
                user_id: p.user_id, pack_size: size,
                pack_price: Number(p.amount) || 0, credits_added: size,
              });
            }
          } else {
            const start = new Date();
            const end = new Date(); end.setDate(end.getDate() + 30);
            await supabase.from("subscriptions").update({
              status: "active",
              start_date: start.toISOString(),
              end_date: end.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("user_id", p.user_id);
          }
        } catch (e) {
          console.error("reconcile apply error:", e);
        }

        confirmed++;
      } else if (ageMin >= FAIL_AFTER) {
        await markFailed(supabase, p.id, meta, `pending_timeout_${FAIL_AFTER}min_remote_${remoteStatus || "unknown"}`);
        failed++;
      } else {
        stillPending++;
      }
    } catch (e) {
      console.error("reconcile fetch error:", e);
      errors++;
      if (ageMin >= FAIL_AFTER) {
        await markFailed(supabase, p.id, meta, "gateway_unreachable_timeout");
        failed++;
      }
    }
  }

  const summary = { success: true, scanned: pendings?.length || 0, confirmed, failed, stillPending, errors };
  console.log("reconcile-pending-payments", summary);
  return new Response(JSON.stringify(summary), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function markFailed(supabase: any, id: string, meta: Record<string, unknown>, reason: string) {
  await supabase.from("payments").update({
    status: "failed",
    metadata: {
      ...meta,
      expired_at: new Date().toISOString(),
      failure_reason: reason,
    },
  }).eq("id", id);
}