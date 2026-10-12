import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rôles que le fondateur principal peut attribuer ou retirer. `founder` n'y figure pas volontairement :
// il ne s'obtient et ne se retire jamais via cette fonction.
export const ASSIGNABLE_ROLES = ["co_founder", "shareholder", "admin"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const LISTED_ROLES = ["founder", ...ASSIGNABLE_ROLES];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERS_PAGE_SIZE = 1000;
const USERS_MAX_PAGES = 20;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Cherche un utilisateur par e-mail exact, sur toutes les pages (listUsers n'en renvoie qu'une à la fois).
async function findUserByEmail(supabase: SupabaseClient, email: string) {
  for (let page = 1; page <= USERS_MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (users.length < USERS_PAGE_SIZE) return null;
  }
  return null;
}

// Les droits se décident uniquement sur `user_roles` : jamais sur l'e-mail de l'appelant.
//  - `founder`    : fondateur principal, seul à pouvoir nommer et révoquer ;
//  - `co_founder` : lecture seule de la liste.
export async function handleRequest(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json(401, { error: "Non autorisé" });

    const { data: callerRoles, error: callerRolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["founder", "co_founder"]);
    if (callerRolesError) throw callerRolesError;

    const isMainFounder = (callerRoles || []).some((r) => r.role === "founder");
    const isCoFounder = (callerRoles || []).some((r) => r.role === "co_founder");
    if (!isMainFounder && !isCoFounder) {
      return json(403, { error: "Droits d'administration insuffisants" });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Corps de requête invalide" });
    }
    const action = body?.action;

    // 1. LISTE (fondateur et co-fondateurs)
    if (action === "list") {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .in("role", LISTED_ROLES);
      if (rolesError) throw rolesError;

      const userIds = [...new Set((roles || []).map((r) => r.user_id))];
      const profilesMap: Record<string, { email?: string; full_name?: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        (profiles || []).forEach((p) => {
          profilesMap[p.id] = { email: p.email, full_name: p.full_name };
        });

        // Repli sur auth.users pour les profils sans e-mail (quelques identifiants seulement).
        for (const id of userIds) {
          if (profilesMap[id]?.email) continue;
          const { data: authData } = await supabase.auth.admin.getUserById(id);
          const authUser = authData?.user;
          if (!authUser) continue;
          profilesMap[id] = {
            email: authUser.email || undefined,
            full_name: profilesMap[id]?.full_name || authUser.user_metadata?.full_name,
          };
        }
      }

      const founders = (roles || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        created_at: r.created_at,
        email: profilesMap[r.user_id]?.email || "Non renseigné",
        full_name: profilesMap[r.user_id]?.full_name || profilesMap[r.user_id]?.email || "Membre Ecomfy",
        is_main_founder: r.role === "founder",
      }));

      return json(200, { success: true, founders, isMainFounder });
    }

    // Nommer et révoquer : fondateur principal uniquement.
    if (action === "add" || action === "revoke") {
      if (!isMainFounder) {
        return json(403, { error: "Seul le fondateur principal peut nommer ou révoquer des membres." });
      }

      const role = body.role as AssignableRole;
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return json(400, { error: `Rôle non autorisé. Rôles possibles : ${ASSIGNABLE_ROLES.join(", ")}.` });
      }

      // 2. NOMMER
      if (action === "add") {
        if (typeof body.email !== "string" || !body.email.trim()) {
          return json(400, { error: "Email et rôle sont requis" });
        }
        const cleanEmail = body.email.trim().toLowerCase();

        const targetUser = await findUserByEmail(supabase, cleanEmail);
        if (!targetUser) {
          return json(404, {
            error: `Aucun utilisateur inscrit avec l'adresse "${cleanEmail}". Demandez-lui d'abord de créer un compte sur Ecomfy.`,
          });
        }

        const { error: upsertError } = await supabase
          .from("user_roles")
          .upsert({ user_id: targetUser.id, role }, { onConflict: "user_id,role" });
        if (upsertError) throw upsertError;

        return json(200, { success: true, message: `Rôle "${role}" accordé avec succès à ${cleanEmail}` });
      }

      // 3. RÉVOQUER : un rôle précis, jamais tous les rôles de l'utilisateur.
      const targetUserId = body.target_user_id;
      if (typeof targetUserId !== "string" || !UUID_RE.test(targetUserId)) {
        return json(400, { error: "L'identifiant utilisateur est requis" });
      }

      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", role);
      if (deleteError) throw deleteError;

      return json(200, { success: true, message: "Droits révoqués avec succès." });
    }

    return json(400, { error: "Action non reconnue" });
  } catch (error: any) {
    console.error("Error in manage-founder-roles:", error);
    return json(500, { error: "Une erreur est survenue" });
  }
}
