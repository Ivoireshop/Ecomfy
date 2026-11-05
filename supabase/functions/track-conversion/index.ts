// Server-side Conversions API bridge for Meta, TikTok, Snapchat, GA4.
// Each event arrives with the same event_id used by the browser pixel,
// allowing the ad platforms to deduplicate.
//
// Fonction publique (verify_jwt = false) : les événements du navigateur y arrivent sans compte.
// Garde-fous : limite par IP, formats d'identifiants vérifiés, et pour « Purchase » une commande réelle de la boutique
// (montant relu en base pour le navigateur ; les appels de confiance du serveur portent la clé service_role).
import { createClient } from "npm:@supabase/supabase-js@2";
import { purchaseEventId } from "../_shared/tracking-event-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown = {}) =>
  new Response(JSON.stringify({ success: true, ...data as object }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (error: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// cf-connecting-ip est posé par Cloudflare et ne peut pas être imposé par l'appelant ; x-forwarded-for peut l'être.
function pickIp(req: Request): string | undefined {
  const cf = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
  if (cf) return cf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return undefined;
}

// Version de l'API Graph : réglable sans redéploiement de code (secret META_GRAPH_VERSION), vérifiée avant usage.
const GRAPH_VERSION = /^v\d{2}\.\d$/.test(Deno.env.get("META_GRAPH_VERSION") ?? "")
  ? Deno.env.get("META_GRAPH_VERSION")!
  : "v23.0";

const FETCH_TIMEOUT_MS = 8000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FB_MAP: Record<string, string> = {
  PageView: "PageView", ViewContent: "ViewContent", AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout", AddPaymentInfo: "AddPaymentInfo",
  Purchase: "Purchase", Lead: "Lead", Search: "Search",
  CompleteRegistration: "CompleteRegistration",
};
const TT_MAP: Record<string, string> = {
  PageView: "Pageview", ViewContent: "ViewContent", AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout", AddPaymentInfo: "AddPaymentInfo",
  Purchase: "PlaceAnOrder", Lead: "SubmitForm", Search: "Search",
  CompleteRegistration: "CompleteRegistration",
};
const SNAP_MAP: Record<string, string> = {
  PageView: "PAGE_VIEW", ViewContent: "VIEW_CONTENT", AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT", AddPaymentInfo: "ADD_BILLING",
  Purchase: "PURCHASE", Lead: "SIGN_UP", Search: "SEARCH",
  CompleteRegistration: "SIGN_UP",
};

const ALLOWED_EVENTS = new Set<string>([
  "PageView", "ViewContent", "AddToCart", "InitiateCheckout",
  "AddPaymentInfo", "Purchase", "Lead", "Search", "CompleteRegistration",
]);
const MAX_EVENT_VALUE = 1_000_000;
// Un Purchase navigateur doit suivre de près la création de la commande ; au-delà, c'est un rejeu.
const BROWSER_PURCHASE_MAX_AGE_MS = 48 * 3600 * 1000;

// Normalisations demandées par Meta avant hachage.
const normPhone = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^00/, "");
const normName = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normCity = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const normCountry = (v: unknown) => {
  const c = String(v ?? "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(c) ? c : "";
};

// Une clé par destination serveur configurée : sert au registre des Purchase pour ne reprendre que ce qui a échoué.
// Mêmes conditions d'envoi que les blocs Meta / TikTok / Snapchat / GA4 ci-dessous.
// deno-lint-ignore no-explicit-any
const destinationKeys = (shop: any): string[] => [
  ...(shop.facebook_access_token ? (shop.facebook_pixels as string[]).map((p) => `meta:${p}`) : []),
  ...(shop.tiktok_access_token ? (shop.tiktok_pixels as string[]).map((p) => `tiktok:${p}`) : []),
  ...(shop.snapchat_access_token ? (shop.snapchat_pixels as string[]).map((p) => `snapchat:${p}`) : []),
  ...(shop.ga4_measurement_id && shop.ga4_api_secret ? ["ga4"] : []),
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { shop_id, event, event_source_url, user_agent, payload = {} } = body || {};
    // « let » : pour un Purchase, l'identifiant est recalculé côté serveur (voir plus bas), jamais celui de l'appelant.
    let event_id: string = body?.event_id;
    if (!shop_id || !event || !event_id) return fail("Missing shop_id/event/event_id");
    if (!ALLOWED_EVENTS.has(event)) return fail("invalid_event");
    if (typeof event_id !== "string" || event_id.length > 128) return fail("invalid_event_id");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Appel de confiance : un webhook du serveur (ecomfy-pay-webhook, geniuspay-webhook) qui porte la clé service_role.
    const isTrustedServer = (req.headers.get("authorization") || "") === `Bearer ${serviceKey}`;

    // IP-based rate limit: 60 req / min / IP
    const ipForLimit = pickIp(req) || "unknown";
    const { data: rl, error: rlErr } = await supabase.rpc("check_rate_limit", {
      _bucket: "track-conversion", _key: ipForLimit, _max: 60, _window_seconds: 60,
    });
    if (rl && (rl as any).allowed === false) return fail("rate_limited");
    // Limiteur indisponible : on laisse passer les événements courants, pas les Purchase venant d'un navigateur.
    if (rlErr) {
      console.error("track-conversion: check_rate_limit indisponible", rlErr.message);
      if (event === "Purchase" && !isTrustedServer) return fail("rate_limit_unavailable");
    }

    const [shopRes, secretsRes] = await Promise.all([
      supabase
        .from("shops")
        .select("id, tracking_enabled, facebook_pixels, facebook_test_event_code, tiktok_pixels, snapchat_pixels, ga4_measurement_id")
        .eq("id", shop_id)
        .maybeSingle(),
      supabase
        .from("shop_secrets")
        .select("facebook_access_token, tiktok_access_token, snapchat_access_token, ga4_api_secret, google_ads_conversion_id, google_ads_conversion_label")
        .eq("shop_id", shop_id)
        .maybeSingle(),
    ]);
    if (shopRes.error || !shopRes.data) return fail("shop_not_found");
    const shop: any = { ...shopRes.data, ...(secretsRes.data || {}) };

    // Ces identifiants sont insérés dans des URLs d'API tierces avec le jeton du marchand :
    // on ignore tout ce qui n'a pas le format attendu (mêmes règles que src/lib/trackingIds.ts, audit C8).
    const onlyValid = (ids: unknown, re: RegExp): string[] =>
      Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && re.test(id)) : [];
    shop.facebook_pixels = onlyValid(shop.facebook_pixels, /^\d{5,20}$/);
    shop.tiktok_pixels = onlyValid(shop.tiktok_pixels, /^[A-Z0-9]{8,32}$/i);
    shop.snapchat_pixels = onlyValid(shop.snapchat_pixels, /^[A-Za-z0-9-]{8,64}$/);
    if (!/^G-[A-Z0-9]{4,20}$/.test(String(shop.ga4_measurement_id ?? ""))) shop.ga4_measurement_id = null;
    // Un Purchase désactivé est quand même consigné plus bas (« skipped ») pour que la reprise ne le réexamine pas sans fin.
    if (shop.tracking_enabled === false && event !== "Purchase") return ok({ skipped: "tracking_disabled" });

    // Événement émis par un webhook : l'IP de la requête est celle du serveur, pas celle du visiteur.
    // Le webhook transmet l'IP mémorisée à l'initialisation du paiement (format IPv4/IPv6 vérifié).
    const bodyIp = typeof body?.client_ip === "string" && /^[0-9a-fA-F:.]{3,45}$/.test(body.client_ip) ? body.client_ip : undefined;
    const ip = isTrustedServer ? (bodyIp ?? pickIp(req)) : pickIp(req);
    const ts = Math.floor(Date.now() / 1000);
    let value = Number(payload.value || 0);
    if (!Number.isFinite(value) || value < 0) value = 0;
    if (value > MAX_EVENT_VALUE) return fail("value_too_high");
    const currency = /^[A-Za-z]{3}$/.test(String(payload.currency ?? "")) ? String(payload.currency).toUpperCase() : "XOF";
    const results: Record<string, unknown> = {};
    let orderIdForEvent: string | undefined = payload.order_id ? String(payload.order_id) : undefined;

    // Registre des Purchase (tracking_purchase_log) : renseigné seulement quand la réservation a réussi.
    let purchaseLedger: { orderId: string } | null = null;
    const alreadyDelivered = new Set<string>(); // destinations déjà servies lors d'une tentative précédente
    const deliveredNow: string[] = [];          // destinations servies par cet appel
    const finishPurchase = async (status: "sent" | "failed" | "skipped", delivered: string[], error?: string) => {
      if (!purchaseLedger) return;
      try {
        const { error: finErr } = await supabase.rpc("finish_purchase_send", {
          p_shop_id: shop_id, p_order_id: purchaseLedger.orderId, p_status: status, p_delivered: delivered, p_error: error ?? null,
        });
        if (finErr) console.warn("track-conversion: finish_purchase_send", finErr.message);
      } catch (e) {
        console.warn("track-conversion: finish_purchase_send en erreur", String(e));
      }
    };

    /* ---------- Purchase : doit correspondre à une vraie commande de cette boutique ---------- */
    if (event === "Purchase") {
      const ref = orderIdForEvent;
      if (!ref || ref.length > 64) return fail("order_required");
      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_method, order_status, created_at")
        .eq("shop_id", shop_id)
        .eq(UUID_RE.test(ref) ? "id" : "order_number", ref)
        .maybeSingle();
      if (!order) return fail("order_not_found");
      if (order.order_status === "cancelled") return fail("order_cancelled");
      orderIdForEvent = String(order.order_number);

      if (!isTrustedServer) {
        // Paiement en ligne : le Purchase part du webhook, à l'encaissement, jamais du navigateur.
        if (order.payment_method === "mobile_money") return fail("purchase_from_server_only");
        if (Date.now() - new Date(order.created_at).getTime() > BROWSER_PURCHASE_MAX_AGE_MS) return fail("order_too_old");
        // Le montant est celui de la commande en base, pas celui envoyé par le navigateur.
        value = Number(order.total) || 0;
      }

      // Identifiant canonique : un Purchase n'a qu'un identifiant possible par commande (le même que celui du pixel du
      // navigateur). Sans cela, un appelant pouvait rejouer la même commande avec des event_id différents et gonfler les ventes.
      event_id = purchaseEventId(order.order_number);

      // Destinations serveur réellement configurées pour cette boutique.
      const dests = destinationKeys(shop);

      // Réservation de l'envoi : déjà parti ou en cours ailleurs = on n'envoie rien. Table absente (migration non appliquée)
      // = on envoie quand même, sans registre : l'event_id canonique laisse Meta dédoublonner.
      try {
        const { data: claim, error: claimErr } = await supabase.rpc("claim_purchase_send", {
          p_shop_id: shop_id, p_order_id: order.id, p_event_id: event_id, p_source: isTrustedServer ? "server" : "browser",
        });
        if (claimErr) {
          console.warn("track-conversion: claim_purchase_send indisponible", claimErr.message);
        } else {
          purchaseLedger = { orderId: order.id };
          if ((claim as any)?.claimed === false) {
            return ok({ deduplicated: true, purchase_status: (claim as any)?.status ?? null, event_id });
          }
          for (const k of ((claim as any)?.delivered ?? []) as string[]) alreadyDelivered.add(k);
        }
      } catch (e) {
        console.warn("track-conversion: claim_purchase_send en erreur", String(e));
      }

      if (shop.tracking_enabled === false || dests.length === 0) {
        await finishPurchase("skipped", [], shop.tracking_enabled === false ? "tracking_disabled" : "no_server_destination");
        return ok({ skipped: shop.tracking_enabled === false ? "tracking_disabled" : "no_server_destination", event_id });
      }
    }

    const hashedEmail = payload.email ? await sha256(String(payload.email)) : undefined;
    const phoneDigits = normPhone(payload.phone);
    const hashedPhone = phoneDigits ? await sha256(phoneDigits) : undefined;
    const hashedFn = payload.first_name ? await sha256(normName(payload.first_name)) : undefined;
    const hashedLn = payload.last_name ? await sha256(normName(payload.last_name)) : undefined;
    const cityNorm = normCity(payload.city);
    const hashedCity = cityNorm ? await sha256(cityNorm) : undefined;
    const countryNorm = normCountry(payload.country);
    const hashedCountry = countryNorm ? await sha256(countryNorm) : undefined;
    const externalId = hashedEmail || hashedPhone;

    // Suivi de santé des envois (une ligne par boutique/plateforme/pixel) : un jeton expiré devient visible pour le marchand.
    // Best-effort : l'absence de la table ou une erreur ne doit jamais empêcher l'envoi de l'événement.
    let recordWarned = false;
    const record = async (
      provider: string, pixelId: string, delivered: boolean, httpStatus: number | null, error?: string | null, errorCode?: string | null,
    ) => {
      try {
        const { error: rpcErr } = await supabase.rpc("record_tracking_delivery", {
          p_shop_id: shop_id, p_provider: provider, p_pixel_id: pixelId, p_ok: delivered,
          p_http_status: httpStatus, p_error: error ?? null, p_error_code: errorCode ?? null, p_event: event,
        });
        if (rpcErr && !recordWarned) { recordWarned = true; console.warn("record_tracking_delivery:", rpcErr.message); }
      } catch (e) {
        if (!recordWarned) { recordWarned = true; console.warn("record_tracking_delivery:", String(e)); }
      }
    };
    const post = (url: string, init: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

    /* ---------- Meta CAPI ---------- */
    if (shop.facebook_access_token && (shop.facebook_pixels || []).length) {
      const fbName = FB_MAP[event] || event;
      const userData: Record<string, unknown> = {
        client_ip_address: ip,
        client_user_agent: user_agent,
      };
      if (hashedEmail) userData.em = [hashedEmail];
      if (hashedPhone) userData.ph = [hashedPhone];
      if (hashedFn) userData.fn = [hashedFn];
      if (hashedLn) userData.ln = [hashedLn];
      if (hashedCity) userData.ct = [hashedCity];
      if (hashedCountry) userData.country = [hashedCountry];
      if (externalId) userData.external_id = [externalId];
      if (payload.fbp) userData.fbp = payload.fbp;
      if (payload.fbc) userData.fbc = payload.fbc;

      const customData: Record<string, unknown> = {
        currency,
        value,
        content_ids: payload.content_ids,
        content_name: payload.content_name,
        content_type: payload.content_type,
        contents: payload.contents,
        num_items: payload.num_items,
        order_id: orderIdForEvent,
      };

      const fbResults: Record<string, unknown> = {};
      await Promise.all((shop.facebook_pixels as string[]).filter((p) => !alreadyDelivered.has(`meta:${p}`)).map(async (pixelId) => {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(shop.facebook_access_token)}`;
        const reqBody: Record<string, unknown> = {
          data: [{
            event_name: fbName,
            event_time: ts,
            event_id,
            event_source_url,
            action_source: "website",
            user_data: userData,
            custom_data: customData,
          }],
        };
        if (shop.facebook_test_event_code) reqBody.test_event_code = shop.facebook_test_event_code;
        try {
          const r = await post(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody) });
          const j: any = await r.json().catch(() => null);
          const received = Number(j?.events_received ?? 0);
          const delivered = r.ok && received >= 1;
          const errMsg: string | null = j?.error?.message ?? (r.ok && !delivered ? "Meta n'a enregistré aucun événement" : null);
          const errCode: string | null = j?.error?.code != null ? String(j.error.code) : null;
          fbResults[pixelId] = { status: r.status, ok: delivered, events_received: received, fbtrace_id: j?.fbtrace_id, error: errMsg, error_code: errCode };
          if (!delivered) console.error("track-conversion Meta KO", { shop_id, pixelId, event, status: r.status, error: errMsg, code: errCode, fbtrace_id: j?.fbtrace_id });
          await record("meta", pixelId, delivered, r.status, errMsg, errCode);
          if (delivered) deliveredNow.push(`meta:${pixelId}`);
        } catch (e) {
          fbResults[pixelId] = { ok: false, error: String(e) };
          console.error("track-conversion Meta exception", { shop_id, pixelId, event, error: String(e) });
          await record("meta", pixelId, false, null, String(e));
        }
      }));
      results.meta = fbResults;
    }

    /* ---------- TikTok Events API v1.3 ---------- */
    if (shop.tiktok_access_token && (shop.tiktok_pixels || []).length) {
      const ttName = TT_MAP[event] || event;
      const ttResults: Record<string, unknown> = {};
      await Promise.all((shop.tiktok_pixels as string[]).filter((p) => !alreadyDelivered.has(`tiktok:${p}`)).map(async (pixelId) => {
        const reqBody = {
          event_source: "web",
          event_source_id: pixelId,
          data: [{
            event: ttName,
            event_time: ts,
            event_id,
            user: {
              ip, user_agent,
              email: hashedEmail ? [hashedEmail] : undefined,
              phone: hashedPhone ? [hashedPhone] : undefined,
            },
            properties: {
              currency, value,
              content_id: payload.content_ids?.[0],
              content_name: payload.content_name,
              contents: payload.contents,
              order_id: orderIdForEvent,
            },
            page: { url: event_source_url },
          }],
        };
        try {
          const r = await post("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Access-Token": shop.tiktok_access_token },
            body: JSON.stringify(reqBody),
          });
          const j: any = await r.json().catch(() => null);
          const delivered = r.ok && (j?.code === undefined || j.code === 0);
          const errMsg: string | null = delivered ? null : (j?.message ?? `HTTP ${r.status}`);
          ttResults[pixelId] = { status: r.status, ok: delivered, error: errMsg };
          if (!delivered) console.error("track-conversion TikTok KO", { shop_id, pixelId, event, status: r.status, error: errMsg });
          await record("tiktok", pixelId, delivered, r.status, errMsg, j?.code != null ? String(j.code) : null);
          if (delivered) deliveredNow.push(`tiktok:${pixelId}`);
        } catch (e) {
          ttResults[pixelId] = { ok: false, error: String(e) };
          await record("tiktok", pixelId, false, null, String(e));
        }
      }));
      results.tiktok = ttResults;
    }

    /* ---------- Snapchat CAPI ---------- */
    if (shop.snapchat_access_token && (shop.snapchat_pixels || []).length) {
      const snapName = SNAP_MAP[event] || event;
      const snapResults: Record<string, unknown> = {};
      await Promise.all((shop.snapchat_pixels as string[]).filter((p) => !alreadyDelivered.has(`snapchat:${p}`)).map(async (pixelId) => {
        const reqBody = {
          data: [{
            event_name: snapName,
            event_time: ts,
            event_id,
            event_source_url,
            action_source: "WEB",
            user_data: {
              em: hashedEmail ? [hashedEmail] : undefined,
              ph: hashedPhone ? [hashedPhone] : undefined,
              client_ip_address: ip,
              client_user_agent: user_agent,
            },
            custom_data: {
              currency, value,
              order_id: orderIdForEvent,
              content_ids: payload.content_ids,
              num_items: payload.num_items,
            },
          }],
        };
        try {
          const r = await post(`https://tr.snapchat.com/v3/${pixelId}/events?access_token=${encodeURIComponent(shop.snapchat_access_token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
          });
          const errMsg = r.ok ? null : `HTTP ${r.status}`;
          snapResults[pixelId] = { status: r.status, ok: r.ok, error: errMsg };
          if (!r.ok) console.error("track-conversion Snapchat KO", { shop_id, pixelId, event, status: r.status });
          await record("snapchat", pixelId, r.ok, r.status, errMsg);
          if (r.ok) deliveredNow.push(`snapchat:${pixelId}`);
        } catch (e) {
          snapResults[pixelId] = { ok: false, error: String(e) };
          await record("snapchat", pixelId, false, null, String(e));
        }
      }));
      results.snapchat = snapResults;
    }

    /* ---------- GA4 Measurement Protocol ---------- */
    if (shop.ga4_measurement_id && shop.ga4_api_secret && !alreadyDelivered.has("ga4")) {
      const gaName =
        event === "Purchase" ? "purchase" :
        event === "AddToCart" ? "add_to_cart" :
        event === "InitiateCheckout" ? "begin_checkout" :
        event === "ViewContent" ? "view_item" :
        event === "PageView" ? "page_view" :
        event.toLowerCase();
      const cid = event_id;
      const reqBody = {
        client_id: cid,
        events: [{
          name: gaName,
          params: {
            currency, value,
            transaction_id: orderIdForEvent,
            items: payload.contents?.map((c: any) => ({
              item_id: c.id, quantity: c.quantity, price: c.item_price,
            })),
            event_id,
          },
        }],
      };
      try {
        const r = await post(
          `https://www.google-analytics.com/mp/collect?measurement_id=${shop.ga4_measurement_id}&api_secret=${encodeURIComponent(shop.ga4_api_secret)}`,
          { method: "POST", body: JSON.stringify(reqBody) },
        );
        results.ga4 = { status: r.status, ok: r.ok };
        if (!r.ok) console.error("track-conversion GA4 KO", { shop_id, event, status: r.status });
        await record("ga4", shop.ga4_measurement_id, r.ok, r.status, r.ok ? null : `HTTP ${r.status}`);
        if (r.ok) deliveredNow.push("ga4");
      } catch (e) {
        results.ga4 = { ok: false, error: String(e) };
        await record("ga4", shop.ga4_measurement_id, false, null, String(e));
      }
    }

    // Purchase : on consigne le résultat. « sent » seulement si TOUTES les destinations configurées sont servies ;
    // sinon « failed », et la reprise (ecomfy-pay-settlement) ne renverra qu'aux destinations manquantes.
    if (event === "Purchase") {
      const served = new Set([...alreadyDelivered, ...deliveredNow]);
      const missing = destinationKeys(shop).filter((k) => !served.has(k));
      await finishPurchase(missing.length === 0 ? "sent" : "failed", deliveredNow, missing.length ? `non servi : ${missing.join(", ")}` : undefined);
    }

    // Le détail (messages d'erreur des plateformes, identifiants de pixel) n'est renvoyé qu'aux appels du serveur ;
    // il est de toute façon journalisé et visible du marchand via tracking_delivery_status.
    return ok(isTrustedServer ? { event_id, results } : { event_id });
  } catch (e) {
    console.error("track-conversion error", e);
    return fail((e as Error).message || "unknown");
  }
});
