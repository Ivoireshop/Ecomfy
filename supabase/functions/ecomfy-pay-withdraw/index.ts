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

    // Vérifier le jeton d'authentification utilisateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé. Veuillez vous connecter." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Session expirée ou invalide." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantId = userData.user.id;
    const body = await req.json();
    const {
      amount,
      payout_method = "mobile_money",
      destination_phone,
      destination_name,
      destination_bank_iban,
      currency = "XOF",
    } = body;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Saisissez un montant de retrait valide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payout_method === "mobile_money" && !destination_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Numéro de téléphone destinataire obligatoire pour le retrait Mobile Money." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exécuter la procédure Postgres atomique (verrouillage anti-double retrait + vérification KYC + déduction du solde)
    const { data: result, error: rpcError } = await supabase.rpc(
      "request_wallet_withdrawal_atomic",
      {
        p_merchant_id: merchantId,
        p_amount: amount,
        p_payout_method: payout_method,
        p_destination_phone: destination_phone || null,
        p_destination_name: destination_name || null,
        p_destination_bank_iban: destination_bank_iban || null,
        p_currency: currency,
      }
    );

    if (rpcError) {
      console.error("[ecomfy-pay-withdraw] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ success: false, error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result?.success) {
      return new Response(
        JSON.stringify({ success: false, error: result?.error || "Demande de retrait refusée." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dispatch Payout API call to provider (GeniusPay Payout / Wave Payout) if credentials present
    const GENIUSPAY_API_KEY = Deno.env.get("GENIUSPAY_API_KEY");
    const GENIUSPAY_API_SECRET = Deno.env.get("GENIUSPAY_API_SECRET");

    if (GENIUSPAY_API_KEY && GENIUSPAY_API_SECRET) {
      try {
        const payoutPayload = {
          amount,
          currency,
          reference: result.withdrawal_reference,
          destination: {
            type: payout_method,
            phone: destination_phone,
            name: destination_name,
          },
        };

        const resp = await fetch("https://pay.genius.ci/api/v1/merchant/payouts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": GENIUSPAY_API_KEY,
            "X-API-Secret": GENIUSPAY_API_SECRET,
          },
          body: JSON.stringify(payoutPayload),
        });

        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json.success) {
          await supabase
            .from("withdrawal_requests")
            .update({
              status: "PROCESSING",
              provider_reference: json.data?.reference || json.data?.id,
            })
            .eq("id", result.withdrawal_id);
        }
      } catch (e) {
        console.warn("[ecomfy-pay-withdraw] Payout dispatch exception:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: result.withdrawal_id,
        withdrawal_reference: result.withdrawal_reference,
        amount: result.amount,
        remaining_available_balance: result.remaining_available_balance,
        message: "Votre demande de retrait a été enregistrée avec succès. Les fonds vous seront transférés sous peu.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ecomfy-pay-withdraw] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erreur lors de la demande de retrait." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
