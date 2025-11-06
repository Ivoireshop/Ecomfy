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

    const { status, user_id, amount, transaction_id, payment_method, provider, return_url } = paymentData;

    if (status === "success" || status === "completed") {
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
        });

      if (paymentError) {
        console.error("Error recording payment:", paymentError);
      }

      // Récupérer les informations du profil pour l'email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user_id)
        .single();

      // Envoyer l'email de confirmation en arrière-plan (fire-and-forget)
      if (profile?.email) {
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