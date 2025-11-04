import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  amount: number;
  payment_method: string;
  user_id: string;
  provider?: string;
  phone?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, payment_method, user_id, provider, phone }: PaymentRequest = await req.json();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
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

    const paymentResponse = await fetch("https://api.lygosapp.com/v1/gateway", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": LYGOS_API_KEY,
      },
      body: JSON.stringify({
        amount,
        currency: "XOF",
        country: "CI",
        shop_name: "Visuel Pro",
        message: "Abonnement Visuel Pro - Plan Premium",
        payment_method,
        user_id,
        provider: normalizedProvider,
        operator: normalizedProvider,
        phone: normalizedPhone,
        success_url: `${supabaseUrl}/functions/v1/payment-callback?status=success&user_id=${user_id}&amount=${amount}&transaction_id=${orderId}`,
        failure_url: `${supabaseUrl}/functions/v1/payment-callback?status=failure&user_id=${user_id}`,
        order_id: orderId,
      }),
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Lygos API error:", paymentResponse.status, errorText);
      throw new Error("Erreur lors de l'initialisation du paiement avec Lygos");
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