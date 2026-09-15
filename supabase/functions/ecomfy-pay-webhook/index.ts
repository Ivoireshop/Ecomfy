import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ack = (body: Record<string, unknown>) => {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json().catch(() => ({}));
    const event = payload?.event || "payment.success";
    const data = payload?.data || payload;
    const meta = data?.metadata || {};

    const internalRef = meta?.internal_reference || data?.internal_reference;
    const providerRef = data?.reference || data?.id;

    if (!internalRef && !providerRef) {
      return ack({ success: false, error: "Missing transaction reference" });
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
