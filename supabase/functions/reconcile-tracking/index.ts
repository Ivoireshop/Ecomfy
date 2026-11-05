// Réconciliation commandes Ecomfy ↔ achats Meta (lecture seule).
//
// Principe : on ne présente que des chiffres réellement mesurés.
//  - Côté Ecomfy : les commandes de la base.
//  - Côté Meta : les achats ATTRIBUÉS aux publicités par l'API Insights du compte publicitaire lié (ad_accounts).
//    Ce n'est pas le nombre d'événements CAPI reçus (Meta ne l'expose pas par cette API) : l'écart avec les commandes
//    mélange donc événements perdus, ventes non attribuées à une publicité et ventes hors publicité.
//  - Sans compte publicitaire lié ou si l'API refuse la requête : les valeurs Meta sont null, jamais estimées.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Même règle que track-conversion : réglable par le secret META_GRAPH_VERSION, v23.0 par défaut.
const GRAPH_VERSION = /^v\d{2}\.\d$/.test(Deno.env.get("META_GRAPH_VERSION") ?? "")
  ? Deno.env.get("META_GRAPH_VERSION")!
  : "v23.0";

interface ReconcileRequest {
  shop_id?: string;
  days?: number; // 7 ou 30
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ success: false, error: "Non authentifié" }, 401);

    const { shop_id, days: rawDays = 7 }: ReconcileRequest = await req.json().catch(() => ({}));
    if (!shop_id) return json({ success: false, error: "shop_id requis" }, 400);
    const days = rawDays === 30 ? 30 : 7;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Propriétaire de la boutique. Les jetons ne sont plus dans `shops` mais dans `shop_secrets`.
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .select("id, user_id, facebook_pixels")
      .eq("id", shop_id)
      .maybeSingle();
    if (shopErr) {
      console.error("[reconcile-tracking] shops:", shopErr);
      return json({ success: false, error: "Lecture de la boutique impossible" }, 500);
    }
    if (!shop || shop.user_id !== user.id) {
      return json({ success: false, error: "Boutique non trouvée ou accès refusé" }, 403);
    }

    const [{ data: secrets }, { data: adAccounts }] = await Promise.all([
      admin.from("shop_secrets").select("facebook_access_token").eq("shop_id", shop_id).maybeSingle(),
      admin
        .from("ad_accounts")
        .select("account_id, access_token")
        .eq("shop_id", shop_id)
        .eq("provider", "meta")
        .eq("is_active", true),
    ]);

    // Période (UTC)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(endDate.getUTCDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    const { data: ordersData, error: ordersErr } = await admin
      .from("orders")
      .select("id, order_number, total, order_status, payment_status, payment_method, created_at")
      .eq("shop_id", shop_id)
      .gte("created_at", startDateStr)
      .lte("created_at", endDateStr)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (ordersErr) throw new Error(`Erreur lors de la récupération des commandes: ${ordersErr.message}`);
    const orders = ordersData || [];

    // Commandes qui doivent produire un Purchase : ni annulées, ni échouées, et — pour le paiement en ligne — payées
    // (le Purchase part à l'encaissement ; à la livraison il part à la création de la commande).
    const referenceOrders = orders.filter(
      (o) =>
        o.order_status !== "cancelled" &&
        o.payment_status !== "failed" &&
        !(o.payment_method === "mobile_money" && String(o.payment_status || "").toLowerCase() !== "paid"),
    );
    const refOrdersCount = referenceOrders.length;

    // ---------- Meta Insights (achats attribués) ----------
    const account = adAccounts?.[0];
    const metaToken: string | undefined = account?.access_token || secrets?.facebook_access_token || undefined;
    let metaApiConnected = false;
    let metaErrorMessage: string | null = null;
    const metaByDay: Record<string, number> = {};

    if (!account?.account_id) {
      metaErrorMessage = "Aucun compte publicitaire Meta lié à cette boutique : les achats Meta ne peuvent pas être comptés.";
    } else if (!metaToken) {
      metaErrorMessage = "Aucun jeton d'accès Meta disponible pour ce compte publicitaire.";
    } else {
      try {
        const actId = String(account.account_id).startsWith("act_") ? String(account.account_id) : `act_${account.account_id}`;
        const params = new URLSearchParams({
          fields: "actions",
          time_increment: "1",
          time_range: JSON.stringify({ since: startDateStr.split("T")[0], until: endDateStr.split("T")[0] }),
          limit: "100",
          access_token: metaToken,
        });
        const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${actId}/insights?${params.toString()}`);
        const metaJson = await metaRes.json().catch(() => ({}));
        if (metaRes.ok && Array.isArray(metaJson.data)) {
          metaApiConnected = true;
          for (const row of metaJson.data) {
            const actions: Array<{ action_type: string; value: string }> = row.actions || [];
            // « purchase » regroupe pixel et serveur ; on ne cumule jamais les deux types (même événements comptés deux fois).
            const a =
              actions.find((x) => x.action_type === "purchase") ||
              actions.find((x) => x.action_type === "offsite_conversion.fb_pixel_purchase");
            metaByDay[row.date_start] = (metaByDay[row.date_start] || 0) + (a ? Number(a.value || 0) : 0);
          }
        } else {
          metaErrorMessage = metaJson?.error?.message || `L'API Meta a répondu ${metaRes.status}.`;
        }
      } catch (err: any) {
        metaErrorMessage = err?.message || "Échec de connexion à l'API Meta Graph";
      }
    }

    // ---------- Comparaison jour par jour ----------
    const dailyMap: Record<string, { ecomfy: number }> = {};
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      dailyMap[d.toISOString().split("T")[0]] = { ecomfy: 0 };
    }
    for (const o of referenceOrders) {
      const k = String(o.created_at).split("T")[0];
      if (dailyMap[k]) dailyMap[k].ecomfy += 1;
    }

    let daysMetaAbove = 0;
    const dailyBreakdown = Object.entries(dailyMap).map(([date, v]) => {
      const meta = metaApiConnected ? (metaByDay[date] ?? 0) : null;
      const delta = meta === null ? null : v.ecomfy - meta;
      if (meta !== null && meta > v.ecomfy) daysMetaAbove += 1;
      return {
        date,
        ecomfy_orders: v.ecomfy,
        meta_purchases: meta,
        delta_abs: delta,
        delta_pct: delta === null || v.ecomfy === 0 ? null : Number(((delta / v.ecomfy) * 100).toFixed(2)),
      };
    });

    const metaTotal = metaApiConnected ? Object.values(metaByDay).reduce((s, n) => s + n, 0) : null;

    // Commandes récentes avec l'event_id attendu côté Meta (à retrouver dans le Gestionnaire d'événements).
    const sampleOrders = orders.slice(-20).reverse().map((o) => ({
      order_number: o.order_number,
      date: o.created_at,
      montant: o.total,
      currency: "XOF",
      order_status: o.order_status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      event_id: `ord_${String(o.order_number).replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    }));

    return json({
      success: true,
      report: {
        period: { startDate: startDateStr, endDate: endDateStr, days, timezone: "UTC" },
        ecomfy_reference: {
          total_orders_recorded: orders.length,
          reference_orders_count: refOrdersCount,
          paid_orders_count: orders.filter((o) => o.payment_status === "paid").length,
          pending_orders_count: orders.filter((o) => o.payment_status === "pending").length,
          cancelled_orders_count: orders.filter((o) => o.order_status === "cancelled").length,
        },
        meta_telemetry: {
          api_connected: metaApiConnected,
          pixel_configured: Array.isArray(shop.facebook_pixels) && shop.facebook_pixels.length > 0,
          access_token_configured: !!metaToken,
          ad_account_linked: !!account?.account_id,
          error_message: metaErrorMessage,
        },
        kpis: {
          meta_purchases_attributed: metaTotal,
          // Part des commandes de référence retrouvée dans les achats attribués par Meta (null si Meta n'est pas lisible).
          attributed_share_pct:
            metaTotal === null || refOrdersCount === 0 ? null : Number(((metaTotal / refOrdersCount) * 100).toFixed(2)),
          days_meta_above_ecomfy: metaApiConnected ? daysMetaAbove : null,
        },
        daily_breakdown: dailyBreakdown,
        sample_orders: sampleOrders,
      },
    });
  } catch (err: any) {
    console.error("[reconcile-tracking] error:", err);
    return json({ success: false, error: err?.message || "Erreur interne" }, 500);
  }
});
