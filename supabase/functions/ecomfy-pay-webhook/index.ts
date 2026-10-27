import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getConnector } from "../_shared/operators/index.ts";
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
    // Opérateur concerné : ?provider=<id> dans l'URL du webhook déclarée chez l'opérateur (GeniusPay par défaut).
    const connector = getConnector(new URL(req.url).searchParams.get("provider"));
    if (!connector) {
      return ack({ success: false, error: "Unknown provider" }, 404);
    }

    // C5 : authentifier l'appelant avant toute lecture ou écriture en base.
    const rawBody = await req.text();
    const auth = await connector.verifyWebhook(rawBody, req.headers);
    if (!auth.ok) {
      if (auth.status === 500) {
        // 500 : le fournisseur réessaiera une fois le secret configuré.
        console.error(`[ecomfy-pay-webhook] ${connector.id}: ${auth.reason}`);
        return ack({ success: false, error: auth.reason }, 500);
      }
      console.warn("[ecomfy-pay-webhook] Rejected:", auth.reason);
      return ack({ success: false, error: "Unauthorized" }, 401);
    }

    const parsed = connector.parseWebhook(rawBody, req.headers);
    if (parsed.kind === "invalid") {
      return ack({ success: false, error: parsed.error }, parsed.status ?? 200);
    }
    if (parsed.kind === "ignored") {
      return ack({ success: true, ignored: true, event: parsed.eventType });
    }
    const payload = JSON.parse(rawBody);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retraits (payouts) : clôture du retrait et écriture au ledger (finalize_withdrawal, idempotente).
    // Ne passe jamais par la confirmation de paiement ci-dessous.
    if (parsed.kind === "payout") {
      const candidates = parsed.withdrawalCandidates;
      const payoutEventId = parsed.eventId;
      const { error: payoutDupErr } = await supabase.from("payment_events").insert({
        event_id: payoutEventId, provider: connector.id, event_type: parsed.eventType, payload,
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
        p_status: parsed.outcome,
        p_failure_reason: parsed.failureReason,
        p_provider_reference: parsed.providerReference,
      });
      if (finErr) {
        console.error("[ecomfy-pay-webhook] finalize_withdrawal error:", finErr);
        // Sans cela, la nouvelle tentative du prestataire serait écartée comme doublon et le retrait ne serait jamais clôturé.
        await supabase.from("payment_events").delete().eq("provider", connector.id).eq("event_id", payoutEventId);
        return ack({ success: false, error: "Cannot finalize withdrawal" }, 500);
      }
      return ack({ success: !!finRes?.success, ...finRes });
    }

    const isSuccess = parsed.outcome === "SUCCEEDED";
    const internalRef = parsed.internalReference;
    const providerRef = parsed.providerReference;
    const event = parsed.eventType;

    // Confirmation auprès de l'opérateur avant de traiter un succès. Placée avant la transaction :
    // en cas d'échec (503), rien n'est inscrit et la nouvelle tentative du fournisseur est traitée normalement.
    // `remoteAmount` / `remoteCurrency` : montant réellement encaissé, comparé à ecomfy_payments.amount (C6) par confirm_ecomfy_payment.
    let remoteAmount: unknown = undefined;
    let remoteCurrency: unknown = undefined;
    if (isSuccess) {
      if (!connector.isConfigured() || !providerRef) {
        console.error("[ecomfy-pay-webhook] Cannot confirm payment with provider", { provider: connector.id, configured: connector.isConfigured(), providerRef });
        return ack({ success: false, error: "Cannot confirm payment" }, 503);
      }
      const remote = await connector.fetchPayment(providerRef);
      if (remote.kind === "unavailable") {
        console.error("[ecomfy-pay-webhook] Provider confirmation failed:", remote.httpStatus);
        return ack({ success: false, error: "Cannot confirm payment" }, 503);
      }
      if (remote.status !== "SUCCEEDED") {
        console.warn("[ecomfy-pay-webhook] Provider does not confirm success:", { providerRef, remoteStatus: remote.status });
        return ack({ success: false, error: "Payment not confirmed by provider" });
      }
      if (remote.amount === null) {
        // Sans montant encaissé, on ne peut pas comparer : refus avec nouvelle tentative (503), jamais de crédit.
        console.error("[ecomfy-pay-webhook] Provider response has no amount", { providerRef });
        return ack({ success: false, error: "Cannot confirm payment amount" }, 503);
      }
      remoteAmount = remote.amount;
      remoteCurrency = remote.currency;
    }

    // Paiement → commande → crédit du portefeuille : une seule transaction côté base (confirm_ecomfy_payment), verrouillée,
    // idempotente et rejouable. Le montant encaissé est comparé à celui enregistré à l'initialisation (C6) dans la même fonction.
    // L'événement n'est inscrit dans payment_events qu'avec le résultat : une livraison tombée en erreur est rejouée par le
    // prestataire (500 ci-dessous) au lieu d'être écartée comme doublon.
    const eventId = parsed.eventId;
    const { data: res, error: rpcErr } = await supabase.rpc("confirm_ecomfy_payment", {
      p_internal_reference: internalRef || null,
      p_provider_reference: providerRef ? String(providerRef) : null,
      p_outcome: isSuccess ? "SUCCEEDED" : "FAILED",
      p_remote_amount: isSuccess ? Number(remoteAmount) : null,
      p_remote_currency: isSuccess && remoteCurrency ? String(remoteCurrency) : null,
      p_event_id: eventId,
      p_event_type: String(event),
      p_payload: payload,
      p_failure_reason: isSuccess ? null : parsed.failureReason,
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
