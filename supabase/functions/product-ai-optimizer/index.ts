import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { requireUserCredits } from "../_shared/credits-gate.ts";
import { geminiChat } from "../_shared/openrouter-chat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const __credits = await requireUserCredits(req);
  if (!__credits.allowed) return __credits.response;
  const __quota = await enforceAiQuota(req, "product-ai-optimizer");
  if (!__quota.allowed) return __quota.response;


  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "Non authentifié" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ success: false, error: "Session invalide" });
    const userId = userData.user.id;

    const { shop_id, product_id, framework = "hormozi" } = await req.json().catch(() => ({}));
    if (!shop_id || !product_id) return json({ success: false, error: "Paramètres manquants" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: shop } = await admin
      .from("shops")
      .select("id, user_id, business_name, business_description, currency, ai_optimizer_enabled")
      .eq("id", shop_id)
      .maybeSingle();
    if (!shop || shop.user_id !== userId) return json({ success: false, error: "Boutique introuvable" });

    const { data: product } = await admin
      .from("products")
      .select("id, name, description, short_description, price, compare_at_price, category, stock_quantity, is_published")
      .eq("id", product_id)
      .eq("shop_id", shop_id)
      .maybeSingle();
    if (!product) return json({ success: false, error: "Produit introuvable" });

    const { data: images } = await admin
      .from("product_images")
      .select("image_url")
      .eq("product_id", product_id);

    // Window: last 30 days
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [{ count: visitorsAll }, { count: visitorsProduct }, { data: ordersRows }] = await Promise.all([
      admin.from("shop_visits").select("id", { count: "exact", head: true }).eq("shop_id", shop_id).gte("visited_at", since),
      admin.from("shop_visits").select("id", { count: "exact", head: true }).eq("shop_id", shop_id).eq("product_id", product_id).gte("visited_at", since),
      admin.from("orders").select("id, status, total, created_at, order_items!inner(product_id, quantity)").eq("shop_id", shop_id).gte("created_at", since),
    ]);

    const productOrders = (ordersRows ?? []).filter((o: any) =>
      (o.order_items ?? []).some((oi: any) => oi.product_id === product_id)
    );
    const totalOrders = productOrders.length;
    const totalRevenue = productOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const visitors = visitorsProduct ?? 0;
    const shopVisitors = visitorsAll ?? 0;
    const conversion = visitors > 0 ? (totalOrders / visitors) * 100 : 0;

    const frameworkPrompts: Record<string, string> = {
      hormozi: "Applique les principes d'Alex Hormozi (Grand Slam Offer): clarifie le rêve, augmente la valeur perçue, réduis le risque, ajoute urgence et garantie.",
      pas: "Utilise le framework PAS (Problème → Agitation → Solution).",
      aida: "Utilise le framework AIDA (Attention → Intérêt → Désir → Action).",
    };

    const systemPrompt = `Tu es une équipe d'agents IA spécialisée en CRO (Conversion Rate Optimization) e-commerce africain (FCFA).
Ton rôle: analyser une fiche produit, comprendre POURQUOI les visiteurs n'achètent pas, et proposer des améliorations CONCRÈTES et ACTIONNABLES.
${frameworkPrompts[framework] || frameworkPrompts.hormozi}

Tu DOIS répondre en JSON STRICT avec ce format:
{
  "diagnosis": "Synthèse en 2-3 phrases du problème principal de conversion",
  "score": 0-100,
  "priority_issues": ["issue 1", "issue 2", "issue 3"],
  "recommendations": [
    { "title": "titre court", "category": "titre|description|offre|prix|preuve_sociale|urgence|visuel|cta", "impact": "high|medium|low", "effort": "low|medium|high", "action": "action concrète à faire maintenant" }
  ],
  "rewritten_copy": {
    "headline": "nouveau titre accrocheur",
    "subheadline": "promesse en une phrase",
    "bullets": ["bénéfice 1", "bénéfice 2", "bénéfice 3", "bénéfice 4"],
    "guarantee": "garantie / réducteur de risque",
    "cta": "texte du bouton d'action",
    "urgency": "élément d'urgence/rareté"
  }
}
Pas de texte hors JSON.`;

    const userPrompt = `BOUTIQUE: ${shop.business_name}
Description boutique: ${shop.business_description ?? "(aucune)"}

PRODUIT: ${product.name}
Catégorie: ${product.category}
Prix: ${product.price} ${shop.currency || "FCFA"}${product.compare_at_price ? ` (barré: ${product.compare_at_price})` : ""}
Stock: ${product.stock_quantity}
Publié: ${product.is_published ? "oui" : "non"}
Nombre d'images: ${images?.length ?? 0}
Description courte: ${product.short_description ?? "(vide)"}
Description longue: ${(product.description ?? "(vide)").slice(0, 1500)}

TRAFIC & CONVERSION (30 derniers jours):
- Visiteurs sur la fiche produit: ${visitors}
- Visiteurs totaux de la boutique: ${shopVisitors}
- Commandes contenant ce produit: ${totalOrders}
- Chiffre d'affaires: ${totalRevenue.toLocaleString()} ${shop.currency || "FCFA"}
- Taux de conversion fiche produit: ${conversion.toFixed(2)}%
- Référence marché e-commerce: 1-3% (faible), 3-5% (correct), >5% (excellent)

Analyse pourquoi les visiteurs ne convertissent pas et propose un plan d'action priorisé.`;

    let raw = "{}";
    try {
      const { content, provider } = await geminiChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        jsonMode: true,
      });
      console.log(`[product-ai-optimizer] provider=${provider}`);
      raw = content || "{}";
    } catch (e) {
      console.error("AI error", e);
      return json({ success: false, error: "Service IA momentanément indisponible. Réessayez dans un instant." });
    }
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { diagnosis: raw, recommendations: [] }; }

    const { data: saved } = await admin
      .from("product_ai_analyses")
      .insert({
        shop_id,
        product_id,
        framework,
        visitors_count: visitors,
        orders_count: totalOrders,
        conversion_rate: Number(conversion.toFixed(2)),
        diagnosis: parsed.diagnosis ?? null,
        recommendations: parsed.recommendations ?? [],
        rewritten_copy: parsed.rewritten_copy ?? null,
        raw_markdown: raw,
      })
      .select("*")
      .maybeSingle();

    return json({
      success: true,
      analysis: saved,
      stats: { visitors, shopVisitors, totalOrders, totalRevenue, conversion: Number(conversion.toFixed(2)) },
      parsed,
    });
  } catch (e) {
    console.error("product-ai-optimizer error", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});