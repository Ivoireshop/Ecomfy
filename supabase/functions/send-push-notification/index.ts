import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Find shop owner + tokens
    const { data: shop } = await supabase.from("shops").select("user_id, business_name").eq("id", shop_id).maybeSingle();
    if (!shop) {
      return new Response(JSON.stringify({ success: false, error: "shop_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("fcm_token, user_agent, last_used_at")
      .eq("user_id", shop.user_id)
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
    }).slice(0, 1);

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!saJson) {
      return new Response(JSON.stringify({ success: false, error: "missing_service_account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    const sa = JSON.parse(saJson);
    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id;

    const titleText = "💰 Nouvelle commande VisualPro";
    const { data: orderDetails } = order_id
      ? await supabase
          .from("orders")
          .select("customer_name, customer_phone, customer_city, customer_country, total, order_number")
          .eq("id", order_id)
          .maybeSingle()
      : { data: null } as any;
    const oName = String(orderDetails?.customer_name || customer_name || "").trim();
    const oPhone = String(orderDetails?.customer_phone || "").trim();
    const oCity = String(orderDetails?.customer_city || "").trim();
    const oCountry = String(orderDetails?.customer_country || "").trim();
    const oPlace = [oCity, oCountry].filter(Boolean).join(", ");
    const oTotal = (orderDetails?.total ?? total) != null
      ? `${Number(orderDetails?.total ?? total).toLocaleString("fr-FR")} FCFA`
      : "";
    const bodyLines: string[] = [];
    if (oName) bodyLines.push(`👤 ${oName}`);
    if (oPhone) bodyLines.push(`📞 ${oPhone}`);
    if (oPlace) bodyLines.push(`📍 ${oPlace}`);
    if (oTotal) bodyLines.push(`💰 ${oTotal}`);
    const bodyText = bodyLines.length ? bodyLines.join("\n") : "Tu as une nouvelle commande.";
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