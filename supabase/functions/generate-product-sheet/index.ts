import { createClient } from "npm:@supabase/supabase-js@2";

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

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ success: false, error: "IA indisponible" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "Non authentifié" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ success: false, error: "Session invalide" });

    const body = await req.json().catch(() => ({}));
    const {
      name,
      price,
      currency = "FCFA",
      category = "",
      brief = "",
      target_audience = "",
      framework = "hormozi",
      image_base64,
      image_mime,
      generate_images = true,
      image_count = 3,
    } = body || {};

    if (!name || typeof name !== "string") return json({ success: false, error: "Nom du produit requis" });

    const frameworkPrompts: Record<string, string> = {
      hormozi: "Applique le Grand Slam Offer d'Alex Hormozi: rêve clarifié, valeur perçue maximale, risque réduit (garantie forte), urgence/rareté.",
      pas: "Utilise le framework PAS (Problème → Agitation → Solution).",
      aida: "Utilise AIDA (Attention → Intérêt → Désir → Action).",
    };

    const systemPrompt = `Tu es un copywriter e-commerce africain (FCFA) expert en conversion.
${frameworkPrompts[framework] || frameworkPrompts.hormozi}
Tu rédiges une fiche produit COMPLÈTE, prête à copier-coller dans une boutique en ligne.
Réponds en JSON STRICT sans texte hors JSON :
{
  "headline": "titre accrocheur (max 70 caractères)",
  "subheadline": "promesse en une phrase",
  "short_description": "description courte 2-3 phrases pour fiche/aperçu",
  "long_description": "description longue HTML simple (paragraphes <p>, listes <ul><li>, 250-400 mots, persuasive, bénéfices clairs)",
  "bullets": ["bénéfice 1", "bénéfice 2", "bénéfice 3", "bénéfice 4", "bénéfice 5"],
  "features": ["caractéristique technique 1", "caractéristique 2", "caractéristique 3"],
  "guarantee": "garantie / réducteur de risque",
  "urgency": "urgence ou rareté crédible",
  "cta": "texte du bouton (max 30 caractères)",
  "faq": [{"q": "question fréquente", "a": "réponse rassurante"}],
  "seo_title": "titre SEO 50-60 caractères",
  "seo_description": "meta description 140-155 caractères",
  "image_prompts": [
    {"title": "Photo principale produit", "prompt": "prompt détaillé en anglais pour une IA générative d'image, fond neutre, lumière studio, qualité commerciale", "why": "Pourquoi cette image convertit"}
  ]
}
Génère exactement ${image_count} entrées dans image_prompts, variées (packshot, lifestyle, détail, contexte d'usage).`;

    const userPrompt = `Produit: ${name}
Prix: ${price ?? "(non spécifié)"} ${currency}
Catégorie: ${category || "(non spécifiée)"}
Cible: ${target_audience || "(générale)"}

Brief / informations fournies par le vendeur :
${brief || "(aucun brief — déduis depuis le nom du produit)"}

Rédige une fiche produit complète, persuasive, adaptée au marché ouest-africain (français, FCFA, codes culturels locaux quand pertinent).`;

    // 1) Copy generation
    const copyResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: image_base64
              ? [
                  { type: "text", text: userPrompt + "\n\nUne image du produit est jointe — utilise-la pour décrire fidèlement le produit." },
                  { type: "image_url", image_url: { url: `data:${image_mime || "image/jpeg"};base64,${image_base64}` } },
                ]
              : userPrompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!copyResp.ok) {
      const t = await copyResp.text();
      console.error("copy AI error", copyResp.status, t);
      if (copyResp.status === 429) return json({ success: false, error: "Trop de requêtes IA, réessayez dans une minute." });
      if (copyResp.status === 402) return json({ success: false, error: "Crédits IA épuisés. Ajoutez du crédit dans Réglages > Espace > Usage." });
      return json({ success: false, error: "Erreur IA (copy)" });
    }

    const copyData = await copyResp.json();
    const rawCopy = copyData?.choices?.[0]?.message?.content ?? "{}";
    let sheet: any = {};
    try { sheet = JSON.parse(rawCopy); } catch { sheet = {}; }

    // 2) Image generation (best effort, parallel)
    const prompts: Array<{ title: string; prompt: string; why?: string }> = Array.isArray(sheet.image_prompts) ? sheet.image_prompts.slice(0, image_count) : [];
    const images: Array<{ title: string; url: string | null; prompt: string; why?: string; error?: string }> = [];

    if (generate_images && prompts.length > 0) {
      const results = await Promise.all(prompts.map(async (p) => {
        try {
          const imgResp = await fetch(LOVABLE_AI_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [
                { role: "user", content: p.prompt + ", professional product photography, studio lighting, high resolution, commercial quality, clean composition" },
              ],
              modalities: ["image", "text"],
            }),
          });
          if (!imgResp.ok) {
            const t = await imgResp.text();
            console.warn("image gen failed", imgResp.status, t.slice(0, 200));
            return { title: p.title, url: null, prompt: p.prompt, why: p.why, error: `HTTP ${imgResp.status}` };
          }
          const imgData = await imgResp.json();
          const url = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url
            || imgData?.choices?.[0]?.message?.content;
          return { title: p.title, url: typeof url === "string" ? url : null, prompt: p.prompt, why: p.why };
        } catch (e) {
          console.warn("image gen exception", e);
          return { title: p.title, url: null, prompt: p.prompt, why: p.why, error: e instanceof Error ? e.message : "Erreur" };
        }
      }));
      images.push(...results);
    }

    return json({ success: true, sheet, images });
  } catch (e) {
    console.error("generate-product-sheet error", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});