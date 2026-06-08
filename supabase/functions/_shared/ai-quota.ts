import { createClient } from "npm:@supabase/supabase-js@2";

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
  feature: string,
  dailyLimit = 2,
): Promise<QuotaResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "not_authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "not_authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data, error } = await admin.rpc("consume_ai_quota", {
    _user_id: userData.user.id,
    _feature: feature,
    _limit: dailyLimit,
  });

  if (error) {
    console.error("[ai-quota] RPC error", error);
    // Fail-open serait risqué : on bloque par défaut.
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "quota_check_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const result = data as {
    allowed: boolean;
    used?: number;
    remaining?: number | null;
    limit?: number | null;
    exempt?: boolean;
    resets_at?: string;
    error?: string;
  };

  if (!result?.allowed) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: "daily_quota_exceeded",
          message:
            "Vous avez atteint votre limite de 2 requêtes IA pour aujourd'hui. Réessayez demain.",
          limit: result?.limit ?? dailyLimit,
          used: result?.used ?? dailyLimit,
          remaining: 0,
          resets_at: result?.resets_at ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return {
    allowed: true,
    used: result.used ?? 0,
    remaining: result.remaining ?? null,
    exempt: result.exempt,
  };
}