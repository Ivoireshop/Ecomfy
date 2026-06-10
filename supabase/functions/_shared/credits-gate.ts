import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Returns true if the user has any usable IA credit (free, purchased,
 * active subscription) or is a founder/co-founder. No credit is consumed.
 */
export async function userHasCredits(userId: string): Promise<boolean> {
  if (!userId) return false;
  const admin = adminClient();

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["founder", "co_founder"]);
  if (Array.isArray(roles) && roles.length > 0) return true;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, end_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (sub?.status === "active" && (!sub.end_date || new Date(sub.end_date) > new Date())) {
    return true;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("free_generations_remaining, free_video_generations_remaining, purchased_credits")
    .eq("id", userId)
    .maybeSingle();
  const free = profile?.free_generations_remaining ?? 0;
  const freeVid = profile?.free_video_generations_remaining ?? 0;
  const paid = profile?.purchased_credits ?? 0;
  return free > 0 || freeVid > 0 || paid > 0;
}

/**
 * Gate that requires the authenticated user (from the request JWT) to
 * have at least one IA credit. Returns `allowed: false` with a ready
 * Response when blocked.
 */
export async function requireUserCredits(
  req: Request,
): Promise<{ allowed: true; userId: string } | { allowed: false; response: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "not_authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "not_authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  const ok = await userHasCredits(userData.user.id);
  if (!ok) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: "credits_required",
          message:
            "Achetez un pack de crédits IA (2 000 / 2 500 / 3 000 FCFA) pour utiliser cette fonctionnalité.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  return { allowed: true, userId: userData.user.id };
}

/** Returns true if the owner of the given shop has IA credits available. */
export async function shopOwnerHasCredits(shopId: string): Promise<boolean> {
  if (!shopId) return false;
  const admin = adminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("user_id")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop?.user_id) return false;
  return userHasCredits(shop.user_id);
}

/**
 * Atomically consumes credit for a feature. Handles free trial (1 per
 * feature), founder exemption, active subscription, then deducts paid
 * credits. Returns `{ success, error?, balance?, free_trial?, ... }`.
 */
export async function consumeAiCredit(
  userId: string,
  feature: "optimizer" | "voice" | "product_sheet" | "image" | string,
  amount = 1.5,
): Promise<{ success: boolean; error?: string; balance?: number; free_trial?: boolean; exempt?: boolean }> {
  if (!userId) return { success: false, error: "not_authenticated" };
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_ai_credit", {
    _user_id: userId,
    _feature: feature,
    _amount: amount,
  });
  if (error) {
    console.error("consume_ai_credit rpc error", error);
    return { success: false, error: "rpc_failed" };
  }
  return (data || { success: false }) as any;
}

/**
 * Consumes credit for the shop owner (used by per-shop AI features like
 * the voice assistant). Returns the same shape as `consumeAiCredit`.
 */
export async function consumeShopOwnerCredit(
  shopId: string,
  feature: string,
  amount: number,
) {
  if (!shopId) return { success: false, error: "missing_shop" };
  const admin = adminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("user_id")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop?.user_id) return { success: false, error: "shop_not_found" };
  return consumeAiCredit(shop.user_id, feature, amount);
}

export const creditsRequiredResponse = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      success: false,
      error: "credits_required",
      message:
        "Vous avez utilisé votre essai gratuit. Achetez un pack de crédits IA (à partir de 2 000 FCFA) pour continuer.",
      ...extra,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );