import { createClient } from "npm:@supabase/supabase-js@2";
import { takeRateLimit } from "./rate-limit.ts";

/**
 * Garde des fonctions IA réservées aux utilisateurs connectés (H9).
 *
 * 1. Le JWT de la requête doit appartenir à un utilisateur réel (la clé `anon` ne suffit pas).
 * 2. Plafond horaire par utilisateur et par fonction, plus un plafond global par utilisateur.
 *
 * Ce n'est PAS le quota métier « 2 requêtes par jour » supprimé le 09/08/2026 (commit de9fb1e) :
 * l'accès payant reste géré par les crédits (`credits-gate.ts`, `consume_ai_credit`). Ces
 * plafonds ne servent qu'à borner le coût d'un compte compromis ou d'un script.
 *
 * Usage (tout en haut du handler, après l'OPTIONS) :
 *
 *   const quota = await enforceAiQuota(req, "product-ai-optimizer");
 *   if (!quota.allowed) return quota.response;
 *   // quota.userId : utilisateur authentifié
 */

export type QuotaResult =
  | { allowed: true; userId: string }
  | { allowed: false; response: Response; message: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const DEFAULT_HOURLY_LIMIT = 60;
export const GLOBAL_HOURLY_LIMIT = 300;
const HOUR = 3600;

function deny(error: string, message: string): QuotaResult {
  // Statut 200 conservé : c'est la convention d'origine, les écrans lisent `data.error`.
  return {
    allowed: false,
    message,
    response: new Response(
      JSON.stringify({ success: false, error, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    ),
  };
}

/** Identifie l'utilisateur à partir du JWT de la requête, ou `null`. */
export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.auth.getUser(token);
    return error || !data?.user ? null : data.user.id;
  } catch (e) {
    console.error("[ai-quota] getUser failed", e);
    return null;
  }
}

/** Applique les plafonds à un utilisateur déjà identifié. */
export async function enforceUserAiQuota(
  userId: string,
  feature: string,
  hourlyLimit = DEFAULT_HOURLY_LIMIT,
): Promise<QuotaResult> {
  const featureOk = await takeRateLimit(`ai:${feature}`, userId, hourlyLimit, HOUR);
  const globalOk = featureOk && await takeRateLimit("ai:all", userId, GLOBAL_HOURLY_LIMIT, HOUR);
  if (!featureOk || !globalOk) {
    return deny(
      "rate_limited",
      "Trop de requêtes IA en peu de temps. Réessayez dans quelques minutes.",
    );
  }
  return { allowed: true, userId };
}

export async function enforceAiQuota(
  req: Request,
  feature: string,
  hourlyLimit = DEFAULT_HOURLY_LIMIT,
): Promise<QuotaResult> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return deny("not_authenticated", "Connectez-vous pour utiliser cette fonctionnalité.");
  return enforceUserAiQuota(userId, feature, hourlyLimit);
}
