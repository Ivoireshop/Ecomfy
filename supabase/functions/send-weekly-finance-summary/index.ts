import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

const CAT_LABELS: Record<string, string> = {
  ads: "Publicité",
  stock: "Achat de stock",
  shipping: "Livraison",
  salary: "Salaires / Personnel",
  other: "Autres",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional: process a single shop if id provided (manual trigger / test)
  let body: any = {};
  try { body = await req.json(); } catch {}
  const singleShopId: string | undefined = body?.shop_id;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("shops")
    .select("id,business_name,user_id,weekly_finance_email,weekly_finance_email_enabled,commission_balance_due,slug")
    .eq("weekly_finance_email_enabled", true);
  if (singleShopId) query = query.eq("id", singleShopId);

  const { data: shops, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const shop of shops || []) {
    try {
      // Resolve recipient
      let recipient = shop.weekly_finance_email as string | null;
      if (!recipient) {
        const { data: prof } = await supabase
          .from("profiles").select("email").eq("id", shop.user_id).maybeSingle();
        recipient = prof?.email || null;
      }
      if (!recipient) { errors.push(`${shop.id}: no recipient`); continue; }

      const [ordersRes, expRes, payRes] = await Promise.all([
        supabase.from("orders").select("total,order_status,created_at").eq("shop_id", shop.id).gte("created_at", since),
        supabase.from("shop_expenses").select("category,amount,expense_date").eq("shop_id", shop.id).gte("expense_date", since.slice(0, 10)),
        supabase.from("commission_payments").select("amount,created_at,status").eq("shop_id", shop.id).eq("status", "paid").gte("created_at", since),
      ]);

      const orders = ordersRes.data || [];
      const expenses = expRes.data || [];
      const payments = payRes.data || [];

      const confirmed = orders.filter((o: any) => ["confirmed","processing","shipped","delivered"].includes(o.order_status));
      const delivered = orders.filter((o: any) => o.order_status === "delivered");
      const cashIn = delivered.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const revenue = confirmed.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const platformFees = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const commissionDue = Number(shop.commission_balance_due) || 0;
      const profit = cashIn - totalExpenses - platformFees;

      const expByCat: Record<string, number> = {};
      expenses.forEach((e: any) => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); });

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
        shopUrl: `https://visuelpro.cloud/shop-editor/${shop.id}`,
      };

      const idempotencyKey = `finance-${shop.id}-${new Date().toISOString().slice(0, 10)}`;

      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "finance-weekly-summary",
          recipientEmail: recipient,
          idempotencyKey,
          templateData,
        },
      });
      if (sendErr) { errors.push(`${shop.id}: ${sendErr.message}`); continue; }
      sent++;
    } catch (e) {
      errors.push(`${shop.id}: ${String(e)}`);
    }
  }

  return new Response(JSON.stringify({ success: true, sent, errors }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});