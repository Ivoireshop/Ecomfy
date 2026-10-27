import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthorizedCron, cronUnauthorizedResponse } from "../_shared/cron-auth.ts";
import { APP_URL } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

const CAT_LABELS: Record<string, string> = {
  ads: "Publicité",
  stock: "Achat de stock",
  shipping: "Livraison",
  salary: "Salaires / Personnel",
  other: "Autres",
};

// Mêmes règles que la page Finance (src/lib/shopFinance.ts) : le courriel doit annoncer les chiffres du tableau de bord.
const XOF_PER_UNIT: Record<string, number> = { XOF: 1, XAF: 1, FCFA: 1, EUR: 655.957 };
const toFcfa = (amount: number, currency: string | null): number | null => {
  const rate = XOF_PER_UNIT[String(currency || "XOF").toUpperCase()];
  return rate === undefined ? null : (Number(amount) || 0) * rate;
};
const isCashedIn = (o: any) =>
  o.order_status === "delivered" && !["refunded", "failed"].includes(String(o.payment_status || "").toLowerCase());

// PostgREST plafonne chaque réponse à 1 000 lignes : lecture par pages pour ne pas tronquer une semaine chargée.
async function fetchAll(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const page = await build().range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    rows.push(...(page.data || []));
    if (!page.data || page.data.length < 1000) break;
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const singleShopId: string | undefined = body?.shop_id;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Deux appelants : le planificateur (toutes les boutiques) ou le propriétaire qui teste l'envoi pour sa boutique.
  // Le bouton « Tester l'envoi » envoie le jeton de l'utilisateur, que isAuthorizedCron refusait : il échouait toujours en 401.
  const isCron = isAuthorizedCron(req);
  const isTest = !isCron;
  if (isTest) {
    if (!singleShopId || body?.test !== true) return cronUnauthorizedResponse(corsHeaders);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return reply({ success: false, error: "Non authentifié" });
    const { data: owned } = await supabase.from("shops").select("id").eq("id", singleShopId).eq("user_id", userData.user.id).maybeSingle();
    if (!owned) return reply({ success: false, error: "Accès refusé" });
  }

  // Fenêtre de 7 jours calendaires (aujourd'hui et les 6 précédents), comme le filtre « 7 Jours » de la page Finance.
  const now = new Date();
  const sinceDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)).toISOString().slice(0, 10);
  const sinceTs = `${sinceDay}T00:00:00Z`;

  let secretsQuery = supabase
    .from("shop_secrets")
    .select("shop_id,weekly_finance_email,weekly_finance_email_enabled")
    .eq("weekly_finance_email_enabled", true);
  if (singleShopId) secretsQuery = secretsQuery.eq("shop_id", singleShopId);
  const { data: secretsRows, error: secretsError } = await secretsQuery;
  if (secretsError) return reply({ success: false, error: secretsError.message });

  const enabledShopIds = (secretsRows || []).map((s: any) => s.shop_id);
  const secretsByShop: Record<string, any> = {};
  (secretsRows || []).forEach((s: any) => { secretsByShop[s.shop_id] = s; });

  if (enabledShopIds.length === 0) {
    return reply(isTest
      ? { success: false, error: "L'envoi automatique n'est pas activé pour cette boutique." }
      : { success: true, sent: 0, errors: [] });
  }

  const { data: shops, error } = await supabase
    .from("shops")
    .select("id,business_name,user_id,commission_balance_due,slug")
    .in("id", enabledShopIds);
  if (error) return reply({ success: false, error: error.message });

  let sent = 0;
  let alreadySent = 0;
  const errors: string[] = [];

  for (const shop of shops || []) {
    try {
      // Resolve recipient
      const shopSecrets = secretsByShop[shop.id] || {};
      let recipient = (shopSecrets.weekly_finance_email as string | null) || null;
      if (!recipient) {
        const { data: prof } = await supabase
          .from("profiles").select("email").eq("id", shop.user_id).maybeSingle();
        recipient = prof?.email || null;
      }
      if (!recipient) { errors.push(`${shop.id}: aucune adresse de réception`); continue; }

      // Anti-doublon. La clé d'idempotence ne dédoublonne rien : la file d'envoi ne contrôle que `message_id` (unique par envoi)
      // et la transmet au prestataire. Deux jobs planifiés ou deux appels rapprochés enverraient donc deux courriels.
      // Test manuel : un résumé toutes les 5 minutes (sinon on inonde une adresse) ; planificateur : un par heure.
      {
        const windowMs = isTest ? 5 * 60 * 1000 : 60 * 60 * 1000;
        const recent = new Date(Date.now() - windowMs).toISOString();
        const { count } = await supabase.from("email_send_log").select("id", { count: "exact", head: true })
          .eq("template_name", "finance-weekly-summary").eq("recipient_email", recipient).gte("created_at", recent);
        if ((count || 0) > 0) {
          if (isTest) errors.push("Un résumé vient d'être envoyé : patientez quelques minutes avant un nouveau test.");
          else alreadySent++;
          continue;
        }
      }

      const [orders, expenses, payments, adRows] = await Promise.all([
        fetchAll(() => supabase.from("orders").select("id,total,order_status,payment_status,created_at").eq("shop_id", shop.id).gte("created_at", sinceTs).order("created_at").order("id")),
        fetchAll(() => supabase.from("shop_expenses").select("id,category,amount,expense_date").eq("shop_id", shop.id).gte("expense_date", sinceDay).order("expense_date").order("id")),
        fetchAll(() => supabase.from("commission_payments").select("id,amount,created_at").eq("shop_id", shop.id).eq("status", "paid").gte("created_at", sinceTs).order("created_at").order("id")),
        fetchAll(() => supabase.from("ad_spend_daily").select("id,amount,currency").eq("shop_id", shop.id).gte("spend_date", sinceDay).order("spend_date").order("id")),
      ]);

      const confirmed = orders.filter((o: any) => ["confirmed", "processing", "shipped", "delivered"].includes(o.order_status));
      const delivered = orders.filter((o: any) => o.order_status === "delivered");
      const cashIn = orders.filter(isCashedIn).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const revenue = confirmed.reduce((s: number, o: any) => s + Number(o.total || 0), 0);

      // Dépenses publicitaires synchronisées : absentes du courriel jusqu'ici, qui annonçait donc un bénéfice trop haut.
      let adSpend = 0;
      const skipped = new Set<string>();
      adRows.forEach((a: any) => {
        const converted = toFcfa(a.amount, a.currency);
        if (converted === null) skipped.add(String(a.currency).toUpperCase());
        else adSpend += converted;
      });

      const expByCat: Record<string, number> = {};
      expenses.forEach((e: any) => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); });
      if (adSpend > 0) expByCat["ads"] = (expByCat["ads"] || 0) + adSpend;

      const operatingExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0) + adSpend;
      const platformFees = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const totalExpenses = operatingExpenses + platformFees;
      const commissionDue = Number(shop.commission_balance_due) || 0;
      const profit = cashIn - totalExpenses;

      const templateData = {
        shopName: shop.business_name || "Votre boutique",
        periodLabel: "7 derniers jours",
        ordersCount: orders.length,
        deliveredCount: delivered.length,
        revenue: fmt(revenue),
        cashIn: fmt(cashIn),
        totalExpenses: fmt(totalExpenses),
        platformFees: fmt(platformFees),
        commissionDue: fmt(commissionDue),
        profit: fmt(profit),
        profitPositive: profit >= 0,
        expByCat: Object.entries(expByCat).map(([k, v]) => ({ label: CAT_LABELS[k] || k, amount: fmt(v) })),
        warning: skipped.size > 0
          ? `Des dépenses publicitaires en ${Array.from(skipped).join(", ")} ne sont pas converties en FCFA : elles sont exclues de ces totaux.`
          : undefined,
        shopUrl: `${APP_URL}/shop-editor/${shop.id}`,
      };

      const idempotencyKey = isTest
        ? `finance-test-${shop.id}-${Date.now()}`
        : `finance-${shop.id}-${now.toISOString().slice(0, 10)}`;

      const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "finance-weekly-summary",
          recipientEmail: recipient,
          idempotencyKey,
          templateData,
        },
      });
      if (sendErr) { errors.push(`${shop.id}: ${sendErr.message}`); continue; }
      // La fonction répond 200 même quand rien n'est parti (adresse désinscrite, envoi neutralisé hors production) :
      // ces cas ne sont pas des envois.
      if (!sendData?.success) { errors.push(`${shop.id}: ${sendData?.reason || sendData?.error || "envoi refusé"}`); continue; }
      if (sendData.suppressed) { errors.push(`${shop.id}: envoi neutralisé (environnement hors production)`); continue; }
      sent++;
    } catch (e) {
      errors.push(`${shop.id}: ${String(e)}`);
    }
  }

  return reply({ success: true, sent, skipped: alreadySent, errors });
});
