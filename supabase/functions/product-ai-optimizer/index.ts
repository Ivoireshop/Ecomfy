import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { consumeAiCredit, creditsRequiredResponse } from "../_shared/credits-gate.ts";
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

const FRAMEWORKS = ["hormozi", "pas", "aida"];
const IMPACTS = ["high", "medium", "low"];
const EFFORTS = ["low", "medium", "high"];

const str = (v: unknown, max = 600): string =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";
const oneOf = (v: unknown, allowed: string[], fallback: string) =>
  typeof v === "string" && allowed.includes(v.toLowerCase()) ? v.toLowerCase() : fallback;

/** L'IA enveloppe parfois le JSON dans des balises ``` ou du texte : on l'en extrait. */
function parseAiJson(raw: string): any | null {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* essai suivant */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* abandon */ }
  }
  return null;
}

/** Garantit la forme attendue par l'écran, quoi que renvoie l'IA (types, tailles, valeurs hors liste). */
function normalizeAnalysis(p: any) {
  const recommendations = (Array.isArray(p?.recommendations) ? p.recommendations : [])
    .filter((r: any) => r && typeof r === "object" && str(r.title))
    .slice(0, 10)
    .map((r: any) => ({
      title: str(r.title, 160),
      category: str(r.category, 40) || "autre",
      impact: oneOf(r.impact, IMPACTS, "medium"),
      effort: oneOf(r.effort, EFFORTS, "medium"),
      action: str(r.action, 800),
    }));

  const c = p?.rewritten_copy && typeof p.rewritten_copy === "object" ? p.rewritten_copy : {};
  const copy = {
    headline: str(c.headline, 200),
    subheadline: str(c.subheadline, 300),
    bullets: (Array.isArray(c.bullets) ? c.bullets : []).map((b: unknown) => str(b, 300)).filter(Boolean).slice(0, 8),
    guarantee: str(c.guarantee, 300),
    cta: str(c.cta, 80),
    urgency: str(c.urgency, 300),
  };
  const hasCopy = Object.values(copy).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));

  const score = Number(p?.score);
  return {
    diagnosis: str(p?.diagnosis, 1500) || null,
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
    priority_issues: (Array.isArray(p?.priority_issues) ? p.priority_issues : []).map((i: unknown) => str(i, 300)).filter(Boolean).slice(0, 6),
    recommendations,
    rewritten_copy: hasCopy ? copy : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    const body = await req.json().catch(() => ({}));
    const { shop_id, product_id } = body;
    const framework = FRAMEWORKS.includes(body.framework) ? body.framework : "hormozi";
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

    // Seules les ventes réelles comptent (hors annulées/retournées) ; le CA est celui de CE produit, pas de la commande entière.
    const [visitsAllRes, visitsProductRes, ordersRes] = await Promise.all([
      admin.from("shop_visits").select("id", { count: "exact", head: true }).eq("shop_id", shop_id).gte("visited_at", since),
      admin.from("shop_visits").select("id", { count: "exact", head: true }).eq("shop_id", shop_id).eq("product_id", product_id).gte("visited_at", since),
      admin
        .from("orders")
        .select("id, order_items!inner(product_id, total_price)")
        .eq("shop_id", shop_id)
        .eq("order_items.product_id", product_id)
        .not("order_status", "in", "(cancelled,returned)")
        .gte("created_at", since),
    ]);
    if (visitsAllRes.error || visitsProductRes.error || ordersRes.error) {
      console.error("product-ai-optimizer stats error", visitsAllRes.error, visitsProductRes.error, ordersRes.error);
      return json({ success: false, error: "Impossible de lire les statistiques de la boutique. Réessayez." });
    }

    const productOrders = ordersRes.data ?? [];
    const totalOrders = productOrders.length;
    const totalRevenue = productOrders.reduce(
      (sum: number, o: any) => sum + (o.order_items ?? []).reduce((s: number, oi: any) => s + Number(oi.total_price || 0), 0),
      0,
    );
    const visitors = visitsProductRes.count ?? 0;
    const shopVisitors = visitsAllRes.count ?? 0;
    const conversion = visitors > 0 ? Math.min(100, (totalOrders / visitors) * 100) : 0;

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
- Chiffre d'affaires: ${totalRevenue.toLocaleString("fr-FR")} ${shop.currency || "FCFA"}
- Taux de conversion fiche produit: ${conversion.toFixed(2)}%
- Référence marché e-commerce: 1-3% (faible), 3-5% (correct), >5% (excellent)

Analyse pourquoi les visiteurs ne convertissent pas et propose un plan d'action priorisé.`;

    let raw = "{}";
    try {
      // 25 s par tentative : l'écran abandonne à 120 s, donc les 3 modèles de secours tiennent dans ce délai.
      const { content, provider } = await geminiChat({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        jsonMode: true,
        timeoutMs: 25000,
        maxTokens: 4096,
      });
      console.log(`[product-ai-optimizer] provider=${provider}`);
      raw = content || "{}";
    } catch (e) {
      console.error("AI error", e);
      return json({ success: false, error: "Service IA momentanément indisponible. Réessayez dans un instant." });
    }

    const parsed = normalizeAnalysis(parseAiJson(raw));
    if (!parsed.diagnosis && parsed.recommendations.length === 0) {
      console.error("product-ai-optimizer: réponse IA inexploitable", raw.slice(0, 300));
      return json({ success: false, error: "L'IA a renvoyé une réponse inexploitable. Réessayez : aucun crédit n'a été débité." });
    }

    // Le crédit n'est débité qu'une fois l'analyse obtenue : un échec de l'IA ne consomme ni l'essai gratuit ni le solde.
    // (1 essai gratuit, puis 1,5 crédit par analyse.)
    const charge = await consumeAiCredit(userId, "optimizer", 1.5);
    if (!charge.success) {
      if (charge.error === "credits_required") return creditsRequiredResponse({ feature: "optimizer" });
      return json({ success: false, error: charge.error || "credits_error" });
    }

    const conversionRate = Number(conversion.toFixed(2));
    const { data: saved, error: saveErr } = await admin
      .from("product_ai_analyses")
      .insert({
        shop_id,
        product_id,
        framework,
        visitors_count: visitors,
        orders_count: totalOrders,
        conversion_rate: conversionRate,
        diagnosis: parsed.diagnosis,
        recommendations: parsed.recommendations,
        rewritten_copy: parsed.rewritten_copy,
        raw_markdown: raw,
      })
      .select("*")
      .maybeSingle();
    if (saveErr || !saved) console.error("product-ai-optimizer: enregistrement impossible", saveErr);

    // Crédit débité : on rend l'analyse même si l'historique n'a pas pu être enregistré.
    const analysis = saved ?? {
      id: crypto.randomUUID(),
      shop_id,
      product_id,
      framework,
      visitors_count: visitors,
      orders_count: totalOrders,
      conversion_rate: conversionRate,
      diagnosis: parsed.diagnosis,
      recommendations: parsed.recommendations,
      rewritten_copy: parsed.rewritten_copy,
      created_at: new Date().toISOString(),
    };

    return json({
      success: true,
      analysis,
      stats: { visitors, shopVisitors, totalOrders, totalRevenue, conversion: conversionRate },
      parsed,
    });
  } catch (e) {
    console.error("product-ai-optimizer error", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});