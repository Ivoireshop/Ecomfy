import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod validation schema
const PaymentSchema = z.object({
  amount: z.number(),
  // GeniusPay : si on omet le payment_method, le client choisit sur la page checkout (recommandé)
  payment_method: z.string().optional(),
  user_id: z.string().uuid({
    message: "ID utilisateur invalide"
  }),
  provider: z.string().optional(),
  phone: z.string().optional(),
  promo_code: z.string().optional(),
  payment_type: z.enum(["subscription", "credits", "shop_activation", "commission_payment", "shop_subscription"]).default("subscription"),
  shop_id: z.string().uuid().optional(),
  plan: z.enum(["starter", "business", "premium"]).optional(),
  credits_pack: z.object({
    size: z.number(),
    price: z.number()
  }).optional()
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract and verify authenticated user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Non autorisé. Veuillez vous connecter." 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    let authUserId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user?.id) throw userError || new Error("Invalid token");
      authUserId = userData.user.id;
    } catch (e) {
      console.error("JWT verification error:", e);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Token d'authentification invalide" 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Parse and validate request body
    const requestBody = await req.json();
    
    let validatedData;
    try {
      validatedData = PaymentSchema.parse(requestBody);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error("Validation error:", e.errors);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Données de paiement invalides",
            details: e.errors.map(err => ({
              field: err.path.join("."),
              message: err.message
            }))
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      throw e;
    }

    // Verify authenticated user matches the user_id in payment request
    if (authUserId !== validatedData.user_id) {
      console.warn("User ID mismatch:", { authUserId, requestUserId: validatedData.user_id });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Vous ne pouvez initier un paiement que pour votre propre compte" 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { amount, payment_method, user_id, provider, phone, promo_code, payment_type, credits_pack, shop_id, plan } = validatedData;

    if (payment_type === "shop_subscription") {
      if (!shop_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Sélectionnez la boutique à abonner." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!plan) {
        return new Response(
          JSON.stringify({ success: false, error: "Plan d'abonnement manquant." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Verify ownership
      const { data: ownedShop } = await supabase
        .from("shops").select("id").eq("id", shop_id).eq("user_id", user_id).maybeSingle();
      if (!ownedShop) {
        return new Response(
          JSON.stringify({ success: false, error: "Boutique introuvable pour ce compte." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (payment_type === "shop_activation") {
      if (!shop_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Sélectionnez la boutique à activer." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: activationGate, error: activationGateError } = await supabase.rpc(
        "prepare_shop_activation_payment",
        {
          p_shop_id: shop_id,
          p_user_id: user_id,
        },
      );

      if (activationGateError) {
        console.error("Activation payment gate failed:", activationGateError);
        return new Response(
          JSON.stringify({ success: false, error: "Vérification d'activation impossible. Réessayez." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!activationGate?.success) {
        return new Response(
          JSON.stringify({ success: false, error: activationGate?.error || "Boutique introuvable pour ce compte." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (activationGate.should_charge === false) {
        console.log("GeniusPay charge blocked for shop activation:", {
          shop_id,
          user_id,
          already_activated: activationGate.already_activated,
          already_paid: activationGate.already_paid,
        });
        // Notification email (best-effort) : informer l'utilisateur qu'aucun nouveau prélèvement n'a été fait
        try {
          const { data: shopRow } = await supabase
            .from("shops")
            .select("name, slug")
            .eq("id", shop_id)
            .maybeSingle();
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", user_id)
            .maybeSingle();
          if (profileRow?.email) {
            const shopUrl = shopRow?.slug
              ? `https://visuelpro.cloud/shop/${shopRow.slug}`
              : undefined;
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "shop-activation",
                recipientEmail: profileRow.email,
                idempotencyKey: `shop-activation-blocked-${shop_id}-${Date.now().toString().slice(0, -4)}`,
                templateData: {
                  mode: "already_activated",
                  shopName: shopRow?.name || "votre boutique",
                  shopUrl,
                },
              },
            });
          }
        } catch (e) {
          console.warn("shop-activation already_activated email failed:", e);
        }
        return new Response(
          JSON.stringify({
            success: true,
            already_activated: true,
            already_paid: !!activationGate.already_paid,
            applied: !!activationGate.applied,
            shop_id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate and apply promo code if provided
    let finalAmount: number = amount;
    let discountPercentage = 0;
    let promoCodeId: string | null = null;

    if (promo_code) {
      console.log("Validating promo code:", promo_code);
      
      const { data: promoValidation, error: promoError } = await supabase
        .rpc('validate_promo_code', { promo_code });

      if (promoError) {
        console.error("Promo code validation error:", promoError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Erreur lors de la validation du code promo" 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      if (!promoValidation || promoValidation.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Code promo invalide" 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      const validationResult = promoValidation[0];
      if (!validationResult.is_valid) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: validationResult.message 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Apply discount
      promoCodeId = validationResult.id;
      discountPercentage = validationResult.discount_percentage;
      finalAmount = Math.round(amount * (1 - discountPercentage / 100));
      
      console.log("Promo code applied:", { 
        code: promo_code, 
        discount: discountPercentage, 
        originalAmount: amount,
        finalAmount 
      });
    }

    // === GeniusPay integration ===
    const GENIUSPAY_API_KEY = Deno.env.get("GENIUSPAY_API_KEY");
    const GENIUSPAY_API_SECRET = Deno.env.get("GENIUSPAY_API_SECRET");

    if (!GENIUSPAY_API_KEY || !GENIUSPAY_API_SECRET) {
      console.error("GeniusPay credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "La passerelle de paiement n'est pas configurée. Contactez l'administrateur."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseReturnUrl = "https://visuelpro.cloud";
    const typePrefix = payment_type === 'credits' ? 'credits'
      : payment_type === 'shop_activation' ? 'shop'
      : payment_type === 'commission_payment' ? 'commission'
      : payment_type === 'shop_subscription' ? 'shopsub'
      : 'sub';
    const orderId = `${typePrefix}_${user_id}_${Date.now()}`;

    const description = payment_type === 'shop_activation'
      ? "Activation Boutique E-commerce - Visuel Pro"
      : payment_type === 'commission_payment'
        ? "Règlement commission VisualPro"
        : payment_type === 'shop_subscription'
          ? `Abonnement Boutique ${plan === 'business' ? 'Business' : plan === 'premium' ? 'Premium' : 'Starter'} - Visuel Pro`
          : payment_type === 'credits' && credits_pack
            ? `Achat de ${credits_pack.size} crédits - Visuel Pro`
            : "Abonnement Visuel Pro";

    // Fetch user profile (name, email, phone) for the customer object
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user_id)
      .single();

    const customer: Record<string, string> = {};
    if (userProfile?.full_name) customer.name = userProfile.full_name;
    if (userProfile?.email) customer.email = userProfile.email;
    const customerPhone = phone || userProfile?.phone;
    if (customerPhone) {
      let v = String(customerPhone).trim().replace(/[^\d+]/g, "");
      if (!v.startsWith("+")) {
        if (v.startsWith("225")) v = `+${v}`;
        else if (v.length === 10 && v.startsWith("0")) v = `+225${v.slice(1)}`;
        else v = `+225${v}`;
      }
      customer.phone = v;
    }

    // Metadata embedded in the payment for the webhook to credit the user
    const metadata: Record<string, unknown> = {
      user_id,
      order_id: orderId,
      payment_type,
      original_amount: amount,
    };
    if (credits_pack?.size) metadata.credits_size = credits_pack.size;
    if (shop_id) metadata.shop_id = shop_id;
    if (plan) metadata.plan = plan;
    if (promoCodeId) metadata.promo_code_id = promoCodeId;
    if (discountPercentage) metadata.discount_percentage = discountPercentage;

    let pendingPaymentId: string | null = null;
    const { data: pendingPayment, error: pendingPaymentError } = await supabase.from("payments").insert({
      user_id,
      payment_method: "geniuspay",
      amount: finalAmount,
      currency: "XOF",
      transaction_id: orderId,
      status: "pending",
      metadata,
    }).select("id").maybeSingle();

    if (pendingPaymentError || !pendingPayment?.id) {
      console.error("Could not initialize local payment before GeniusPay:", pendingPaymentError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Paiement non initialisé. Aucun prélèvement n'a été lancé, veuillez réessayer."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    pendingPaymentId = pendingPayment.id;

    // Hosted checkout (no payment_method) -> client picks Wave/Orange/MTN/Moov/Card
    const geniusPayload: Record<string, unknown> = {
      amount: finalAmount,
      currency: "XOF",
      description,
      customer,
      metadata,
      success_url: payment_type === "shop_activation" && shop_id
        ? `${baseReturnUrl}/payment-success?ref=${orderId}&shop_id=${shop_id}&type=shop_activation`
        : payment_type === "shop_subscription" && shop_id
          ? `${baseReturnUrl}/payment-success?ref=${orderId}&shop_id=${shop_id}&type=shop_subscription`
          : `${baseReturnUrl}/payment-success?ref=${orderId}`,
      error_url: `${baseReturnUrl}/subscription?payment=failed`,
    };

    console.log("Calling GeniusPay:", { ...geniusPayload, customer: { ...customer, phone: customer.phone ? `${customer.phone.slice(0, 4)}****` : undefined } });

    let paymentData: any = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const resp = await fetch("https://pay.genius.ci/api/v1/merchant/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": GENIUSPAY_API_KEY,
          "X-API-Secret": GENIUSPAY_API_SECRET,
        },
        body: JSON.stringify(geniusPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        const errMsg = json?.error?.message || json?.message || `HTTP ${resp.status}`;
        console.error("GeniusPay API error:", resp.status, json);
        await supabase.from("payments").update({
          status: "failed",
          metadata: { ...metadata, gateway_error: errMsg },
        }).eq("id", pendingPaymentId);
        return new Response(
          JSON.stringify({ success: false, error: `Erreur passerelle de paiement: ${errMsg}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      paymentData = json.data || json;
      console.log("GeniusPay response:", { reference: paymentData?.reference, status: paymentData?.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("GeniusPay request failed:", msg);
      await supabase.from("payments").update({
        status: "failed",
        metadata: { ...metadata, gateway_error: msg },
      }).eq("id", pendingPaymentId);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Le service de paiement est temporairement indisponible. Veuillez réessayer."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gatewayReference = paymentData.reference || orderId;
    const { error: paymentUpdateError } = await supabase.from("payments").update({
      transaction_id: gatewayReference,
      metadata: { ...metadata, order_id: orderId, gateway_reference: gatewayReference },
    }).eq("id", pendingPaymentId);
    if (paymentUpdateError) {
      console.warn("Could not attach GeniusPay reference to pending payment:", paymentUpdateError);
    }

    // Send notification email to founders if promo code was used
    if (promo_code && promoCodeId) {
      try {
        if (userProfile) {
          await supabase.functions.invoke('send-promo-notification', {
            body: {
              userName: userProfile.full_name || 'Utilisateur',
              userEmail: userProfile.email || '',
              promoCode: promo_code,
              discountPercentage,
              originalAmount: amount,
              discountedAmount: finalAmount
            }
          });
          console.log('Promo notification sent to founders');
        }
      } catch (notifError) {
        console.error('Error sending promo notification:', notifError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentData.checkout_url || paymentData.payment_url,
        checkout_url: paymentData.checkout_url || paymentData.payment_url,
        transaction_id: gatewayReference,
        reference: gatewayReference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-payment function:", error);
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