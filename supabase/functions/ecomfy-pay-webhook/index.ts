import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { GENIUSPAY_API_URL } from "../_shared/geniuspayConfig.ts";
import { verifyWebhookSignature } from "../_shared/webhookSignature.ts";
import { remoteAmountMatches } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-webhook-event, x-webhook-environment, x-webhook-delivery",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ack = (body: Record<string, unknown>, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    // C5 : authentifier l'appelant avant toute lecture ou écriture en base.
    const secret = Deno.env.get("GENIUSPAY_WEBHOOK_SECRET");
    if (!secret) {
      // 500 : le fournisseur réessaiera une fois le secret configuré.
      console.error("[ecomfy-pay-webhook] GENIUSPAY_WEBHOOK_SECRET not configured");
      return ack({ success: false, error: "Webhook secret not configured" }, 500);
    }

    const rawBody = await req.text();
    const check = await verifyWebhookSignature({
      secret,
      rawBody,
      signature: req.headers.get("x-webhook-signature") || "",
      timestamp: req.headers.get("x-webhook-timestamp") || "",
    });
    if (!check.ok) {
      console.warn("[ecomfy-pay-webhook] Rejected:", check.reason);
      return ack({ success: false, error: "Unauthorized" }, 401);
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return ack({ success: false, error: "Invalid JSON" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event = payload?.event || req.headers.get("x-webhook-event") || "payment.success";
    const data = payload?.data || payload;
    const meta = data?.metadata || {};

    const internalRef = meta?.internal_reference || data?.internal_reference;
    const providerRef = data?.reference || data?.id;

    if (!internalRef && !providerRef) {
      return ack({ success: false, error: "Missing transaction reference" });
    }

    // Confirmation auprès de l'API GeniusPay avant de traiter un succès. Placée avant l'insertion
    // d'idempotence : en cas d'échec (503), la nouvelle tentative du fournisseur n'est pas ignorée.
    // `remoteAmount` / `remoteCurrency` : montant réellement encaissé, comparé plus bas à ecomfy_payments.amount (C6).
    let remoteAmount: unknown = undefined;
    let remoteCurrency: unknown = undefined;
    if (event === "payment.success" || data?.status === "completed" || data?.status === "success") {
      const apiKey = Deno.env.get("GENIUSPAY_API_KEY");
      const apiSecret = Deno.env.get("GENIUSPAY_API_SECRET");
      if (!apiKey || !apiSecret || !providerRef) {
        console.error("[ecomfy-pay-webhook] Cannot confirm payment with provider", { hasKeys: !!(apiKey && apiSecret), providerRef });
        return ack({ success: false, error: "Cannot confirm payment" }, 503);
      }
      const resp = await fetch(`${GENIUSPAY_API_URL}/payments/${encodeURIComponent(String(providerRef))}`, {
        method: "GET",
        headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret },
      }).catch(() => null);
      const json: any = resp ? await resp.json().catch(() => ({})) : {};
      const remote = json?.data || json;
      const remoteStatus = remote?.status;
      remoteAmount = remote?.amount;
      remoteCurrency = remote?.currency;
      if (!resp?.ok) {
        console.error("[ecomfy-pay-webhook] Provider confirmation failed:", resp?.status);
        return ack({ success: false, error: "Cannot confirm payment" }, 503);
      }
      if (remoteStatus !== "completed" && remoteStatus !== "paid" && remoteStatus !== "success") {
        console.warn("[ecomfy-pay-webhook] Provider does not confirm success:", { providerRef, remoteStatus });
        return ack({ success: false, error: "Payment not confirmed by provider" });
      }
      if (remoteAmount === undefined || remoteAmount === null || remoteAmount === "") {
        // Sans montant encaissé, on ne peut pas comparer : refus avec nouvelle tentative (503), jamais de crédit.
        console.error("[ecomfy-pay-webhook] Provider response has no amount", { providerRef });
        return ack({ success: false, error: "Cannot confirm payment amount" }, 503);
      }
    }

    // 1. Idempotence Webhook
    const eventId = req.headers.get("x-webhook-delivery") || `${providerRef}_${event}`;
    const { error: dupErr } = await supabase.from("payment_events").insert({
      event_id: eventId,
      provider: "geniuspay",
      event_type: event,
      payload: payload,
    });

    if (dupErr && (dupErr as any).code === "23505") {
      console.log("[ecomfy-pay-webhook] Duplicate webhook ignored:", eventId);
      return ack({ success: true, duplicate: true });
    }

    // 2. Récupérer le paiement Ecomfy Pay
    let query = supabase.from("ecomfy_payments").select("*");
    if (internalRef) {
      query = query.eq("internal_reference", internalRef);
    } else {
      query = query.eq("provider_reference", providerRef);
    }

    const { data: payment, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !payment) {
      console.warn("[ecomfy-pay-webhook] Payment record not found:", { internalRef, providerRef });
      return ack({ success: false, error: "Payment record not found" });
    }

    // Anti-double crédit si déjà SUCCEEDED
    if (payment.status === "SUCCEEDED") {
      return ack({ success: true, already_processed: true });
    }

    // 3. Traiter le statut du paiement
    const isSuccess = event === "payment.success" || data?.status === "completed" || data?.status === "success";

    // C6 : le montant encaissé chez GeniusPay doit être celui enregistré à l'initialisation (et la même devise).
    // Sinon : ni crédit du portefeuille ni commande marquée payée ; réponse 200 pour ne pas relancer en boucle.
    if (isSuccess) {
      const currencyOk = remoteCurrency === undefined || remoteCurrency === null
        || String(remoteCurrency).toUpperCase() === String(payment.currency || "XOF").toUpperCase();
      if (!remoteAmountMatches(remoteAmount, payment.amount) || !currencyOk) {
        console.error("[ecomfy-pay-webhook] Amount mismatch, payment not credited:", {
          internalRef: payment.internal_reference,
          expected: payment.amount,
          received: remoteAmount,
          expectedCurrency: payment.currency,
          receivedCurrency: remoteCurrency,
        });
        return ack({ success: false, error: "Amount mismatch", reference: payment.internal_reference });
      }
    }

    if (isSuccess) {
      // Mettre à jour la transaction
      await supabase
        .from("ecomfy_payments")
        .update({
          status: "SUCCEEDED",
          provider_reference: providerRef || payment.provider_reference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      // Si une commande est liée, la marquer comme PAYÉE
      if (payment.order_id) {
        await supabase
          .from("orders")
          .update({
            payment_status: "PAID",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.order_id);
      }

      // Crédit atomique sur le Wallet du vendeur en PENDING BALANCE
      const { data: creditRes, error: creditErr } = await supabase.rpc(
        "credit_merchant_wallet_pending",
        {
          p_merchant_id: payment.merchant_id,
          p_payment_id: payment.id,
          p_gross_amount: Number(payment.amount),
          p_net_amount: Number(payment.net_merchant_amount),
          p_currency: payment.currency,
          p_settlement_hours: 72,
          p_reference: payment.internal_reference,
        }
      );

      if (creditErr) {
        console.error("[ecomfy-pay-webhook] Wallet credit error:", creditErr);
      } else {
        console.log("[ecomfy-pay-webhook] Wallet credited successfully:", creditRes);
      }

      // Envoyer notification au vendeur (e-mail transactionnel best-effort)
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", payment.merchant_id)
          .maybeSingle();

        if (profile?.email) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "order-payment-success",
              recipientEmail: profile.email,
              idempotencyKey: `ecomfy-pay-success-${payment.id}`,
              templateData: {
                merchantName: profile.full_name || "Marchand Ecomfy",
                amount: payment.amount,
                netAmount: payment.net_merchant_amount,
                reference: payment.internal_reference,
                paymentMethod: payment.payment_method,
              },
            },
          });
        }
      } catch (e) {
        console.warn("[ecomfy-pay-webhook] Notification email failed:", e);
      }

      return ack({ success: true, status: "SUCCEEDED" });
    } else {
      await supabase
        .from("ecomfy_payments")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return ack({ success: true, status: "FAILED" });
    }
  } catch (err: any) {
    console.error("[ecomfy-pay-webhook] Unexpected error:", err);
    return ack({ success: false, error: err.message || "Webhook error" });
  }
});
