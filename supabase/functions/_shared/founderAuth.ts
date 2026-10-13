import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export const founderCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...founderCorsHeaders, "Content-Type": "application/json" },
  });

// Vérifie le JWT de la requête et le rôle founder / co_founder (table user_roles).
// `supabase` doit être un client service_role. Renvoie l'id de l'utilisateur, ou la réponse d'erreur à retourner.
export async function requireFounder(
  req: Request,
  supabase: SupabaseClient,
  logTag: string,
): Promise<{ userId: string } | { error: Response }> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return { error: jsonResponse(401, { success: false, error: "Session expirée ou invalide." }) };
  }
  const userId = userData.user.id;

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["founder", "co_founder"]);
  if (rolesError) {
    console.error(`[${logTag}] roles error:`, rolesError);
    return { error: jsonResponse(500, { success: false, error: "Vérification des droits impossible." }) };
  }
  if (!roles?.length) {
    return { error: jsonResponse(403, { success: false, error: "Action réservée aux fondateurs." }) };
  }
  return { userId };
}
