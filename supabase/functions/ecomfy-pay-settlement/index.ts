import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAuthorizedCron, cronUnauthorizedResponse } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // M6 : réservé au planificateur (clé de service ou x-cron-secret), plus appelable par n'importe qui.
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rejeu d'abord : termine les paiements encaissés dont la commande n'est pas payée ou dont le crédit manque
    // (webhook tombé en erreur, portefeuille dégelé), pour que leur règlement soit créé avant l'apurement ci-dessous.
    const { data: replay, error: replayError } = await supabase.rpc("replay_incomplete_ecomfy_payments");
    if (replayError) console.error("[ecomfy-pay-settlement] Replay error:", replayError);
    else if (replay?.examined) console.log("[ecomfy-pay-settlement] Replay:", JSON.stringify(replay));

    // Déclencher la procédure Postgres d'apurement des règlements (PENDING -> AVAILABLE)
    const { data: count, error } = await supabase.rpc("process_wallet_settlements");

    if (error) {
      console.error("[ecomfy-pay-settlement] RPC error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ecomfy-pay-settlement] Processed ${count || 0} settlements.`);

    return new Response(
      JSON.stringify({
        success: true,
        settled_count: count || 0,
        message: `${count || 0} règlements libérés vers les soldes disponibles.`,
        replay: replay ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ecomfy-pay-settlement] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
