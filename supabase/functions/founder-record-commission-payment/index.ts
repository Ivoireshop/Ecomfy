import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { founderCorsHeaders as corsHeaders, jsonResponse as json, requireFounder } from "../_shared/founderAuth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enregistre un règlement de commission encaissé hors ligne (validation manuelle par un fondateur).
// apply_commission_payment n'est exécutable que par service_role : cette fonction est le seul
// chemin pour un utilisateur connecté, et elle exige le rôle founder / co_founder.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await requireFounder(req, supabase, "founder-record-commission-payment");
    if ("error" in auth) return auth.error;
    const userId = auth.userId;

    const body = await req.json().catch(() => ({}));
    const { shop_id, amount, transaction_reference, payment_method, notes } = body ?? {};

    if (typeof shop_id !== "string" || !UUID_RE.test(shop_id)) {
      return json(400, { success: false, error: "Boutique invalide." });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return json(400, { success: false, error: "Montant invalide." });
    }

    const reference =
      typeof transaction_reference === "string" && transaction_reference.trim()
        ? transaction_reference.trim().slice(0, 100)
        : `MANUAL-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // p_created_by vient toujours de la session, jamais du corps de la requête.
    const { data: result, error: rpcError } = await supabase.rpc("apply_commission_payment", {
      p_shop_id: shop_id,
      p_amount: amountNum,
      p_transaction_reference: reference,
      p_created_by: userId,
      p_payment_method: typeof payment_method === "string" && payment_method ? payment_method.slice(0, 50) : "cash_direct",
      p_notes: typeof notes === "string" && notes ? notes.slice(0, 500) : "Règlement manuel enregistré par le fondateur",
    });

    if (rpcError) {
      console.error("[founder-record-commission-payment] RPC error:", rpcError);
      return json(500, { success: false, error: rpcError.message });
    }
    if (result?.success === false) {
      return json(400, { success: false, error: result.error || "Paiement refusé." });
    }

    return json(200, { success: true, ...(result ?? {}) });
  } catch (err: any) {
    console.error("[founder-record-commission-payment] Error:", err);
    return json(500, { success: false, error: err.message || "Erreur lors de l'enregistrement du paiement." });
  }
});
