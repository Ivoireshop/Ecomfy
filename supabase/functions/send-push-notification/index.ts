import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { order_id, shop_id: bodyShopId } = body;

    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ success: false, error: "missing_order_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orderRow } = await supabase
      .from("orders")
      .select("id, shop_id, customer_name, customer_phone, customer_city, customer_country, total, order_number")
      .eq("id", order_id)
      .maybeSingle();

    if (!orderRow) {
      return new Response(JSON.stringify({ success: false, error: "order_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    if (bodyShopId && String(bodyShopId) !== String(orderRow.shop_id)) {
      return new Response(JSON.stringify({ success: false, error: "shop_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    const shop_id = orderRow.shop_id;

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

    let notifSettings = (shop as any).notification_settings || {};
    const shopLocked = !!(shop as any).is_suspended;
    
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

    // Get Web Push subscriptions instead of FCM tokens
    const { data: tokens } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
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
      })());

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, info: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { data: itemRows } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", order_id)
      .order("created_at", { ascending: true });
    const items = (itemRows || []) as Array<{ product_name: string | null; quantity: number | null }>;

    const built = buildOrderNotification(
      {
        customer_name: orderRow?.customer_name,
        customer_phone: orderRow?.customer_phone,
        customer_city: orderRow?.customer_city,
        customer_country: orderRow?.customer_country,
        total: orderRow?.total,
        items,
      },
      String(shop.business_name || ""),
      notifSettings,
    );

    const titleText = shopLocked
      ? "🔒 Nouvelle commande reçue"
      : (built.title || "💰 Nouvelle commande");
    const bodyText = shopLocked
      ? "Réglez votre montant dû pour voir les détails de la commande."
      : built.body;
    const clickUrl = `/shop-editor/${shop_id}`;
    
    // Configure Web Push VAPID
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("[push] Missing VAPID keys in environment variables!");
      return new Response(JSON.stringify({ success: false, error: "missing_vapid_keys" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    
    webpush.setVapidDetails(
      'mailto:contact@visualpro.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: titleText,
      body: bodyText,
      icon: "/app-icon-512.png",
      badge: "/app-icon-512.png",
      url: clickUrl,
      order_id: String(order_id),
      shop_id: String(shop_id),
      customer_phone: String(orderRow?.customer_phone || "")
    });

    let sent = 0;
    const failed: string[] = [];

    await Promise.all(tokens.map(async (t: any) => {
      try {
        const pushSubscription = {
          endpoint: t.endpoint,
          keys: {
            p256dh: t.p256dh,
            auth: t.auth
          }
        };
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (error: any) {
        failed.push(error.message || String(error));
        // Remove expired/invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log("[push] Removing expired/invalid endpoint:", t.endpoint);
          await supabase.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
        } else {
          console.warn("[push] WebPush error (kept in DB):", error.statusCode, error);
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