// supabase/functions/gsc-oauth-flow/index.ts
// Connexion OAuth 2.0 à Google Search Console (scope lecture seule), côté serveur.
// Authentification utilisateur obligatoire, `state` signé, jetons stockés côté serveur uniquement (corrige M2).
//
// Actions (POST JSON) :
//   get_auth_url  { shop_id }                → { authUrl }
//   exchange_code { code, state }            → { shopId, sites }   (stocke les jetons, ne les renvoie pas)
//   set_property  { shop_id, site_url }      → { propertyId }
//   disconnect    { shop_id }                → { }

import {
  adminClient, corsHeaders, fail, getUserId, getValidAccessToken, json, listSites,
  loadConnection, ownsShop, REDIRECT_URI, SCOPE, signState, verifyState,
} from "../_shared/gsc.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) return fail("Connectez-vous pour associer Google Search Console.");

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* corps vide */ }
    const { action } = body;

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
    if (!clientId || !clientSecret) return fail("Google OAuth n'est pas configuré sur le serveur.");

    const admin = adminClient();

    if (action === "get_auth_url") {
      if (!(await ownsShop(admin, userId, body.shop_id))) return fail("Boutique introuvable.");
      const state = await signState(body.shop_id, userId);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI(),
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "false",
        state,
      });
      return json({ success: true, authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    if (action === "exchange_code") {
      const shopId = await verifyState(body.state, userId);
      if (!shopId || !body.code) return fail("Autorisation Google invalide ou expirée. Recommencez la connexion.");
      if (!(await ownsShop(admin, userId, shopId))) return fail("Boutique introuvable.");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(body.code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI(),
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || tokens.error) return fail(tokens.error_description || tokens.error || "Échange du code Google refusé.");

      const existing = await loadConnection(admin, shopId);
      const { error: upsertError } = await admin.from("shop_seo_connections").upsert(
        {
          shop_id: shopId,
          gsc_connected: false, // devient vrai quand l'utilisateur choisit sa propriété
          google_access_token: tokens.access_token,
          // Google ne renvoie pas toujours de nouveau jeton de rafraîchissement : on garde l'ancien
          google_refresh_token: tokens.refresh_token || existing?.google_refresh_token || null,
          token_expires_at: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
          sync_status: "idle",
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id" },
      );
      if (upsertError) return fail("Enregistrement de la connexion impossible.");

      const sites = await listSites(tokens.access_token);
      return json({ success: true, shopId, sites });
    }

    if (action === "set_property") {
      if (!(await ownsShop(admin, userId, body.shop_id))) return fail("Boutique introuvable.");
      const conn = await loadConnection(admin, body.shop_id);
      if (!conn) return fail("Aucune autorisation Google en cours. Recommencez la connexion.");

      const token = await getValidAccessToken(admin, conn);
      const site = (await listSites(token)).find((s) => s.siteUrl === body.site_url);
      if (!site) return fail("Cette propriété n'appartient pas au compte Google autorisé.");
      if (site.permissionLevel === "siteUnverifiedUser") return fail("Cette propriété n'est pas vérifiée dans Search Console.");

      const { error } = await admin.from("shop_seo_connections").update({
        gsc_connected: true,
        gsc_property_id: site.siteUrl,
        gsc_property_type: site.siteUrl.startsWith("sc-domain:") ? "sc-domain" : "url-prefix",
        sync_status: "idle",
        sync_error: null,
        updated_at: new Date().toISOString(),
      }).eq("shop_id", body.shop_id);
      if (error) return fail("Enregistrement de la propriété impossible.");
      return json({ success: true, propertyId: site.siteUrl });
    }

    if (action === "disconnect") {
      if (!(await ownsShop(admin, userId, body.shop_id))) return fail("Boutique introuvable.");
      const { error } = await admin.from("shop_seo_connections").update({
        gsc_connected: false,
        gsc_property_id: null,
        google_access_token: null,
        google_refresh_token: null,
        token_expires_at: null,
        sync_status: "idle",
        sync_error: null,
        updated_at: new Date().toISOString(),
      }).eq("shop_id", body.shop_id);
      if (error) return fail("Déconnexion impossible.");
      await admin.from("shop_seo_queries_cache").delete().eq("shop_id", body.shop_id);
      await admin.from("shop_seo_pages_cache").delete().eq("shop_id", body.shop_id);
      return json({ success: true });
    }

    return fail("Action invalide.");
  } catch (err) {
    console.error("[gsc-oauth-flow]", err);
    return fail(err instanceof Error ? err.message : "Erreur interne.");
  }
});
