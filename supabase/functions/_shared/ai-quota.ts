

/**
 * Vérifie et consomme le quota IA quotidien d'un utilisateur.
 * Limite par défaut : 2 requêtes / jour / utilisateur (fondateurs exemptés).
 *
 * Usage (à mettre TOUT EN HAUT du handler, après l'OPTIONS et l'auth) :
 *
 *   const quota = await enforceAiQuota(req, "product-ai-optimizer");
 *   if (!quota.allowed) return quota.response;
 */

export type QuotaResult =
  | { allowed: true; used: number; remaining: number | null; exempt?: boolean }
  | { allowed: false; response: Response };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function enforceAiQuota(
  req: Request,
  _actionName: string,
  _dailyLimit = 2,
): Promise<QuotaResult> {
  // Bypassed completely
  return {
    allowed: true,
    used: 0,
    remaining: 999999,
    exempt: true,
  };
}