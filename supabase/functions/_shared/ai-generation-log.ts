// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { dailyCostCapUsd, IMAGE_CREDIT_COST, VIDEO_CREDIT_COST } from "./ai-cost.ts";

/**
 * Réservation / clôture d'une génération du Studio (voir la migration 20261103100000_studio_ai_generation_log.sql).
 *
 *   const gen = await startGeneration(userId, "image");
 *   if (!gen.allowed) return gen.response;            // solde insuffisant ou plafond de coût atteint
 *   ... appels fournisseur ...
 *   await finishGeneration(gen.logId, { status: "succeeded", attempts, model, costUsd, durationMs });
 *   // ou { status: "failed", errorCode } -> le crédit est remboursé automatiquement.
 *   // { status: "cancelled" } : même remboursement, pour un résultat non facturable (cache, moteur de secours gratuit).
 *
 * Le débit se fait AVANT l'appel payant (atomique, par utilisateur) et non après : sinon deux clics simultanés
 * dépensaient le même crédit, et un compte à zéro générait gratuitement.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export type StartResult =
  | { allowed: true; logId: string; source: "free" | "credits" | "subscription" | "exempt"; charged: number }
  | { allowed: false; error: string; response: Response };

// Statut 200 conservé : convention des fonctions IA (voir ai-quota.ts). Les écrans affichent `error` tel quel, c'est
// donc le message lisible ; le code stable (`credits_required`, `daily_limit`…) est dans `code`.
function refusal(_status: number, code: string, message: string, extra: Record<string, unknown> = {}): StartResult {
  return {
    allowed: false,
    error: code,
    response: new Response(JSON.stringify({
      success: false,
      error: message,
      code,
      message,
      // Drapeau lu par Generator.tsx pour ouvrir la fenêtre de recharge.
      ...(code === "credits_required" ? { quotaExhausted: true } : {}),
      ...extra,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}

/** Fonctionnalité débitée par réservation : image du Studio, visuel publicitaire, image de service, vidéo. */
export type ReservedFeature = "image" | "ad_visual" | "feature_image" | "video";

export async function startGeneration(userId: string, feature: ReservedFeature): Promise<StartResult> {
  const creditCost = feature === "video" ? VIDEO_CREDIT_COST : IMAGE_CREDIT_COST;
  try {
    const { data, error } = await admin().rpc("start_studio_generation", {
      _user_id: userId,
      _feature: feature,
      _daily_cap_usd: dailyCostCapUsd(),
      _credit_cost: creditCost,
    });
    if (error) {
      // Fail-closed : ces appels coûtent de l'argent, une panne du décompte ne doit pas les ouvrir.
      console.error("[ai-generation-log] start rpc error", error);
      return refusal(503, "quota_unavailable", "Le suivi des crédits est momentanément indisponible. Réessayez dans un instant.");
    }
    if (data?.success) {
      return { allowed: true, logId: data.log_id, source: data.source, charged: Number(data.charged) || 0 };
    }
    if (data?.error === "credits_required") {
      return refusal(
        402,
        "credits_required",
        feature === "video"
          ? `Il vous faut ${creditCost} crédits IA pour générer une vidéo. Rechargez vos crédits ou souscrivez à un abonnement.`
          : "Vous n'avez plus de générations gratuites. Rechargez vos crédits IA ou souscrivez à un abonnement.",
        { balance: data.balance ?? 0, needed: data.needed ?? creditCost },
      );
    }
    if (data?.error === "daily_cost_cap") {
      return refusal(
        429,
        "daily_limit",
        "Vous avez atteint la limite de génération du jour. Elle se renouvelle à minuit (UTC).",
      );
    }
    if (data?.error === "not_authenticated") {
      return refusal(401, "not_authenticated", "Connectez-vous pour générer.");
    }
    console.error("[ai-generation-log] start refused", data);
    return refusal(400, data?.error || "invalid_request", "Demande invalide.");
  } catch (e) {
    console.error("[ai-generation-log] start exception", e);
    return refusal(503, "quota_unavailable", "Le suivi des crédits est momentanément indisponible. Réessayez dans un instant.");
  }
}

export interface FinishInput {
  status: "succeeded" | "failed" | "cancelled";
  attempts?: number;
  model?: string | null;
  costUsd?: number;
  durationMs?: number;
  errorCode?: string | null;
}

/** Clôt la génération. Ne lève jamais : un échec d'écriture du journal ne doit pas masquer le résultat à l'utilisateur. */
export async function finishGeneration(logId: string, input: FinishInput): Promise<{ refunded: boolean }> {
  try {
    const { data, error } = await admin().rpc("finish_studio_generation", {
      _log_id: logId,
      _status: input.status,
      _attempts: input.attempts ?? 0,
      _model: input.model ?? null,
      _cost_usd: input.costUsd ?? 0,
      _duration_ms: input.durationMs != null ? Math.round(input.durationMs) : null,
      _error_code: input.errorCode ?? null,
    });
    if (error) {
      // La réservation reste ouverte : expire_stale_studio_generations() la clôturera et remboursera.
      console.error("[ai-generation-log] finish rpc error", logId, error);
      return { refunded: false };
    }
    return { refunded: data?.refunded === true };
  } catch (e) {
    console.error("[ai-generation-log] finish exception", logId, e);
    return { refunded: false };
  }
}

/** Écrit une ligne déjà terminée (fonctions qui gardent leur propre règle de débit, ex. la fiche produit). Ne lève jamais. */
export async function recordGeneration(
  userId: string,
  feature: "product_sheet" | "feature_image",
  input: FinishInput & { chargeSource?: "free" | "credits" | "subscription" | "exempt"; chargeAmount?: number },
): Promise<void> {
  try {
    const { error } = await admin().rpc("record_ai_generation", {
      _user_id: userId,
      _feature: feature,
      _status: input.status,
      _charge_source: input.chargeSource ?? "exempt",
      _charge_amount: input.chargeAmount ?? 0,
      _attempts: input.attempts ?? 0,
      _model: input.model ?? null,
      _cost_usd: input.costUsd ?? 0,
      _duration_ms: input.durationMs != null ? Math.round(input.durationMs) : null,
      _error_code: input.errorCode ?? null,
    });
    if (error) console.error("[ai-generation-log] record rpc error", error);
  } catch (e) {
    console.error("[ai-generation-log] record exception", e);
  }
}

/** Coût estimé du jour (UTC) déjà engagé par l'utilisateur. `null` si le décompte est indisponible (fail-closed côté appelant). */
export async function todaySpendUsd(userId: string): Promise<number | null> {
  try {
    const { data, error } = await admin().rpc("ai_daily_spend_usd", { _user_id: userId });
    if (error) {
      console.error("[ai-generation-log] spend rpc error", error);
      return null;
    }
    return Number(data) || 0;
  } catch (e) {
    console.error("[ai-generation-log] spend exception", e);
    return null;
  }
}

/** Réponse standard « limite du jour atteinte », pour les fonctions qui contrôlent le plafond sans réserver. */
export function dailyLimitResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Vous avez atteint la limite de génération du jour. Elle se renouvelle à minuit (UTC).",
      code: "daily_limit",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
