import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to verify HMAC signature
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert hex signature to Uint8Array
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payload)
    );

    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const webhookSecret = Deno.env.get("LYGOS_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("LYGOS_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lygos peut envoyer les données via query params ou body JSON
    let paymentData: any;
    let payloadString: string;

    if (req.method === "POST") {
      // Get raw body text for signature verification
      const bodyText = await req.text();
      payloadString = bodyText;
      
      try {
        paymentData = JSON.parse(bodyText);
      } catch (e) {
        console.error("Invalid JSON in webhook body");
        return new Response(
          JSON.stringify({ error: "Invalid JSON" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify webhook signature for POST requests
      const signature = req.headers.get("X-Lygos-Signature") || req.headers.get("x-lygos-signature");
      
      if (!signature) {
        console.warn("Webhook received without signature");
        return new Response(
          JSON.stringify({ error: "Missing webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValid = await verifyWebhookSignature(payloadString, signature, webhookSecret);
      
      if (!isValid) {
        console.warn("Invalid webhook signature detected", {
          receivedSignature: signature.substring(0, 10) + "...",
          payloadLength: payloadString.length
        });
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Webhook signature verified successfully");
    } else if (req.method === "GET") {
      // For GET requests (redirect callbacks), construct payload from query params
      paymentData = {
        status: url.searchParams.get("status"),
        user_id: url.searchParams.get("user_id"),
        amount: url.searchParams.get("amount"),
        transaction_id: url.searchParams.get("transaction_id"),
        payment_method: url.searchParams.get("payment_method"),
        provider: url.searchParams.get("provider"),
        return_url: url.searchParams.get("return_url"),
        promo_code_id: url.searchParams.get("promo_code_id"),
        discount_percentage: url.searchParams.get("discount_percentage"),
        payment_type: url.searchParams.get("payment_type"),
        credits_size: url.searchParams.get("credits_size"),
      };
      
      // Note: GET redirects from Lygos are user-facing and don't need signature verification
      // as they're not trusted for payment confirmation - only POST webhooks update the database
      console.log("GET redirect received (user-facing, no signature required)");
    }

    console.log("Payment callback received:", {
      method: req.method,
      status: paymentData.status,
      user_id: paymentData.user_id,
      amount: paymentData.amount
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      status, 
      user_id, 
      amount, 
      transaction_id, 
      payment_method, 
      provider, 
      return_url,
      promo_code_id,
      discount_percentage,
      payment_type,
      credits_size 
    } = paymentData;

    if (status === "success" || status === "completed") {
      const isCreditsPayment = payment_type === 'credits';
      const creditsAmount = credits_size ? parseInt(credits_size) : 0;
      
      if (isCreditsPayment && creditsAmount > 0) {
        // Handle credits purchase
        console.log(`Processing credits purchase: ${creditsAmount} credits for user ${user_id}`);
        
        // Add credits to user profile
        const { data: currentProfile, error: profileError } = await supabase
          .from("profiles")
          .select("purchased_credits, has_showcase_access")
          .eq("id", user_id)
          .single();
        
        if (profileError) {
          console.error("Error fetching profile:", profileError);
          throw profileError;
        }
        
        const newCreditsTotal = (currentProfile?.purchased_credits || 0) + creditsAmount;
        const shouldEnableShowcase = creditsAmount >= 50 || currentProfile?.has_showcase_access;
        
        const { error: updateProfileError } = await supabase
          .from("profiles")
          .update({
            purchased_credits: newCreditsTotal,
            has_showcase_access: shouldEnableShowcase,
          })
          .eq("id", user_id);
        
        if (updateProfileError) {
          console.error("Error updating profile credits:", updateProfileError);
          throw updateProfileError;
        }
        
        console.log(`Credits added: ${creditsAmount} (total: ${newCreditsTotal}), showcase access: ${shouldEnableShowcase}`);
        
        // Record credit purchase
        const { error: creditPurchaseError } = await supabase
          .from("credit_purchases")
          .insert({
            user_id: user_id,
            pack_size: creditsAmount,
            pack_price: parseFloat(amount),
            credits_added: creditsAmount,
          });
        
        if (creditPurchaseError) {
          console.error("Error recording credit purchase:", creditPurchaseError);
        }
      } else {
        // Handle subscription payment
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user_id);

        if (updateError) {
          console.error("Error updating subscription:", updateError);
          throw updateError;
        }

        console.log("Subscription activated for user:", user_id);
      }

      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user_id,
          payment_method: payment_method || "mobile_money",
          amount: parseFloat(amount),
          currency: "XOF",
          provider: provider || null,
          transaction_id: transaction_id,
          status: "completed",
          metadata: promo_code_id ? {
            promo_code_id,
            discount_percentage: discount_percentage ? parseInt(discount_percentage) : 0
          } : null
        });

      if (paymentError) {
        console.error("Error recording payment:", paymentError);
      }

      // Increment promo code usage if a promo code was used
      if (promo_code_id) {
        try {
          // Get the promo code to increment
          const { data: promoCode } = await supabase
            .from("promo_codes")
            .select("code")
            .eq("id", promo_code_id)
            .single();

          if (promoCode) {
            const { error: incrementError } = await supabase
              .rpc("increment_promo_usage", { promo_code: promoCode.code });

            if (incrementError) {
              console.error("Error incrementing promo code usage:", incrementError);
            } else {
              console.log("Promo code usage incremented:", promoCode.code);
            }
          }
        } catch (promoError) {
          console.error("Error processing promo code increment:", promoError);
          // Don't fail the payment if promo increment fails
        }
      }

      // Envoyer l'email de confirmation uniquement pour les abonnements
      if (!isCreditsPayment) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", user_id)
          .single();

        if (profile?.email) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          supabase.functions.invoke("send-subscription-email", {
            body: {
              email: profile.email,
              full_name: profile.full_name || "Cher utilisateur",
              amount: parseFloat(amount),
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            },
          }).then((result) => {
            if (result.error) {
              console.error("Error sending confirmation email:", result.error);
            } else {
              console.log("Confirmation email sent successfully");
            }
          }).catch((err) => {
            console.error("Failed to invoke email function:", err);
          });
        }
      }

      // Rediriger l'utilisateur vers la page de succès
      const explicitReturn = return_url || url.searchParams.get("return_url") || null;
      const originHeader = req.headers.get("origin");
      const refererHeader = req.headers.get("referer");
      const computedOrigin = originHeader || (refererHeader ? new URL(refererHeader).origin : "");
      const finalReturnUrl = explicitReturn || computedOrigin || "";
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${finalReturnUrl || "/"}/?payment=success`,
        },
      });
    } else {
      
      // Rediriger vers la page d'échec
      const explicitReturn = return_url || url.searchParams.get("return_url") || null;
      const originHeader = req.headers.get("origin");
      const refererHeader = req.headers.get("referer");
      const computedOrigin = originHeader || (refererHeader ? new URL(refererHeader).origin : "");
      const finalReturnUrl = explicitReturn || computedOrigin || "";
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${finalReturnUrl || "/"}/?payment=failed`,
        },
      });
    }

  } catch (error) {
    console.error("Error in payment-callback function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Une erreur est survenue" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});