// Server-side Conversions API bridge for Meta, TikTok, Snapchat, GA4.
// Each event arrives with the same event_id used by the browser pixel,
// allowing the ad platforms to deduplicate.
import { createClient } from "npm:@supabase/supabase-js@2";

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

function pickIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || undefined;
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { shop_id, event, event_id, event_source_url, user_agent, payload = {} } = body || {};
    if (!shop_id || !event || !event_id) return fail("Missing shop_id/event/event_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: shop, error } = await supabase
      .from("shops")
      .select("id, tracking_enabled, facebook_pixels, facebook_access_token, facebook_test_event_code, tiktok_pixels, tiktok_access_token, snapchat_pixels, snapchat_access_token, ga4_measurement_id, ga4_api_secret, google_ads_conversion_id, google_ads_conversion_label")
      .eq("id", shop_id)
      .maybeSingle();

    if (error || !shop) return fail("shop_not_found");
    if (shop.tracking_enabled === false) return ok({ skipped: "tracking_disabled" });

    const ip = pickIp(req);
    const ts = Math.floor(Date.now() / 1000);
    const value = Number(payload.value || 0);
    const currency = payload.currency || "XOF";
    const results: Record<string, unknown> = {};

    const hashedEmail = payload.email ? await sha256(String(payload.email)) : undefined;
    const hashedPhone = payload.phone ? await sha256(String(payload.phone).replace(/\D/g, "")) : undefined;
    const hashedFn = payload.first_name ? await sha256(String(payload.first_name)) : undefined;
    const hashedLn = payload.last_name ? await sha256(String(payload.last_name)) : undefined;
    const hashedCity = payload.city ? await sha256(String(payload.city)) : undefined;
    const hashedCountry = payload.country ? await sha256(String(payload.country)) : undefined;

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

      const customData: Record<string, unknown> = {
        currency,
        value,
        content_ids: payload.content_ids,
        content_name: payload.content_name,
        content_type: payload.content_type,
        contents: payload.contents,
        num_items: payload.num_items,
        order_id: payload.order_id,
      };

      const fbResults: Record<string, unknown> = {};
      for (const pixelId of shop.facebook_pixels) {
        const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(shop.facebook_access_token)}`;
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
          const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody) });
          fbResults[pixelId] = { status: r.status };
        } catch (e) {
          fbResults[pixelId] = { error: String(e) };
        }
      }
      results.meta = fbResults;
    }

    /* ---------- TikTok Events API v1.3 ---------- */
    if (shop.tiktok_access_token && (shop.tiktok_pixels || []).length) {
      const ttName = TT_MAP[event] || event;
      const ttResults: Record<string, unknown> = {};
      for (const pixelId of shop.tiktok_pixels) {
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
              order_id: payload.order_id,
            },
            page: { url: event_source_url },
          }],
        };
        try {
          const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Access-Token": shop.tiktok_access_token },
            body: JSON.stringify(reqBody),
          });
          ttResults[pixelId] = { status: r.status };
        } catch (e) {
          ttResults[pixelId] = { error: String(e) };
        }
      }
      results.tiktok = ttResults;
    }

    /* ---------- Snapchat CAPI ---------- */
    if (shop.snapchat_access_token && (shop.snapchat_pixels || []).length) {
      const snapName = SNAP_MAP[event] || event;
      const snapResults: Record<string, unknown> = {};
      for (const pixelId of shop.snapchat_pixels) {
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
              order_id: payload.order_id,
              content_ids: payload.content_ids,
              num_items: payload.num_items,
            },
          }],
        };
        try {
          const r = await fetch(`https://tr.snapchat.com/v3/${pixelId}/events?access_token=${encodeURIComponent(shop.snapchat_access_token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
          });
          snapResults[pixelId] = { status: r.status };
        } catch (e) {
          snapResults[pixelId] = { error: String(e) };
        }
      }
      results.snapchat = snapResults;
    }

    /* ---------- GA4 Measurement Protocol ---------- */
    if (shop.ga4_measurement_id && shop.ga4_api_secret) {
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
            transaction_id: payload.order_id,
            items: payload.contents?.map((c: any) => ({
              item_id: c.id, quantity: c.quantity, price: c.item_price,
            })),
            event_id,
          },
        }],
      };
      try {
        const r = await fetch(
          `https://www.google-analytics.com/mp/collect?measurement_id=${shop.ga4_measurement_id}&api_secret=${shop.ga4_api_secret}`,
          { method: "POST", body: JSON.stringify(reqBody) },
        );
        results.ga4 = { status: r.status };
      } catch (e) {
        results.ga4 = { error: String(e) };
      }
    }

    return ok({ event_id, results });
  } catch (e) {
    console.error("track-conversion error", e);
    return fail((e as Error).message || "unknown");
  }
});
