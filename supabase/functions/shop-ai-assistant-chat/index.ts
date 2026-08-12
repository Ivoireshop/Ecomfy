import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { shopOwnerHasCredits } from "../_shared/credits-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  ar: "العربية",
  dioula: "Dioula (parlé en Côte d'Ivoire)",
  baoule: "Baoulé (parlé en Côte d'Ivoire)",
};

const PERSONALITY_DESC: Record<string, string> = {
  friendly: "amical, chaleureux, accueillant, utilise des emojis avec parcimonie",
  professional: "professionnel, posé, expert, ton corporate",
  energetic: "énergique, enthousiaste, dynamique, motivant",
  luxury: "élégant, raffiné, premium, choix de mots soignés",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { shopId, messages } = await req.json();
    if (!shopId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "shopId and messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load shop + assistant config + products
    const [shopRes, cfgRes, prodRes] = await Promise.all([
      supabase.from("shops").select("id, business_name, business_description, primary_color, whatsapp_number, phone_number").eq("id", shopId).maybeSingle(),
      supabase.from("shop_ai_assistants").select("*").eq("shop_id", shopId).maybeSingle(),
      supabase.from("products").select("name, short_description, description, price, compare_at_price, category, stock_quantity, is_featured").eq("shop_id", shopId).eq("is_published", true).order("is_featured", { ascending: false }).limit(30),
    ]);

    const shop = shopRes.data;
    const cfg = cfgRes.data;
    const products = prodRes.data ?? [];

    if (!shop || !cfg || !cfg.enabled) {
      return new Response(JSON.stringify({ error: "Assistant unavailable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gate: shop owner must have IA credits for the assistant to respond
    const ownerOk = await shopOwnerHasCredits(shopId);
    if (!ownerOk) {
      return new Response(
        JSON.stringify({ error: "credits_required" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const name = cfg.name || "Ramina";
    const personality = PERSONALITY_DESC[cfg.personality] || PERSONALITY_DESC.friendly;
    const convLang = cfg.conversation_language || "auto";
    const sourceMode = cfg.source_mode || "auto_products";

    const productLines = products.map((p: any) => {
      const cmp = p.compare_at_price && p.compare_at_price > p.price ? ` (au lieu de ${p.compare_at_price} FCFA, promo)` : "";
      const feat = p.is_featured ? " [⭐ recommandé]" : "";
      const desc = p.short_description ? ` — ${p.short_description}` : "";
      return `- ${p.name}: ${p.price} FCFA${cmp}${feat}${desc}`;
    }).join("\n");

    const contextSections: string[] = [];
    if (sourceMode === "manual" || sourceMode === "hybrid") {
      if (cfg.manual_context) contextSections.push(`Informations fournies par le propriétaire:\n${cfg.manual_context}`);
    }
    if (sourceMode === "auto_products" || sourceMode === "hybrid") {
      if (productLines) contextSections.push(`Catalogue de produits (top 30):\n${productLines}`);
    }

    const langInstruction = convLang === "auto"
      ? "Détecte automatiquement la langue du visiteur (en analysant son message) et réponds DANS CETTE LANGUE. Pour Dioula ou Baoulé : si tu ne maîtrises pas parfaitement, réponds en français en t'excusant chaleureusement."
      : `Réponds STRICTEMENT en ${LANG_NAMES[convLang] || convLang}, quelle que soit la langue du visiteur.`;

    const systemPrompt = `Tu es ${name}, l'assistante IA de la boutique en ligne "${shop.business_name}".
${shop.business_description ? `À propos de la boutique : ${shop.business_description}` : ""}

Ton style : ${personality}.
Ta mission : accueillir chaleureusement les visiteurs, recommander les meilleurs produits, répondre aux questions, et les guider vers l'achat.

LANGUE : ${langInstruction}

RÈGLES IMPÉRATIVES ET STRICTES (Priorité absolue) :
1. RESPECT TOTAL DU PROMPT : Si des "Informations fournies par le propriétaire" sont données ci-dessous, elles PRIMENT sur tout le reste. Tu dois te comporter, parler et répondre EXACTEMENT comme indiqué dans ces informations.
2. BASE DE CONNAISSANCES : Ne réponds qu'en utilisant le "Catalogue de produits" et les instructions fournies.
3. INTERDICTION D'INVENTER : N'invente JAMAIS d'informations, de politiques, de promotions, de produits ou de caractéristiques.
4. HORS SUJET : Si une question dépasse tes connaissances, propose le contact direct : WhatsApp ${shop.whatsapp_number || shop.phone_number || ""}. Ne tente pas de deviner.
5. CONCISION : Sois CONCISE : 2 à 4 phrases courtes maximum par réponse.
6. COMMANDE : Si on te demande comment commander, dis qu'il suffit de cliquer sur "Commander maintenant" sur la fiche produit.

CONTEXTE DE LA BOUTIQUE :
${contextSections.join("\n\n") || "Aucun contexte produit pour l'instant."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("shop-ai-assistant-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});