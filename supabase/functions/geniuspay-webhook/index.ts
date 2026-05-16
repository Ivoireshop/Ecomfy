import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-webhook-event, x-webhook-environment, x-webhook-delivery",
};

// HMAC-SHA256(timestamp + "." + json_payload) -> hex
async function computeSignature(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Always return 200 with JSON body to acknowledge receipt — GeniusPay won't retry on 4xx repeatedly
  const ack = (body: Record<string, unknown>, log = false) => {
    if (log) console.log("Webhook ack:", body);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const secret = Deno.env.get("GENIUSPAY_WEBHOOK_SECRET");
    if (!secret) {
      console.error("GENIUSPAY_WEBHOOK_SECRET not configured");
      return ack({ success: false, error: "Webhook secret not configured" });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("X-Webhook-Signature") || req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("X-Webhook-Timestamp") || req.headers.get("x-webhook-timestamp") || "";
    const eventHeader = req.headers.get("X-Webhook-Event") || req.headers.get("x-webhook-event") || "";

    if (!signature || !timestamp) {
      console.warn("Missing webhook signature/timestamp headers");
      return ack({ success: false, error: "Missing signature headers" });
    }

    // Replay protection (5 min window)
    const tsNum = parseInt(timestamp, 10);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      console.warn("Webhook timestamp outside tolerance:", timestamp);
      return ack({ success: false, error: "Timestamp out of range" });
    }

    const expected = await computeSignature(secret, `${timestamp}.${rawBody}`);
    if (!timingSafeEqual(expected, signature)) {
      console.warn("Invalid webhook signature", {
        received: signature.slice(0, 12) + "...",
        expected: expected.slice(0, 12) + "...",
      });
      return ack({ success: false, error: "Invalid signature" });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return ack({ success: false, error: "Invalid JSON" });
    }

    const event = payload?.event || eventHeader;
    const data = payload?.data || {};
    const reference: string | undefined = data?.reference;
    const status: string | undefined = data?.status;
    const metadata = data?.metadata || {};
    const amountPaid = Number(data?.amount) || 0;
    const currency: string = (data?.currency || "XOF").toUpperCase();
    const deliveryId =
      req.headers.get("X-Webhook-Delivery") ||
      req.headers.get("x-webhook-delivery") ||
      payload?.id ||
      data?.id ||
      `${reference || "noref"}:${event || "noevt"}:${timestamp}`;

    console.log("GeniusPay webhook:", { event, reference, status, environment: payload?.environment });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ───── IDEMPOTENCE: refuse same (provider, event_id) twice ─────
    try {
      const { error: dupErr } = await supabase.from("webhook_events").insert({
        provider: "geniuspay",
        event_id: String(deliveryId),
        event_type: event,
        reference: reference || null,
        amount: amountPaid,
        currency,
        payload,
      });
      if (dupErr) {
        // 23505 = unique_violation → already processed
        if ((dupErr as any).code === "23505") {
          console.log("Duplicate webhook ignored:", { deliveryId, reference, event });
          return ack({ success: true, duplicate: true, event, reference }, true);
        }
        console.warn("webhook_events insert error (non-blocking):", dupErr);
      }
    } catch (e) {
      console.warn("Idempotence check failed (non-blocking):", e);
    }

    // Always upsert/log the payment record by reference
    if (reference) {
      try {
        const { data: existing } = await supabase
          .from("payments")
          .select("id, status, amount, currency, user_id, metadata")
          .eq("transaction_id", reference)
          .maybeSingle();

        // ───── ANTI-FRAUDE: vérifier la cohérence avec le paiement initial ─────
        if (existing) {
          // 1) Déjà completed → ne pas recréditer
          if (existing.status === "completed") {
            const existingMeta = (existing.metadata || {}) as Record<string, unknown>;
            if (existingMeta.payment_type !== "shop_activation") {
              console.log("Payment already completed, skipping re-credit:", reference);
              return ack({ success: true, alreadyCompleted: true, reference }, true);
            }
          }
          // 2) Montant doit correspondre (tolérance 1 unité pour arrondi)
          if (
            (event === "payment.success" || status === "completed" || status === "success") &&
            existing.amount != null &&
            Math.abs(Number(existing.amount) - amountPaid) > 1
          ) {
            console.error("Amount mismatch — possible fraud:", {
              reference,
              expected: existing.amount,
              received: amountPaid,
            });
            return ack({ success: false, error: "Amount mismatch", reference }, true);
          }
          // 3) Devise doit correspondre
          if (
            existing.currency &&
            existing.currency.toUpperCase() !== currency
          ) {
            console.error("Currency mismatch — possible fraud:", {
              reference,
              expected: existing.currency,
              received: currency,
            });
            return ack({ success: false, error: "Currency mismatch", reference }, true);
          }
          // 4) user_id metadata doit correspondre au paiement initial
          if (
            metadata?.user_id &&
            existing.user_id &&
            existing.user_id !== metadata.user_id
          ) {
            console.error("User mismatch — possible fraud:", {
              reference,
              expected: existing.user_id,
              received: metadata.user_id,
            });
            return ack({ success: false, error: "User mismatch", reference }, true);
          }
        }

        const paymentRow = {
          user_id: metadata.user_id || null,
          payment_method: data?.payment_method || data?.provider || "geniuspay",
          amount: amountPaid,
          currency,
          transaction_id: reference,
          status: event === "payment.success" || status === "completed" || status === "success" ? "completed" :
                  event === "payment.failed" ? "failed" :
                  event === "payment.cancelled" ? "cancelled" :
                  event === "payment.expired" ? "expired" :
                  event === "payment.refunded" ? "refunded" : (status || "pending"),
          metadata,
        };

        if (existing) {
          await supabase.from("payments").update(paymentRow).eq("id", existing.id);
        } else if (paymentRow.user_id) {
          await supabase.from("payments").insert(paymentRow);
        }
      } catch (e) {
        console.error("Failed to upsert payment row:", e);
      }
    }

    // Only credit on success
    if (event !== "payment.success" && status !== "completed" && status !== "success") {
      return ack({ success: true, ignored: true, event, status }, true);
    }

    const userId = metadata?.user_id;
    const paymentType = metadata?.payment_type || "subscription";
    const creditsSize = Number(metadata?.credits_size || 0);
    const promoCodeId = metadata?.promo_code_id;
    const discountPct = Number(metadata?.discount_percentage || 0);

    if (!userId) {
      console.warn("No user_id in metadata, cannot credit user", { reference });
      return ack({ success: true, warning: "no user_id in metadata" });
    }

    if (paymentType === "shop_activation") {
      const shopId = metadata?.shop_id;
      if (!shopId) {
        console.warn("shop_activation without shop_id metadata", { reference });
        return ack({ success: false, error: "missing shop_id", reference }, true);
      }
      const { data: activationResult, error: activationError } = await supabase.rpc("apply_shop_activation", {
        p_shop_id: shopId,
        p_user_id: userId,
        p_amount: amountPaid,
        p_transaction_reference: reference || null,
        p_payment_method: data?.payment_method || data?.provider || "geniuspay",
      });
      if (activationError || activationResult?.success === false) {
        console.error("Shop activation failed", { activationError, activationResult, shopId, userId, reference });
        return ack({ success: false, error: "activation_failed", reference }, true);
      }
      console.log("Shop activated for", userId, activationResult);
    } else if (paymentType === "commission_payment") {
      const shopId = metadata?.shop_id;
      if (shopId) {
        const { data: shopRow } = await supabase
          .from("shops")
          .select("commission_balance_due, commission_threshold")
          .eq("id", shopId)
          .single();
        const currentBalance = Number(shopRow?.commission_balance_due) || 0;
        const threshold = Number(shopRow?.commission_threshold) || 12000;
        const newBalance = Math.max(0, currentBalance - amountPaid);
        const updates: Record<string, unknown> = {
          commission_balance_due: newBalance,
          updated_at: new Date().toISOString(),
        };
        if (newBalance < threshold) {
          updates.payment_deadline = null;
          updates.is_suspended = false;
        }
        await supabase.from("shops").update(updates).eq("id", shopId);
        await supabase.from("commission_payments").insert({
          shop_id: shopId,
          amount: amountPaid,
          payment_method: "geniuspay",
          transaction_reference: reference,
          status: "paid",
          created_by: userId,
          notes: "Paiement en ligne via GeniusPay",
        });
        console.log(`Commission paid ${amountPaid} for shop ${shopId}, new balance ${newBalance}`);
      } else {
        console.warn("commission_payment without shop_id metadata", { reference });
      }
    } else if (paymentType === "credits" && creditsSize > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("purchased_credits, has_showcase_access")
        .eq("id", userId)
        .single();

      const newTotal = (profile?.purchased_credits || 0) + creditsSize;
      const enableShowcase = creditsSize >= 50 || profile?.has_showcase_access;

      await supabase.from("profiles").update({
        purchased_credits: newTotal,
        has_showcase_access: enableShowcase,
      }).eq("id", userId);

      await supabase.from("credit_purchases").insert({
        user_id: userId,
        pack_size: creditsSize,
        pack_price: amountPaid,
        credits_added: creditsSize,
      });
      console.log(`Credited ${creditsSize} credits to`, userId, "total:", newTotal);
    } else {
      // Subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      await supabase.from("subscriptions").update({
        status: "active",
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      // Send confirmation email
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .single();
        if (profile?.email) {
          await supabase.functions.invoke("send-subscription-email", {
            body: {
              email: profile.email,
              full_name: profile.full_name || "Cher utilisateur",
              amount: amountPaid,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            },
          });
        }
      } catch (e) {
        console.warn("Could not send subscription email:", e);
      }
      console.log("Subscription activated for", userId);
    }

    // Increment promo usage
    if (promoCodeId) {
      try {
        const { data: promo } = await supabase
          .from("promo_codes")
          .select("code")
          .eq("id", promoCodeId)
          .single();
        if (promo?.code) {
          await supabase.rpc("increment_promo_usage", { promo_code: promo.code });
        }
      } catch (e) {
        console.warn("Promo increment failed:", e);
      }
    }

    return ack({ success: true, event, reference }, true);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});