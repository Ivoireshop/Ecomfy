import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      shop_id,
      product_id,
      payment_link_id,
      amount,
      currency = "XOF",
      payment_method,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_city,
      order_id,
    } = body;

    if (!shop_id || !amount || amount <= 0 || !payment_method) {
      return new Response(
        JSON.stringify({ success: false, error: "Informations de paiement incomplètes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer la boutique et son propriétaire (merchant)
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, user_id, business_name, country")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ success: false, error: "Boutique introuvable." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantId = shop.user_id;

    // Calcul des frais (par exemple 2.5% de frais Ecomfy)
    const feeRate = 0.025;
    const feeEcomfy = Math.round(amount * feeRate);
    const feeProvider = 0; // Calculable selon le provider
    const netMerchantAmount = amount - feeEcomfy - feeProvider;

    // Générer référence interne unique ECM-PAY-XXXXXXXX
    const internalReference = `ECM-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Insérer la transaction initiale en statut CREATED / PENDING
    const { data: paymentRecord, error: insertError } = await supabase
      .from("ecomfy_payments")
      .insert({
        internal_reference: internalReference,
        order_id: order_id || null,
        merchant_id: merchantId,
        shop_id: shop_id,
        product_id: product_id || null,
        payment_link_id: payment_link_id || null,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        provider: "geniuspay",
        payment_method: payment_method,
        amount: amount,
        currency: currency,
        fee_provider: feeProvider,
        fee_ecomfy: feeEcomfy,
        net_merchant_amount: netMerchantAmount,
        status: "PENDING",
        metadata: {
          customer_address,
          customer_city,
          created_via: "ecomfy_pay_checkout",
        },
      })
      .select("*")
      .single();

    if (insertError || !paymentRecord) {
      console.error("[ecomfy-pay-initiate] Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Impossible d'initialiser le paiement." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Appel au provider de paiement (ex: GeniusPay API)
    const GENIUSPAY_API_KEY = Deno.env.get("GENIUSPAY_API_KEY");
    const GENIUSPAY_API_SECRET = Deno.env.get("GENIUSPAY_API_SECRET");

    if (!GENIUSPAY_API_KEY || !GENIUSPAY_API_SECRET) {
      // Fallback mode démo / direct pour environnement sans clés externes renseignées
      return new Response(
        JSON.stringify({
          success: true,
          internal_reference: internalReference,
          payment_id: paymentRecord.id,
          checkout_url: null,
          message: "Paiement initialisé avec succès.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin") || "https://ecomfy.cloud";

    const payload = {
      amount,
      currency,
      description: `Paiement Ecomfy Pay — ${shop.business_name}`,
      customer: {
        name: customer_name || "Client",
        phone: customer_phone || undefined,
        email: customer_email || undefined,
      },
      metadata: {
        internal_reference: internalReference,
        payment_id: paymentRecord.id,
        merchant_id: merchantId,
        shop_id: shop_id,
        type: "ecomfy_pay_customer_order",
      },
      success_url: `${origin}/order-confirmed?payment_ref=${internalReference}`,
      error_url: `${origin}/shop/${shop_id}?payment_failed=true`,
    };

    const resp = await fetch("https://pay.genius.ci/api/v1/merchant/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GENIUSPAY_API_KEY,
        "X-API-Secret": GENIUSPAY_API_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));

    if (resp.ok && json.data?.checkout_url) {
      // Mettre à jour la référence du provider
      await supabase
        .from("ecomfy_payments")
        .update({
          provider_reference: json.data.reference || json.data.id,
        })
        .eq("id", paymentRecord.id);

      return new Response(
        JSON.stringify({
          success: true,
          internal_reference: internalReference,
          payment_id: paymentRecord.id,
          checkout_url: json.data.checkout_url || json.data.payment_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        internal_reference: internalReference,
        payment_id: paymentRecord.id,
        checkout_url: json?.checkout_url || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[ecomfy-pay-initiate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
