import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Filet de sécurité : appelé depuis la page de succès pour vérifier
 * le statut d'un paiement GeniusPay par sa référence et créditer
 * l'utilisateur si le webhook n'a pas (encore) été reçu.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authUserId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      authUserId = JSON.parse(atob(token.split(".")[1]))?.sub;
      if (!authUserId) throw new Error("invalid");
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Token invalide" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference } = await req.json().catch(() => ({}));
    if (!reference) {
      return new Response(JSON.stringify({ success: false, error: "reference manquante" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Retrouver le paiement local
    let { data: payment } = await supabase
      .from("payments")
      .select("id, user_id, status, amount, currency, transaction_id, metadata")
      .eq("transaction_id", reference)
      .maybeSingle();

    if (!payment) {
      const { data: paymentByOrderId } = await supabase
        .from("payments")
        .select("id, user_id, status, amount, currency, transaction_id, metadata")
        .contains("metadata", { order_id: reference })
        .maybeSingle();
      payment = paymentByOrderId;
    }

    if (!payment) {
      return new Response(JSON.stringify({ success: false, error: "Paiement introuvable" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payment.user_id !== authUserId) {
      return new Response(JSON.stringify({ success: false, error: "Accès refusé" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = (payment.metadata || {}) as Record<string, unknown>;
    const paymentType = (meta.payment_type as string) || "subscription";
    const shopId = typeof meta.shop_id === "string" ? meta.shop_id : null;

    if (payment.status === "completed" && paymentType !== "shop_activation") {
      return new Response(JSON.stringify({ success: true, status: "completed", alreadyApplied: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "completed" && paymentType === "shop_activation" && shopId) {
      await supabase.rpc("apply_shop_activation", {
        p_shop_id: shopId,
        p_user_id: payment.user_id,
        p_amount: Number(payment.amount) || 0,
        p_transaction_reference: payment.transaction_id || reference,
        p_payment_method: "geniuspay",
      });
      return new Response(JSON.stringify({ success: true, status: "completed", applied: true, shop_id: shopId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Interroger GeniusPay
    const apiKey = Deno.env.get("GENIUSPAY_API_KEY");
    const apiSecret = Deno.env.get("GENIUSPAY_API_SECRET");
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ success: false, error: "Passerelle non configurée" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gatewayReference = payment.transaction_id || reference;
    const resp = await fetch(`https://pay.genius.ci/api/v1/merchant/payments/${gatewayReference}`, {
      method: "GET",
      headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret },
    });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("GeniusPay verify error:", resp.status, json);
      return new Response(JSON.stringify({ success: false, status: payment.status, error: "Vérification échouée" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remote = json.data || json;
    const remoteStatus = remote?.status;
    console.log("verify-payment", { reference, gatewayReference, remoteStatus });

    if (remoteStatus !== "completed" && remoteStatus !== "success") {
      return new Response(JSON.stringify({ success: true, status: remoteStatus || payment.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marquer payé + créditer (mêmes règles que le webhook)
    await supabase.from("payments").update({
      status: "completed",
      payment_method: remote?.payment_method || remote?.provider || "geniuspay",
    }).eq("id", payment.id);

    const userId = payment.user_id;
    const creditsSize = Number(meta.credits_size || 0);

    if (paymentType === "shop_activation") {
      if (!shopId) {
        return new Response(JSON.stringify({ success: false, error: "Boutique manquante pour l'activation" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: activationResult, error: activationError } = await supabase.rpc("apply_shop_activation", {
        p_shop_id: shopId,
        p_user_id: userId,
        p_amount: Number(payment.amount) || 0,
        p_transaction_reference: payment.transaction_id || reference,
        p_payment_method: remote?.payment_method || remote?.provider || "geniuspay",
      });
      if (activationError || activationResult?.success === false) {
        console.error("verify-payment activation failed:", { activationError, activationResult });
        return new Response(JSON.stringify({ success: false, error: "Activation échouée" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (paymentType === "credits" && creditsSize > 0) {
      const { data: profile } = await supabase
        .from("profiles").select("purchased_credits, has_showcase_access").eq("id", userId).single();
      const newTotal = (profile?.purchased_credits || 0) + creditsSize;
      const enableShowcase = creditsSize >= 50 || profile?.has_showcase_access;
      await supabase.from("profiles").update({
        purchased_credits: newTotal, has_showcase_access: enableShowcase,
      }).eq("id", userId);
      await supabase.from("credit_purchases").insert({
        user_id: userId, pack_size: creditsSize,
        pack_price: Number(payment.amount) || 0, credits_added: creditsSize,
      });
    } else {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await supabase.from("subscriptions").update({
        status: "active",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, status: "completed", applied: true, shop_id: shopId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-payment error:", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erreur" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});