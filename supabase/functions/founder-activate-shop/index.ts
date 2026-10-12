import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { founderCorsHeaders as corsHeaders, jsonResponse as json, requireFounder } from "../_shared/founderAuth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Activation manuelle d'une boutique par un fondateur (frais d'activation encaissés hors ligne).
// apply_shop_activation exige un paiement `completed` correspondant : on l'enregistre ici, marqué
// `manual`, avec l'identité du fondateur, puis on appelle la RPC avec service_role.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await requireFounder(req, supabase, "founder-activate-shop");
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const { shop_id, amount, payment_method } = body ?? {};

    if (typeof shop_id !== "string" || !UUID_RE.test(shop_id)) {
      return json(400, { success: false, error: "Boutique invalide." });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return json(400, { success: false, error: "Montant invalide." });
    }
    const method = typeof payment_method === "string" && payment_method ? payment_method.slice(0, 50) : "cash_direct";

    // Le propriétaire vient de la base, jamais du corps de la requête.
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, user_id, is_activated")
      .eq("id", shop_id)
      .maybeSingle();
    if (shopError) {
      console.error("[founder-activate-shop] shop error:", shopError);
      return json(500, { success: false, error: "Lecture de la boutique impossible." });
    }
    if (!shop) return json(404, { success: false, error: "Boutique introuvable." });
    if (shop.is_activated) return json(200, { success: true, already_activated: true, shop_id });

    const reference = `MANUAL-ACTIVATION-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: shop.user_id,
        payment_method: method,
        amount: Math.round(amountNum),
        currency: "XOF",
        transaction_id: reference,
        status: "completed",
        metadata: {
          payment_type: "shop_activation",
          shop_id,
          gateway_reference: reference,
          manual: true,
          recorded_by: auth.userId,
        },
      })
      .select("id")
      .maybeSingle();
    if (paymentError || !payment?.id) {
      console.error("[founder-activate-shop] payment insert error:", paymentError);
      return json(500, { success: false, error: "Enregistrement du paiement impossible." });
    }

    const { data: result, error: rpcError } = await supabase.rpc("apply_shop_activation", {
      p_shop_id: shop_id,
      p_user_id: shop.user_id,
      p_amount: amountNum,
      p_transaction_reference: reference,
      p_payment_method: method,
    });

    if (rpcError || result?.success === false) {
      // Ne pas laisser un paiement « completed » sans activation.
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      if (rpcError) {
        console.error("[founder-activate-shop] RPC error:", rpcError);
        return json(500, { success: false, error: rpcError.message });
      }
      return json(400, { success: false, error: result?.error || "Activation refusée." });
    }

    return json(200, { success: true, ...(result ?? {}) });
  } catch (err: any) {
    console.error("[founder-activate-shop] Error:", err);
    return json(500, { success: false, error: err.message || "Erreur lors de l'activation de la boutique." });
  }
});
