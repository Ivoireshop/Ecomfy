/**
 * Multi-provider client-side tracking + server-side Conversions API bridge.
 * Supports: Meta (Facebook), TikTok, Snapchat, Google Ads, GA4.
 * Each browser event is mirrored server-side with the SAME event_id for
 * deduplication (Shopify / Systeme.io behavior).
 */
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq?: any; _fbq?: any;
    ttq?: any;
    snaptr?: any;
    gtag?: any;
    dataLayer?: any[];
    __vp_pixels_loaded?: Record<string, boolean>;
  }
}

export interface ShopTracking {
  id: string;
  facebook_pixels?: string[] | null;
  tiktok_pixels?: string[] | null;
  snapchat_pixels?: string[] | null;
  google_analytics_ids?: string[] | null;
  google_analytics_code?: string | null;
  ga4_measurement_id?: string | null;
  google_ads_conversion_id?: string | null;
  tracking_enabled?: boolean | null;
}

export type TrackEvent =
  | "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout"
  | "AddPaymentInfo" | "Purchase" | "Lead" | "Search" | "CompleteRegistration";

export interface TrackPayload {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: "product" | "product_group";
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
  order_id?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  country?: string;
}

const genEventId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function ensureLoaded(key: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.__vp_pixels_loaded) window.__vp_pixels_loaded = {};
  if (window.__vp_pixels_loaded[key]) return false;
  window.__vp_pixels_loaded[key] = true;
  return true;
}

function loadFacebook(pixelId: string) {
  if (!ensureLoaded(`fb_${pixelId}`)) {
    if (window.fbq) window.fbq("init", pixelId);
    return;
  }
  (function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return;
    const n: any = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    const t: any = b.createElement(e); t.async = true; t.src = v;
    const s: any = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", pixelId);
}

function loadTikTok(pixelId: string) {
  if (!ensureLoaded(`tt_${pixelId}`)) {
    if (window.ttq?.load) window.ttq.load(pixelId);
    return;
  }
  (function (w: any, d: any, t: string) {
    w.TiktokAnalyticsObject = t;
    const ttq: any = (w[t] = w[t] || []);
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer = function (a: any, b: any) { a[b] = function () { a.push([b].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (a: any) { const e = ttq._i[a] || []; for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
    ttq.load = function (e: string, n?: any) {
      const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      const o: any = d.createElement("script"); o.type = "text/javascript"; o.async = true;
      o.src = r + "?sdkid=" + e + "&lib=" + t;
      const a: any = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, "ttq");
}

function loadSnapchat(pixelId: string) {
  if (!ensureLoaded(`sn_${pixelId}`)) {
    if (window.snaptr) window.snaptr("init", pixelId);
    return;
  }
  (function (e: any, t: any, n: string) {
    if (e.snaptr) return;
    const a: any = e.snaptr = function () {
      a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
    };
    a.queue = [];
    const s = "script"; const r: any = t.createElement(s);
    r.async = true; r.src = n;
    const u: any = t.getElementsByTagName(s)[0]; u.parentNode.insertBefore(r, u);
  })(window, document, "https://sc-static.net/scevent.min.js");
  window.snaptr("init", pixelId);
}

function loadGA4(measurementId: string) {
  if (!ensureLoaded(`ga_${measurementId}`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

export function initShopPixels(shop: ShopTracking) {
  if (typeof window === "undefined") return;
  if (shop.tracking_enabled === false) return;
  (shop.facebook_pixels || []).forEach(loadFacebook);
  (shop.tiktok_pixels || []).forEach(loadTikTok);
  (shop.snapchat_pixels || []).forEach(loadSnapchat);
  if (shop.ga4_measurement_id) loadGA4(shop.ga4_measurement_id);
  (shop.google_analytics_ids || []).forEach(loadGA4);

  if (shop.google_analytics_code && ensureLoaded("ga_custom")) {
    try {
      // If user pasted a Measurement ID (e.g. G-XXXXXXX or UA-XXXXXXX-X), load it safely via loadGA4
      const idMatch = shop.google_analytics_code.match(/\b(G-[A-Z0-9]+|UA-\d+-\d+)\b/i);
      if (idMatch) {
        loadGA4(idMatch[1]);
      } else {
        const tpl = document.createElement("template");
        tpl.innerHTML = shop.google_analytics_code;
        tpl.content.querySelectorAll("script").forEach((src) => {
          // Only execute scripts hosted on trusted google analytics/tagmanager domains
          const srcUrl = src.getAttribute("src");
          if (srcUrl && !/https?:\/\/(www\.)?(googletagmanager|google-analytics)\.com/i.test(srcUrl)) {
            return;
          }
          const s = document.createElement("script");
          for (const attr of Array.from(src.attributes)) s.setAttribute(attr.name, attr.value);
          s.text = src.textContent || "";
          document.head.appendChild(s);
        });
      }
    } catch { /* ignore */ }
  }
}

const FB_EVENT_MAP: Record<TrackEvent, string> = {
  PageView: "PageView", ViewContent: "ViewContent", AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout", AddPaymentInfo: "AddPaymentInfo",
  Purchase: "Purchase", Lead: "Lead", Search: "Search",
  CompleteRegistration: "CompleteRegistration",
};
const TT_EVENT_MAP: Record<TrackEvent, string> = {
  PageView: "Pageview", ViewContent: "ViewContent", AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout", AddPaymentInfo: "AddPaymentInfo",
  Purchase: "PlaceAnOrder", Lead: "SubmitForm", Search: "Search",
  CompleteRegistration: "CompleteRegistration",
};
const SNAP_EVENT_MAP: Record<TrackEvent, string> = {
  PageView: "PAGE_VIEW", ViewContent: "VIEW_CONTENT", AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT", AddPaymentInfo: "ADD_BILLING",
  Purchase: "PURCHASE", Lead: "SIGN_UP", Search: "SEARCH",
  CompleteRegistration: "SIGN_UP",
};

export async function trackEvent(
  shop: ShopTracking | null | undefined,
  event: TrackEvent,
  payload: TrackPayload = {}
) {
  if (!shop || shop.tracking_enabled === false || typeof window === "undefined") return;
  const eventId = genEventId();
  const currency = payload.currency || "XOF";

  try {
    const fbPayload: any = {
      value: payload.value, currency,
      content_ids: payload.content_ids,
      content_name: payload.content_name,
      content_type: payload.content_type,
      contents: payload.contents,
      num_items: payload.num_items,
      order_id: payload.order_id,
    };
    (shop.facebook_pixels || []).forEach(() => {
      window.fbq?.("track", FB_EVENT_MAP[event], fbPayload, { eventID: eventId });
    });

    (shop.tiktok_pixels || []).forEach(() => {
      window.ttq?.track?.(TT_EVENT_MAP[event], {
        value: payload.value, currency,
        contents: payload.contents,
        content_id: payload.content_ids?.[0],
        content_name: payload.content_name,
      }, { event_id: eventId });
    });

    (shop.snapchat_pixels || []).forEach(() => {
      window.snaptr?.("track", SNAP_EVENT_MAP[event], {
        price: payload.value, currency,
        item_ids: payload.content_ids,
        item_category: payload.content_type,
        transaction_id: payload.order_id,
        client_dedup_id: eventId,
      });
    });

    const gaIds = [
      shop.ga4_measurement_id,
      ...(shop.google_analytics_ids || []),
    ].filter(Boolean) as string[];
    if (window.gtag && gaIds.length) {
      const gaEvent =
        event === "Purchase" ? "purchase" :
        event === "AddToCart" ? "add_to_cart" :
        event === "InitiateCheckout" ? "begin_checkout" :
        event === "ViewContent" ? "view_item" :
        event === "PageView" ? "page_view" :
        event.toLowerCase();
      gaIds.forEach((id) => {
        window.gtag("event", gaEvent, {
          send_to: id,
          value: payload.value,
          currency,
          transaction_id: payload.order_id,
          items: payload.contents?.map((c) => ({
            item_id: c.id, quantity: c.quantity, price: c.item_price,
          })),
          event_id: eventId,
        });
      });
    }
  } catch (e) {
    console.warn("[tracking] browser pixel error", e);
  }

  try {
    void supabase.functions.invoke("track-conversion", {
      body: {
        shop_id: shop.id,
        event,
        event_id: eventId,
        event_source_url: window.location.href,
        user_agent: navigator.userAgent,
        payload: { ...payload, currency },
      },
    });
  } catch (e) {
    console.warn("[tracking] capi invoke error", e);
  }
}
