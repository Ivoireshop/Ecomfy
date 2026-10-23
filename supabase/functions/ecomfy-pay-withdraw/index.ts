import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getDefaultConnector } from "../_shared/operators/index.ts";

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

    const body = await req.json();
    const {
      amount,
      payout_method = "mobile_money",
      destination_phone,
      destination_name,
      destination_bank_iban,
      payout_operator,
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

    // Exécuter la procédure Postgres atomique (verrouillage anti-double retrait + vérification KYC + déduction du solde).
    // Client rattaché au JWT du marchand : la fonction identifie le portefeuille via auth.uid(), pas via un paramètre.
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: result, error: rpcError } = await userClient.rpc(
      "request_wallet_withdrawal_atomic",
      {
        p_amount: amount,
        p_payout_method: payout_method,
        p_destination_phone: destination_phone || null,
        p_destination_name: destination_name || null,
        p_destination_bank_iban: destination_bank_iban || null,
        p_currency: currency,
        p_payout_operator: payout_operator || null,
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

    // Envoi du versement à l'opérateur si ses identifiants sont présents.
    const connector = getDefaultConnector();

    if (connector.isConfigured()) {
      const payout = await connector.initiatePayout({
        withdrawalReference: result.withdrawal_reference,
        amount,
        currency,
        method: payout_method,
        phone: destination_phone,
        name: destination_name,
        operator: payout_operator,
      });

      if (payout.outcome === "ACCEPTED") {
        await supabase
          .from("withdrawal_requests")
          .update({
            status: "PROCESSING",
            provider_reference: payout.providerReference,
          })
          .eq("id", result.withdrawal_id);
      } else if (payout.outcome === "REJECTED") {
        // Refus définitif du prestataire : le montant retourne au solde disponible (écriture WITHDRAWAL_FAILED).
        // Une erreur réseau ou 5xx reste ambiguë (UNKNOWN) : le retrait est laissé en REQUESTED pour être clôturé par le webhook.
        const { error: finErr } = await supabase.rpc("finalize_withdrawal", {
          p_withdrawal_reference: result.withdrawal_reference,
          p_status: "FAILED",
          p_failure_reason: payout.reason,
        });
        if (finErr) console.error("[ecomfy-pay-withdraw] finalize_withdrawal error:", finErr);
        return new Response(
          JSON.stringify({ success: false, error: "Le prestataire a refusé le transfert. Votre solde a été recrédité." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.warn("[ecomfy-pay-withdraw] Payout outcome unknown, left REQUESTED:", connector.id, payout.httpStatus);
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
