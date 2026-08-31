import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const MAIN_FOUNDER_EMAIL = "djateulrich@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller authentication
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has founder role or is main founder
    const callerEmail = user.email?.toLowerCase();
    const isMainFounder = callerEmail === MAIN_FOUNDER_EMAIL;

    const { data: callerRoles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["founder", "co_founder"]);

    const hasFounderRole = isMainFounder || (callerRoles && callerRoles.length > 0);

    if (!hasFounderRole) {
      return new Response(JSON.stringify({ error: "Droits d'administration insuffisants" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // 1. LIST ALL FOUNDERS / ADMINS
    if (action === "list") {
      const { data: roles, error: rolesError } = await supabaseClient
        .from("user_roles")
        .select("id, user_id, role, created_at");

      if (rolesError) throw rolesError;

      // Fetch user profile details
      const userIds = (roles || []).map((r) => r.user_id);
      let profilesMap: Record<string, { email?: string; full_name?: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        (profiles || []).forEach((p) => {
          profilesMap[p.id] = { email: p.email, full_name: p.full_name };
        });

        // Fallback to auth.users for missing emails
        const { data: authUsersData } = await supabaseClient.auth.admin.listUsers();
        (authUsersData?.users || []).forEach((u) => {
          if (!profilesMap[u.id]) profilesMap[u.id] = {};
          if (u.email) profilesMap[u.id].email = u.email;
          if (u.user_metadata?.full_name && !profilesMap[u.id].full_name) {
            profilesMap[u.id].full_name = u.user_metadata.full_name;
          }
        });
      }

      // Ensure main founder djateulrich@gmail.com is listed
      const { data: mainUserData } = await supabaseClient.auth.admin.listUsers();
      const mainUserObj = (mainUserData?.users || []).find((u) => u.email?.toLowerCase() === MAIN_FOUNDER_EMAIL);

      const items = (roles || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        created_at: r.created_at,
        email: profilesMap[r.user_id]?.email || "Non renseigné",
        full_name: profilesMap[r.user_id]?.full_name || profilesMap[r.user_id]?.email || "Membre Ecomfy",
        is_main_founder: profilesMap[r.user_id]?.email?.toLowerCase() === MAIN_FOUNDER_EMAIL,
      }));

      // Add main founder if not already present in list
      if (mainUserObj && !items.some((i) => i.user_id === mainUserObj.id)) {
        items.unshift({
          id: "main-founder-id",
          user_id: mainUserObj.id,
          role: "founder",
          created_at: mainUserObj.created_at,
          email: MAIN_FOUNDER_EMAIL,
          full_name: mainUserObj.user_metadata?.full_name || "Ulrich DJATÉ (Fondateur Principal)",
          is_main_founder: true,
        });
      }

      return new Response(JSON.stringify({ success: true, founders: items, isMainFounder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. ADD / NOMINATE FOUNDER OR ROLE
    if (action === "add") {
      const { email, role } = body;
      if (!email || !role) {
        return new Response(JSON.stringify({ error: "Email et rôle sont requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanEmail = String(email).trim().toLowerCase();

      // Find user by email
      const { data: searchUsers } = await supabaseClient.auth.admin.listUsers();
      const targetUser = (searchUsers?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);

      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: `Aucun utilisateur inscrit avec l'adresse "${cleanEmail}". Demandez-lui d'abord de créer un compte sur Ecomfy.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert into user_roles
      const { error: upsertError } = await supabaseClient
        .from("user_roles")
        .upsert(
          {
            user_id: targetUser.id,
            role: role,
          },
          { onConflict: "user_id,role" }
        );

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({
          success: true,
          message: `Rôle "${role}" accordé avec succès à ${cleanEmail}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. REVOKE ROLE
    if (action === "revoke") {
      const { target_user_id } = body;
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "L'identifiant utilisateur est requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent revoking main founder
      const { data: targetUserData } = await supabaseClient.auth.admin.getUserById(target_user_id);
      if (targetUserData?.user?.email?.toLowerCase() === MAIN_FOUNDER_EMAIL) {
        return new Response(JSON.stringify({ error: "Impossible de révoquer les droits du Fondateur Principal (Ulrich DJATÉ)." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true, message: "Droits révoqués avec succès." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action non reconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in manage-founder-roles:", error);
    return new Response(JSON.stringify({ error: error?.message || "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
