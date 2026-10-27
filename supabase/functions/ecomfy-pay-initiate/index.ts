import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getDefaultConnector } from "../_shared/operators/index.ts";
import { checkCustomerPayment, orderExpectedTotal } from "../_shared/pricing.ts";

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
      amount: requestedAmount,
      currency = "XOF",
      payment_method,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_city,
      order_id,
    } = body;

    if (!shop_id || typeof requestedAmount !== "number" || !(requestedAmount > 0) || !payment_method) {
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

    // C6 : le montant est celui de la commande ou du lien de paiement lus en base, pas celui du navigateur.
    const { data: order } = order_id
      ? await supabase.from("orders").select("shop_id, total, payment_status").eq("id", order_id).maybeSingle()
      : { data: null };
    // Total de la commande recalculé depuis les lignes et les prix produits (lots compris), indépendant du total stocké.
    let expected: number | null = null;
    if (order) {
      const { data: items } = await supabase.from("order_items").select("product_id, quantity, bundle_index").eq("order_id", order_id);
      const productIds = [...new Set((items || []).map((i: any) => i.product_id))];
      const { data: prods } = productIds.length
        ? await supabase.from("products").select("id, shop_id, price, bundle_offers").in("id", productIds)
        : { data: [] };
      const byId: Record<string, any> = {};
      for (const p of prods || []) byId[p.id] = p;
      const t = orderExpectedTotal(shop_id, items || [], byId);
      expected = t.ok ? t.total : null;
    }
    const { data: link } = !order_id && payment_link_id
      ? await supabase.from("ecomfy_payment_links").select("shop_id, amount, is_active, allow_custom_amount").eq("id", payment_link_id).maybeSingle()
      : { data: null };

    const check = checkCustomerPayment({
      amount: requestedAmount,
      shopId: shop_id,
      order,
      orderExpected: expected,
      link,
      orderId: order_id,
      paymentLinkId: payment_link_id,
    });
    if (!check.ok) {
      console.warn("[ecomfy-pay-initiate] Amount rejected (C6):", { shop_id, order_id, payment_link_id, requestedAmount, error: check.error });
      return new Response(
        JSON.stringify({ success: false, error: check.error }),
        { status: check.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const amount = check.amount;

    // Calcul des frais (par exemple 2.5% de frais Ecomfy)
    const feeRate = 0.025;
    const feeEcomfy = Math.round(amount * feeRate);
    const feeProvider = 0; // Calculable selon le provider
    const netMerchantAmount = amount - feeEcomfy - feeProvider;

    const connector = getDefaultConnector();

    // Générer référence interne unique ECM-PAY-XXXXXXXX
    const internalReference = `ECM-PAY-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

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
        provider: connector.id,
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

    if (!connector.isConfigured()) {
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

    const result = await connector.initiatePayment({
      internalReference,
      paymentId: paymentRecord.id,
      merchantId,
      shopId: shop_id,
      amount,
      currency,
      paymentMethod: payment_method,
      description: `Paiement Ecomfy Pay — ${shop.business_name}`,
      customer: { name: customer_name, phone: customer_phone, email: customer_email },
      successUrl: `${origin}/order-confirmed?payment_ref=${internalReference}`,
      errorUrl: `${origin}/shop/${shop_id}?payment_failed=true`,
    });

    if (result.ok) {
      if (result.providerReference) {
        // Mettre à jour la référence du provider
        await supabase
          .from("ecomfy_payments")
          .update({ provider_reference: result.providerReference })
          .eq("id", paymentRecord.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          internal_reference: internalReference,
          payment_id: paymentRecord.id,
          checkout_url: result.checkoutUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Le prestataire n'a pas fourni de lien de paiement : ne pas annoncer un succès (le client croirait sa commande payée).
    console.error("[ecomfy-pay-initiate] Provider did not return a checkout URL:", connector.id, result.httpStatus, result.reason);
    await supabase.from("ecomfy_payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", paymentRecord.id);
    if (order_id) {
      // Commande en paiement en ligne jamais payable : l'annuler évite une commande fantôme chez le marchand.
      await supabase.from("orders").update({ order_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order_id).not("payment_status", "in", "(paid,PAID)");
    }
    return new Response(
      JSON.stringify({ success: false, error: "Le service de paiement est momentanément indisponible. Réessayez dans un instant." }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[ecomfy-pay-initiate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
