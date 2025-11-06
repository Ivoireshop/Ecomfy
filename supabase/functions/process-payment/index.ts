import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod validation schema
const PaymentSchema = z.object({
  amount: z.number().refine(val => val === 10000, {
    message: "Le montant doit être exactement 10000 FCFA pour l'abonnement Premium"
  }),
  payment_method: z.enum(["mobile_money", "card", "bank_card"], {
    errorMap: () => ({ message: "Méthode de paiement invalide. Utilisez 'mobile_money' ou 'card'" })
  }),
  user_id: z.string().uuid({
    message: "ID utilisateur invalide"
  }),
  provider: z.string().optional(),
  phone: z.string().optional(),
  promo_code: z.string().optional()
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      const payload = JSON.parse(atob(token.split(".")[1]));
      authUserId = payload?.sub;
      
      if (!authUserId) {
        throw new Error("Invalid token payload");
      }
    } catch (e) {
      console.error("JWT parsing error:", e);
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

    const { amount, payment_method, user_id, provider, phone, promo_code } = validatedData;

    // Initialize Supabase client for promo code validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Normalize provider and phone for Lygos compatibility
    const mapProvider = (p?: string) => {
      if (!p) return undefined;
      const val = p.toLowerCase().trim();
      if (val === "move") return "moov"; // common typo
      return val; // accepted: wave, orange, mtn, moov
    };
    const normalizePhone = (ph?: string) => {
      if (!ph) return undefined;
      let v = ph.trim().replace(/[^\d+]/g, "");
      if (v.startsWith("+")) return v;
      if (v.startsWith("225")) return `+${v}`; // CI format without plus
      if (v.length === 10 && v.startsWith("0")) return `+225${v.slice(1)}`; // default to CI if local format
      return v;
    };
    const maskPhone = (p?: string) => {
      if (!p) return undefined;
      return p.length > 6 ? `${p.slice(0, 4)}****${p.slice(-2)}` : p;
    };

    const normalizedProvider = mapProvider(provider);
    const normalizedPhone = normalizePhone(phone);
    const phoneMasked = maskPhone(normalizedPhone);

    console.log("Processing payment:", { amount, payment_method, user_id, provider: normalizedProvider, phone: phoneMasked });

    const LYGOS_API_KEY = Deno.env.get("LYGOS_API_KEY");
    
    if (!LYGOS_API_KEY) {
      console.error("LYGOS_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Le système de paiement n'est pas configuré. Veuillez contacter l'administrateur."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const origin = req.headers.get("origin") || undefined;
    const referer = req.headers.get("referer") || undefined;
    const baseReturnUrl = origin || (referer ? new URL(referer).origin : undefined);
    const orderId = `sub_${user_id}_${Date.now()}`;

    console.log("Calling Lygos API:", {
      amount,
      payment_method,
      user_id,
      provider: normalizedProvider,
      phone: phoneMasked,
      currency: "XOF",
      country: "CI",
      shop_name: "Visuel Pro",
      order_id: orderId
    });

    // Build payload base (callback URLs will be attached after method/provider resolution)
    const basePayload = {
      amount: finalAmount,
      currency: "XOF",
      country: "CI",
      shop_name: "Visuel Pro",
      message: "Abonnement Visuel Pro - Plan Premium",
      user_id,
      order_id: orderId,
    } as Record<string, unknown>;

    let payload: Record<string, unknown> = { ...basePayload };
    const methodLower = (payment_method || '').toLowerCase();
    if (methodLower === 'card' || methodLower === 'bank_card') {
      payload.payment_method = 'card';
      // Do not include phone/provider for card payments
    } else {
      payload.payment_method = 'mobile_money';
      if (normalizedProvider) {
        payload.provider = normalizedProvider;
        payload.operator = normalizedProvider;
      }
      if (normalizedPhone && normalizedProvider !== 'wave') {
        payload.phone = normalizedPhone;
      }
    }

    // Attach callback URLs including return_url and metadata for recording
    const successParams = new URLSearchParams({
      status: 'success',
      user_id,
      amount: String(finalAmount),
      original_amount: String(amount),
      transaction_id: orderId,
      payment_method: String((payload as any).payment_method || ''),
      provider: String((payload as any).provider || ''),
      return_url: baseReturnUrl || '',
      ...(promoCodeId && { promo_code_id: promoCodeId }),
      ...(discountPercentage && { discount_percentage: String(discountPercentage) })
    });
    const failureParams = new URLSearchParams({
      status: 'failure',
      user_id,
      payment_method: String((payload as any).payment_method || ''),
      provider: String((payload as any).provider || ''),
      return_url: baseReturnUrl || ''
    });

    (payload as any).success_url = `${supabaseUrl}/functions/v1/payment-callback?${successParams.toString()}`;
    (payload as any).failure_url = `${supabaseUrl}/functions/v1/payment-callback?${failureParams.toString()}`;

    console.log('Gateway payload (sanitized):', { ...payload, phone: phoneMasked });

    const paymentResponse = await fetch("https://api.lygosapp.com/v1/gateway", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": LYGOS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!paymentResponse.ok) {
      let errDetail = '';
      try {
        const errJson = await paymentResponse.json();
        errDetail = errJson?.message || errJson?.error || JSON.stringify(errJson);
      } catch (_) {
        errDetail = await paymentResponse.text();
      }
      console.error("Lygos API error:", paymentResponse.status, errDetail);
      throw new Error(`Erreur Lygos: ${errDetail || paymentResponse.status}`);
    }

    const paymentData = await paymentResponse.json();
    console.log("Lygos API response:", paymentData);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        payment_url: paymentData.payment_url || paymentData.url || paymentData.checkout_url || paymentData.link,
        transaction_id: paymentData.transaction_id || paymentData.order_id || paymentData.id || orderId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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