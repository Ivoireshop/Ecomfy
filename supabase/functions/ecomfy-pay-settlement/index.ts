import { serveCors } from "../_shared/http.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAuthorizedCron, cronUnauthorizedResponse } from "../_shared/cron-auth.ts";
import { sendServerPurchase } from "../_shared/purchase-capi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serveCors("server", async (req) => {
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

    // Purchase publicitaires non partis (webhook tombé, Meta indisponible, commande marquée payée par le rejeu ci-dessus).
    // Idempotent : un Purchase déjà envoyé n'est pas renvoyé. Échec ici = journalisé, jamais bloquant pour l'apurement.
    const purchases = { examined: 0, sent: 0, failed: 0 };
    try {
      const { data: due, error: dueErr } = await supabase.rpc("list_purchases_to_resend", { p_limit: 25 });
      if (dueErr) console.warn("[ecomfy-pay-settlement] list_purchases_to_resend:", dueErr.message);
      for (const row of (due ?? []) as Array<{ payment_id: string }>) {
        purchases.examined++;
        const out = await sendServerPurchase(supabase, row.payment_id);
        if (out.sent) purchases.sent++; else { purchases.failed++; console.warn("[ecomfy-pay-settlement] Purchase non envoyé:", row.payment_id, out.reason); }
      }
    } catch (e) {
      console.warn("[ecomfy-pay-settlement] Reprise des Purchase en erreur:", e);
    }

    // Déclencher la procédure Postgres d'apurement des règlements (PENDING -> AVAILABLE)
    const { data: count, error } = await supabase.rpc("process_wallet_settlements");

    if (error) {
      console.error("[ecomfy-pay-settlement] RPC error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Settlement error" }),
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
        purchases,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ecomfy-pay-settlement] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Settlement error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
