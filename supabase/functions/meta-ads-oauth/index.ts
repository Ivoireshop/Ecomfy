// supabase/functions/meta-ads-oauth/index.ts
// Connect Ads : connexion OAuth 2.0 à Meta (Facebook Login), choix du Business Manager et des comptes publicitaires.
// Authentification utilisateur obligatoire, `state` signé, jeton stocké côté serveur uniquement (meta_ads_connections).
//
// Actions (POST JSON) :
//   get_auth_url      { shop_id }                               → { authUrl }
//   exchange_code     { code, state }                           → { shopId, metaUserName, businesses, canListBusinesses }
//   status            { shop_id }                               → { connected, metaUserName, expiresAt, canListBusinesses }
//   list_accounts     { shop_id, business_id | null }           → { accounts }   (null = comptes personnels)
//   connect_accounts  { shop_id, accounts: [{ account_id, business_id }] } → { connected: [{ id, account_id }], failed }
//   disconnect        { shop_id }                               → { }

import { serveCors } from "../_shared/http.ts";
import { adminClient, fail, getUserId, json, ownsShop } from "../_shared/gsc.ts";
import {
  exchangeCodeForLongLivedToken, getAdAccount, GRAPH, graphGet, inspectToken, listAdAccounts, listBusinesses,
  META_SCOPES, metaConfig, MetaApiError, REDIRECT_URI, REQUIRED_SCOPE, signState, verifyState,
} from "../_shared/metaAds.ts";

const MAX_ACCOUNTS_PER_CALL = 20;

interface Connection {
  id: string;
  access_token: string;
  token_expires_at: string | null;
  meta_user_name: string | null;
  scopes: string[];
}

async function loadConnection(admin: ReturnType<typeof adminClient>, shopId: string): Promise<Connection | null> {
  const { data } = await admin
    .from("meta_ads_connections")
    .select("id, access_token, token_expires_at, meta_user_name, scopes")
    .eq("shop_id", shopId)
    .maybeSingle();
  return (data as Connection) ?? null;
}

/** Message affichable : une erreur Meta (jeton révoqué, permission retirée…) devient « reconnectez-vous ». */
function metaFailure(e: unknown): string {
  if (e instanceof MetaApiError) {
    if (e.code === 190 || e.status === 401) return "La connexion Meta a expiré ou a été révoquée. Reconnectez votre compte.";
    if (e.code === 200 || e.code === 10) return "Meta refuse l'accès : vérifiez les permissions accordées à Ecomfy.";
    return `Meta : ${e.message}`;
  }
  return e instanceof Error ? e.message : "Erreur interne.";
}

serveCors("app", async (req) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return fail("Connectez-vous pour associer Meta Ads.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON libre, validé champ par champ
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* corps vide */ }
    const { action } = body;

    const cfg = metaConfig();
    if (!cfg) return fail("La connexion Meta n'est pas configurée sur le serveur.");

    const admin = adminClient();

    if (action === "get_auth_url") {
      if (!(await ownsShop(admin, userId, body.shop_id))) return fail("Boutique introuvable.");
      const params = new URLSearchParams({
        client_id: cfg.appId,
        redirect_uri: REDIRECT_URI(),
        response_type: "code",
        scope: META_SCOPES.join(","),
        state: await signState(body.shop_id, userId),
      });
      return json({ success: true, authUrl: `https://www.facebook.com/${GRAPH.split("/").pop()}/dialog/oauth?${params}` });
    }

    if (action === "exchange_code") {
      const shopId = await verifyState(body.state, userId);
      if (!shopId || !body.code) return fail("Autorisation Meta invalide ou expirée. Recommencez la connexion.");
      if (!(await ownsShop(admin, userId, shopId))) return fail("Boutique introuvable.");

      let token: string;
      try {
        ({ token } = await exchangeCodeForLongLivedToken(String(body.code)));
      } catch (e) {
        console.error("[meta-ads-oauth] exchange:", e instanceof Error ? e.message : e);
        return fail(metaFailure(e));
      }

      const info = await inspectToken(token);
      if (!info.valid || !info.userId) return fail("Meta n'a pas validé l'autorisation. Recommencez la connexion.");
      if (!info.scopes.includes(REQUIRED_SCOPE)) {
        return fail("La permission « lecture des publicités » n'a pas été accordée. Recommencez et acceptez-la pour synchroniser vos dépenses.");
      }

      let metaUserName: string | null = null;
      try { metaUserName = (await graphGet("/me", token, { fields: "name" })).name ?? null; } catch (_) { /* facultatif */ }

      const { error: upsertError } = await admin.from("meta_ads_connections").upsert(
        {
          shop_id: shopId,
          user_id: userId,
          meta_user_id: info.userId,
          meta_user_name: metaUserName,
          access_token: token,
          token_expires_at: info.expiresAt,
          scopes: info.scopes,
        },
        { onConflict: "shop_id" },
      );
      if (upsertError) {
        console.error("[meta-ads-oauth] upsert connexion:", upsertError.message);
        return fail("Enregistrement de la connexion impossible.");
      }

      const canListBusinesses = info.scopes.includes("business_management");
      let businesses: { id: string; name: string }[] = [];
      if (canListBusinesses) {
        try { businesses = await listBusinesses(token); } catch (e) { return fail(metaFailure(e)); }
      }
      return json({ success: true, shopId, metaUserName, businesses, canListBusinesses });
    }

    // Les actions suivantes portent un shop_id et exigent d'en être propriétaire.
    if (!(await ownsShop(admin, userId, body.shop_id))) return fail("Boutique introuvable.");
    const shopId: string = body.shop_id;

    if (action === "status") {
      const conn = await loadConnection(admin, shopId);
      if (!conn) return json({ success: true, connected: false });
      const expired = !!conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now();
      return json({
        success: true,
        connected: !expired,
        expired,
        metaUserName: conn.meta_user_name,
        expiresAt: conn.token_expires_at,
        canListBusinesses: conn.scopes.includes("business_management"),
      });
    }

    if (action === "disconnect") {
      const conn = await loadConnection(admin, shopId);
      if (conn) {
        // Révocation côté Meta : meilleur effort, la suppression locale ne doit pas en dépendre.
        try {
          await fetch(`${GRAPH}/me/permissions`, { method: "DELETE", headers: { Authorization: `Bearer ${conn.access_token}` } });
        } catch (_) { /* ignoré */ }
        // Les comptes liés gardent leur historique de dépenses mais ne se synchronisent plus tant qu'on ne se reconnecte pas.
        await admin.from("ad_accounts").update({
          last_sync_status: "error",
          last_sync_error: "Connexion Meta supprimée : reconnectez votre compte pour reprendre la synchronisation.",
        }).eq("connection_id", conn.id);
        const { error } = await admin.from("meta_ads_connections").delete().eq("id", conn.id);
        if (error) return fail("Déconnexion impossible.");
      }
      return json({ success: true });
    }

    if (action === "list_accounts") {
      const conn = await loadConnection(admin, shopId);
      if (!conn) return fail("Aucune connexion Meta. Recommencez la connexion.");
      const businessId = body.business_id == null ? null : String(body.business_id);
      if (businessId !== null && !/^\d{5,25}$/.test(businessId)) return fail("Business Manager invalide.");
      try {
        return json({ success: true, accounts: await listAdAccounts(conn.access_token, businessId) });
      } catch (e) {
        console.error("[meta-ads-oauth] list_accounts:", e instanceof Error ? e.message : e);
        return fail(metaFailure(e));
      }
    }

    if (action === "connect_accounts") {
      const conn = await loadConnection(admin, shopId);
      if (!conn) return fail("Aucune connexion Meta. Recommencez la connexion.");
      const requested: { account_id: unknown; business_id?: unknown }[] = Array.isArray(body.accounts) ? body.accounts : [];
      if (requested.length === 0) return fail("Sélectionnez au moins un compte publicitaire.");
      if (requested.length > MAX_ACCOUNTS_PER_CALL) return fail(`Pas plus de ${MAX_ACCOUNTS_PER_CALL} comptes à la fois.`);

      let businessNames = new Map<string, string>();
      if (conn.scopes.includes("business_management")) {
        try { businessNames = new Map((await listBusinesses(conn.access_token)).map((b) => [b.id, b.name])); } catch (_) { /* noms facultatifs */ }
      }

      const connected: { id: string; account_id: string }[] = [];
      const failed: { account_id: string; error: string }[] = [];
      for (const item of requested) {
        const accountId = String(item.account_id ?? "").replace(/^act_/i, "");
        if (!/^\d{5,20}$/.test(accountId)) { failed.push({ account_id: accountId, error: "Identifiant invalide." }); continue; }
        try {
          // Meta est la source de vérité : un compte auquel l'utilisateur n'a pas accès est refusé ici.
          const acc = await getAdAccount(conn.access_token, accountId);
          const businessId = item.business_id ? String(item.business_id) : null;
          const { data, error } = await admin.from("ad_accounts").upsert(
            {
              shop_id: shopId,
              user_id: userId,
              provider: "meta",
              account_id: accountId,
              account_label: acc.name,
              currency: acc.currency,
              access_token: null, // le jeton vit dans la connexion ; supprime aussi un éventuel jeton manuel
              connection_id: conn.id,
              connection_method: "oauth",
              business_id: businessId,
              business_name: businessId ? businessNames.get(businessId) ?? null : null,
              token_expires_at: conn.token_expires_at,
              token_expiry_notified_at: null,
              is_active: true,
              last_sync_status: "pending",
              last_sync_error: null,
            },
            { onConflict: "shop_id,provider,account_id" },
          ).select("id").single();
          if (error || !data) throw new Error(error?.message || "Enregistrement impossible.");
          connected.push({ id: data.id, account_id: accountId });
        } catch (e) {
          console.error("[meta-ads-oauth] connect_accounts:", accountId, e instanceof Error ? e.message : e);
          failed.push({ account_id: accountId, error: metaFailure(e) });
        }
      }
      return json({ success: connected.length > 0, connected, failed, ...(connected.length === 0 ? { error: failed[0]?.error || "Aucun compte connecté." } : {}) });
    }

    return fail("Action invalide.");
  } catch (err) {
    console.error("[meta-ads-oauth]", err instanceof Error ? err.message : err);
    return fail("Une erreur est survenue. Réessayez dans un instant.");
  }
});
