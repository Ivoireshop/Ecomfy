import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Lygos peut envoyer les données via query params ou body JSON
    const url = new URL(req.url);
    let paymentData: any;

    if (req.method === "POST") {
      paymentData = await req.json();
    } else if (req.method === "GET") {
      // Extraire les paramètres de l'URL
      paymentData = {
        status: url.searchParams.get("status"),
        user_id: url.searchParams.get("user_id"),
        amount: url.searchParams.get("amount"),
        transaction_id: url.searchParams.get("transaction_id"),
      };
    }

    console.log("Payment callback received:", paymentData);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { status, user_id, amount, transaction_id } = paymentData;

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

      // Enregistrer le paiement dans la table payments
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user_id,
          amount: parseFloat(amount),
          status: "completed",
          transaction_id: transaction_id,
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
      const frontendUrl = Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovableproject.com") || url.origin;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${frontendUrl}/subscription?payment=success`,
        },
      });
    } else {
      console.log("Payment not successful, status:", status);
      
      // Rediriger vers la page d'échec
      const frontendUrl = Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovableproject.com") || url.origin;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${frontendUrl}/subscription?payment=failed`,
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