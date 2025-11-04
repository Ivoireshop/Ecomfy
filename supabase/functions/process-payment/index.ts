import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  amount: number;
  payment_method: string;
  user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, payment_method, user_id }: PaymentRequest = await req.json();
    
    console.log("Processing payment:", { amount, payment_method, user_id });

    // Récupérer la clé API Lygos
    const LYGOS_API_KEY = Deno.env.get("LYGOS_API_KEY");
    
    if (!LYGOS_API_KEY) {
      console.log("LYGOS_API_KEY not configured yet - returning test response");
      
      // Pour les tests avant la configuration de l'API
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Le système de paiement n'est pas encore configuré. Veuillez ajouter la clé API Lygos."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // TODO: Intégrer l'API Lygos ici
    // Une fois que vous aurez la clé API et la documentation Lygos,
    // nous configurerons l'appel API exact
    
    // Exemple de structure (à adapter selon l'API Lygos):
    const paymentResponse = await fetch("LYGOS_API_ENDPOINT", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LYGOS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        payment_method: payment_method,
        currency: "XOF", // Franc CFA
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-callback`,
        metadata: {
          user_id: user_id,
        }
      }),
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Lygos API error:", paymentResponse.status, errorText);
      throw new Error("Erreur lors de l'initialisation du paiement");
    }

    const paymentData = await paymentResponse.json();
    
    // Retourner l'URL de paiement ou le statut
    return new Response(
      JSON.stringify({ 
        success: true,
        payment_url: paymentData.payment_url || paymentData.checkout_url,
        transaction_id: paymentData.transaction_id || paymentData.id,
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