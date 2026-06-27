import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Shop-configurable order notification formatter.
// Mirror of src/lib/notificationFormat.ts — keep both in sync.
// ---------------------------------------------------------------------------
type NotifLang = "fr" | "en" | "es" | "pt" | "ar";
const DEFAULT_NOTIF = {
  enabled: true,
  language: "fr" as NotifLang,
  template: "detailed" as "detailed" | "compact" | "minimal" | "custom",
  max_products: 2,
  custom_title: "",
  include_customer_name: true,
  include_phone: true,
  include_place: true,
  include_total: true,
  include_products: true,
};
const NOTIF_DICT: Record<NotifLang, any> = {
  fr: { default_title: "💰 Nouvelle commande {shop}", fallback_body: "Tu as une nouvelle commande.", other_singular: "autre", other_plural: "autres", product_default: "produit", currency_locale: "fr-FR", fcfa: "FCFA" },
  en: { default_title: "💰 New order — {shop}", fallback_body: "You have a new order.", other_singular: "more", other_plural: "more", product_default: "item", currency_locale: "en-US", fcfa: "XOF" },
  es: { default_title: "💰 Nuevo pedido — {shop}", fallback_body: "Tienes un nuevo pedido.", other_singular: "más", other_plural: "más", product_default: "producto", currency_locale: "es-ES", fcfa: "FCFA" },
  pt: { default_title: "💰 Novo pedido — {shop}", fallback_body: "Você recebeu um novo pedido.", other_singular: "outro", other_plural: "outros", product_default: "produto", currency_locale: "pt-BR", fcfa: "FCFA" },
  ar: { default_title: "💰 طلب جديد — {shop}", fallback_body: "لديك طلب جديد.", other_singular: "آخر", other_plural: "آخرين", product_default: "منتج", currency_locale: "ar", fcfa: "FCFA" },
};
function buildOrderNotification(order: any, shopName: string, rawSettings: any) {
  const s = { ...DEFAULT_NOTIF, ...(rawSettings && typeof rawSettings === "object" ? rawSettings : {}) };
  const lang = (s.language && NOTIF_DICT[s.language as NotifLang]) ? s.language as NotifLang : "fr";
  const dict = NOTIF_DICT[lang];
  const items = Array.isArray(order.items) ? order.items : [];
  const maxN = Math.max(1, Math.min(5, Number(s.max_products) || 2));
  const firstProductName = String(items[0]?.product_name || "").trim();
  let productLine = "";
  if (items.length > 0 && s.include_products) {
    if (items.length === 1 || maxN === 1) {
      const q = Number(items[0]?.quantity || 1);
      productLine = `📦 ${q}× ${firstProductName || dict.product_default}`;
      const extra = Math.max(0, items.length - 1);
      if (extra > 0) productLine += ` +${extra} ${extra > 1 ? dict.other_plural : dict.other_singular}`;
    } else {
      const head = items.slice(0, maxN).map((it: any) => {
        const q = Number(it?.quantity || 1);
        const n = String(it?.product_name || dict.product_default).trim();
        return `${q}× ${n}`;
      }).join(", ");
      const extra = Math.max(0, items.length - maxN);
      productLine = `📦 ${head}${extra > 0 ? ` +${extra} ${extra > 1 ? dict.other_plural : dict.other_singular}` : ""}`;
    }
  }
  const name = String(order.customer_name || "").trim();
  const phone = String(order.customer_phone || "").trim();
  const city = String(order.customer_city || "").trim();
  const country = String(order.customer_country || "").trim();
  const place = [city, country].filter(Boolean).join(", ");
  const totalNum = order.total != null && order.total !== "" ? Number(order.total) : NaN;
  const total = Number.isFinite(totalNum) ? `${totalNum.toLocaleString(dict.currency_locale)} ${dict.fcfa}` : "";
  const rawTitle = (s.template === "custom" && s.custom_title?.trim()) ? s.custom_title.trim() : dict.default_title;
  const title = rawTitle.replace(/\{shop\}/g, shopName || "").trim().replace(/\s+—\s*$/, "");
  const want = {
    name: s.include_customer_name && s.template !== "minimal",
    phone: s.include_phone && (s.template === "detailed" || s.template === "custom"),
    place: s.include_place && s.template !== "minimal",
    total: s.include_total,
    products: s.include_products,
  };
  const lines: string[] = [];
  if (want.name && name) lines.push(`👤 ${name}`);
  if (want.products && productLine) lines.push(productLine);
  if (want.phone && phone) lines.push(`📞 ${phone}`);
  if (want.place && place) lines.push(`📍 ${place}`);
  if (want.total && total) lines.push(`💰 ${total}`);
  const body = lines.length ? lines.join("\n") : dict.fallback_body;
  return { title, body, productLine, firstProductName };
}

// Build a Google OAuth2 access token from the service account JSON, using JWT Bearer flow.
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claim)}`;

  // Import RSA private key (PKCS#8 PEM)
  const pem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("oauth_failed: " + JSON.stringify(json));
  return json.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Anti-spam: require an Authorization header. The DB trigger calls with the anon key,
    // which is acceptable; anonymous direct callers without any header are rejected.
    const authHeader = req.headers.get("Authorization") || req.headers.get("apikey");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    const body = await req.json().catch(() => ({}));
    const { order_id, shop_id, customer_name, total, order_number } = body;

    if (!shop_id) {
      return new Response(JSON.stringify({ success: false, error: "missing_shop_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find shop owner + tokens + notification preferences
    const { data: shop } = await supabase
      .from("shops")
      .select("user_id, business_name, notification_settings, is_suspended")
      .eq("id", shop_id)
      .maybeSingle();
    if (!shop) {
      return new Response(JSON.stringify({ success: false, error: "shop_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Allow merchants to fully disable push notifications per shop.
    let notifSettings = (shop as any).notification_settings || {};
    const shopLocked = !!(shop as any).is_suspended;
    // When the seller dashboard is locked for unpaid commissions, force a
    // redacted notification: the merchant must NOT see customer details
    // (name, phone, address, order content) until they settle the balance.
    if (shopLocked) {
      notifSettings = {
        ...notifSettings,
        template: "minimal",
        include_customer_name: false,
        include_phone: false,
        include_place: false,
        include_total: false,
        include_products: false,
      };
    }
    if (notifSettings && notifSettings.enabled === false) {
      return new Response(JSON.stringify({ success: true, sent: 0, info: "notifications_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("fcm_token, user_agent, last_used_at")
      .in("user_id", await (async () => {
        const ids: string[] = [shop.user_id];
        const { data: collabs } = await supabase
          .from("shop_collaborators")
          .select("user_id")
          .eq("shop_id", shop_id)
          .eq("status", "active")
          .not("user_id", "is", null);
        for (const c of (collabs || []) as Array<{ user_id: string | null }>) {
          if (c.user_id && !ids.includes(c.user_id)) ids.push(c.user_id);
        }
        return ids;
      })())
      .order("last_used_at", { ascending: false });

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, info: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const seenTokens = new Set<string>();
    const seenDevices = new Set<string>();
    const uniqueTokens = tokens.filter((t: any) => {
      if (!t.fcm_token || seenTokens.has(t.fcm_token)) return false;
      const deviceKey = String(t.user_agent || t.fcm_token);
      if (seenDevices.has(deviceKey)) return false;
      seenTokens.add(t.fcm_token);
      seenDevices.add(deviceKey);
      return true;
    });

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!saJson) {
      return new Response(JSON.stringify({ success: false, error: "missing_service_account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    const sa = JSON.parse(saJson);
    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id;

    const { data: orderDetails } = order_id
      ? await supabase
          .from("orders")
          .select("customer_name, customer_phone, customer_city, customer_country, total, order_number")
          .eq("id", order_id)
          .maybeSingle()
      : { data: null } as any;

    // Fetch ordered items to mention the product(s) in the notification
    const { data: itemRows } = order_id
      ? await supabase
          .from("order_items")
          .select("product_name, quantity")
          .eq("order_id", order_id)
          .order("created_at", { ascending: true })
      : { data: null } as any;
    const items = (itemRows || []) as Array<{ product_name: string | null; quantity: number | null }>;

    // Build title + body using shop-specific notification settings.
    // This mirrors src/lib/notificationFormat.ts (keep in sync).
    const built = buildOrderNotification(
      {
        customer_name: orderDetails?.customer_name ?? customer_name,
        customer_phone: orderDetails?.customer_phone,
        customer_city: orderDetails?.customer_city,
        customer_country: orderDetails?.customer_country,
        total: orderDetails?.total ?? total,
        items,
      },
      String(shop.business_name || ""),
      notifSettings,
    );
    const titleText = built.title || "💰 Nouvelle commande";
    const bodyText = built.body;
    const productLine = built.productLine;
    const firstProductName = built.firstProductName;
    const clickUrl = `/shop-editor/${shop_id}`;
    const notificationTag = `visualpro-order-${order_id || Date.now()}`;

    let sent = 0;
    const failed: string[] = [];

    await Promise.all(uniqueTokens.map(async (t: any) => {
      const message = {
        message: {
          token: t.fcm_token,
          webpush: {
            notification: {
              title: titleText,
              body: bodyText,
              icon: "/app-icon-512.png",
              badge: "/app-icon-512.png",
              requireInteraction: true,
              renotify: false,
              silent: false,
              vibrate: [300, 80, 300, 80, 700],
              tag: notificationTag,
            },
            fcm_options: { link: clickUrl },
          },
          android: {
            collapse_key: notificationTag,
            priority: "HIGH",
            notification: {
              title: titleText,
              body: bodyText,
              tag: notificationTag,
              channel_id: "visualpro_orders",
              sound: "visualpro_cash",
              default_vibrate_timings: false,
              vibrate_timings: ["0s", "0.3s", "0.08s", "0.3s", "0.08s", "0.7s"],
              notification_priority: "PRIORITY_MAX",
              visibility: "PUBLIC",
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
              "apns-collapse-id": notificationTag,
            },
            payload: {
              aps: {
                alert: { title: titleText, body: bodyText },
                sound: {
                  critical: 0,
                  name: "visualpro_cash.wav",
                  volume: 1.0,
                },
                "interruption-level": "time-sensitive",
                "thread-id": notificationTag,
                badge: 1,
              },
            },
          },
          data: {
            title: titleText,
            body: bodyText,
            order_id: String(order_id || ""),
            shop_id: String(shop_id),
            customer_name: String(orderDetails?.customer_name || customer_name || ""),
            customer_phone: String(orderDetails?.customer_phone || ""),
            customer_city: String(orderDetails?.customer_city || ""),
            customer_country: String(orderDetails?.customer_country || ""),
            total: String(orderDetails?.total ?? total ?? ""),
            order_number: String(orderDetails?.order_number || order_number || ""),
            product_name: String(firstProductName || ""),
            product_line: String(productLine || ""),
            url: clickUrl,
          },
        },
      };
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        },
      );
      if (res.ok) {
        sent++;
      } else {
        const txt = await res.text();
        failed.push(txt.slice(0, 200));
        // Only remove the token when FCM explicitly says it is invalid
        // (UNREGISTERED / INVALID_ARGUMENT for the registration token).
        // 400 alone can be transient (payload, throttling) and previously
        // wiped valid tokens — never deleting them again until the user
        // manually re-registered.
        const isUnregistered = res.status === 404 ||
          /UNREGISTERED|registration-token-not-registered|NOT_FOUND/i.test(txt);
        const isInvalidToken = res.status === 400 &&
          /invalid.*registration|INVALID_ARGUMENT.*token/i.test(txt);
        if (isUnregistered || isInvalidToken) {
          console.log("[push] removing invalid token", txt.slice(0, 200));
          await supabase.from("device_tokens").delete().eq("fcm_token", t.fcm_token);
        } else {
          console.warn("[push] FCM error (token kept)", res.status, txt.slice(0, 200));
        }
      }
    }));

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[push]", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});