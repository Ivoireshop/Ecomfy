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

    // Retraits (payouts) : clôture du retrait et écriture au ledger (finalize_withdrawal, idempotente).
    // Ne passe jamais par la confirmation de paiement ci-dessous.
    const eventName = String(event || "").toLowerCase();
    if (/^(payout|withdrawal|transfer)\./.test(eventName)) {
      const succeeded = /\.(success|succeeded|completed|paid)$/.test(eventName) || (!/\.(fail|failed|rejected|cancel|cancelled|canceled|error)$/.test(eventName) && ["completed", "success", "succeeded"].includes(String(data?.status).toLowerCase()));
      const failed = /\.(fail|failed|rejected|cancel|cancelled|canceled|error)$/.test(eventName) || ["failed", "rejected", "cancelled", "canceled"].includes(String(data?.status).toLowerCase());
      if (!succeeded && !failed) {
        return ack({ success: true, ignored: true, event: eventName });
      }

      const candidates = [meta?.withdrawal_reference, data?.merchant_reference, data?.reference, data?.id]
        .filter((v) => typeof v === "string" && v.length > 0);
      if (candidates.length === 0) {
        return ack({ success: false, error: "Missing withdrawal reference" });
      }

      const payoutEventId = req.headers.get("x-webhook-delivery") || `${candidates[0]}_${eventName}`;
      const { error: payoutDupErr } = await supabase.from("payment_events").insert({
        event_id: payoutEventId, provider: "geniuspay", event_type: event, payload,
      });
      if (payoutDupErr && (payoutDupErr as any).code === "23505") {
        return ack({ success: true, duplicate: true });
      }

      const { data: wd } = await supabase
        .from("withdrawal_requests")
        .select("withdrawal_reference")
        .or(candidates.flatMap((c) => [`withdrawal_reference.eq.${c}`, `provider_reference.eq.${c}`]).join(","))
        .maybeSingle();
      if (!wd) {
        console.warn("[ecomfy-pay-webhook] Withdrawal not found:", candidates);
        return ack({ success: false, error: "Withdrawal record not found" });
      }

      const { data: finRes, error: finErr } = await supabase.rpc("finalize_withdrawal", {
        p_withdrawal_reference: wd.withdrawal_reference,
        p_status: succeeded ? "SUCCEEDED" : "FAILED",
        p_failure_reason: succeeded ? null : (data?.failure_reason || data?.message || null),
        p_provider_reference: typeof data?.id === "string" ? data.id : null,
      });
      if (finErr) {
        console.error("[ecomfy-pay-webhook] finalize_withdrawal error:", finErr);
        // Sans cela, la nouvelle tentative du prestataire serait écartée comme doublon et le retrait ne serait jamais clôturé.
        await supabase.from("payment_events").delete().eq("provider", "geniuspay").eq("event_id", payoutEventId);
        return ack({ success: false, error: "Cannot finalize withdrawal" }, 500);
      }
      return ack({ success: !!finRes?.success, ...finRes });
    }

    // Succès ou échec explicite uniquement : un événement intermédiaire (créé, en cours…) ne doit jamais faire échouer un paiement.
    const isSuccess = event === "payment.success" || data?.status === "completed" || data?.status === "success";
    const failureRe = /(fail|cancel|expire|declin|reject|error)/;
    const isFailure = !isSuccess && (failureRe.test(eventName) || failureRe.test(String(data?.status || "").toLowerCase()));
    if (!isSuccess && !isFailure) {
      return ack({ success: true, ignored: true, event: eventName });
    }

    // Confirmation auprès de l'API GeniusPay avant de traiter un succès. Placée avant la transaction :
    // en cas d'échec (503), rien n'est inscrit et la nouvelle tentative du fournisseur est traitée normalement.
    // `remoteAmount` / `remoteCurrency` : montant réellement encaissé, comparé à ecomfy_payments.amount (C6) par confirm_ecomfy_payment.
    let remoteAmount: unknown = undefined;
    let remoteCurrency: unknown = undefined;
    if (isSuccess) {
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

    // Paiement → commande → crédit du portefeuille : une seule transaction côté base (confirm_ecomfy_payment), verrouillée,
    // idempotente et rejouable. Le montant encaissé est comparé à celui enregistré à l'initialisation (C6) dans la même fonction.
    // L'événement n'est inscrit dans payment_events qu'avec le résultat : une livraison tombée en erreur est rejouée par le
    // prestataire (500 ci-dessous) au lieu d'être écartée comme doublon.
    const eventId = req.headers.get("x-webhook-delivery") || `${providerRef || internalRef}_${event}`;
    const { data: res, error: rpcErr } = await supabase.rpc("confirm_ecomfy_payment", {
      p_internal_reference: internalRef || null,
      p_provider_reference: providerRef ? String(providerRef) : null,
      p_outcome: isSuccess ? "SUCCEEDED" : "FAILED",
      p_remote_amount: isSuccess ? Number(remoteAmount) : null,
      p_remote_currency: isSuccess && remoteCurrency ? String(remoteCurrency) : null,
      p_event_id: eventId,
      p_event_type: String(event),
      p_payload: payload,
      p_failure_reason: isFailure ? (data?.failure_reason || data?.message || null) : null,
    });

    if (rpcErr) {
      console.error("[ecomfy-pay-webhook] confirm_ecomfy_payment error:", rpcErr);
      return ack({ success: false, error: "Cannot confirm payment" }, 500);
    }

    if (!res?.success) {
      if (res?.retryable) {
        // Transaction annulée en bloc (rien n'a bougé) : le prestataire doit réessayer.
        console.error("[ecomfy-pay-webhook] Transaction rolled back, provider will retry:", res?.error);
        return ack({ success: false, error: "Payment processing failed, retry later" }, 500);
      }
      if (res?.pending_replay) {
        // Portefeuille gelé : encaissement et commande acquis, crédit rejoué par ecomfy-pay-settlement après le dégel.
        console.warn("[ecomfy-pay-webhook] Credit blocked, will be replayed:", res?.internal_reference, res?.error);
        return ack({ success: true, status: res.status, credit_pending: true, reference: res.internal_reference });
      }
      // Paiement introuvable ou montant différent (déjà journalisé) : 200 pour ne pas relancer en boucle.
      console.warn("[ecomfy-pay-webhook] Not processed:", res?.error, res?.reference || { internalRef, providerRef });
      return ack({ success: false, error: res?.error, reference: res?.reference });
    }

    if (!isSuccess) {
      return ack({ success: true, status: res.status });
    }

    // Notification au vendeur : seulement quand ce traitement vient de créditer (pas à chaque rejeu). E-mail best-effort,
    // clé d'idempotence par paiement.
    if (res?.steps?.credit === "done") {
      try {
        const { data: payment } = await supabase
          .from("ecomfy_payments")
          .select("id, merchant_id, amount, net_merchant_amount, internal_reference, payment_method")
          .eq("id", res.payment_id)
          .maybeSingle();
        const { data: profile } = payment
          ? await supabase.from("profiles").select("email, full_name").eq("id", payment.merchant_id).maybeSingle()
          : { data: null };

        if (payment && profile?.email) {
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
    }

    return ack({ success: true, status: "SUCCEEDED", already_processed: !!res.already_processed, steps: res.steps });
  } catch (err: any) {
    console.error("[ecomfy-pay-webhook] Unexpected error:", err);
    return ack({ success: false, error: err.message || "Webhook error" });
  }
});
