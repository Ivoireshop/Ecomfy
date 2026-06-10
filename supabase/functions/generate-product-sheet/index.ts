import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { geminiChat, geminiImage } from "../_shared/openrouter-chat.ts";

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
  const __quota = await enforceAiQuota(req, "generate-product-sheet");
  if (!__quota.allowed) return __quota.response;


  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

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
      image_count = 5,
    } = body || {};

    if (!name || typeof name !== "string") return json({ success: false, error: "Nom du produit requis" });

    const frameworkPrompts: Record<string, string> = {
      hormozi: "Applique le Grand Slam Offer d'Alex Hormozi: rêve clarifié, valeur perçue maximale, risque réduit (garantie forte), urgence/rareté.",
      pas: "Utilise le framework PAS (Problème → Agitation → Solution).",
      aida: "Utilise AIDA (Attention → Intérêt → Désir → Action).",
    };

    const systemPrompt = `Tu es un copywriter e-commerce africain (FCFA) expert en conversion ET directeur artistique photo.
${frameworkPrompts[framework] || frameworkPrompts.hormozi}
Tu rédiges une fiche produit COMPLÈTE, prête à copier-coller dans une boutique en ligne.
Réponds en JSON STRICT sans texte hors JSON :
{
  "headline": "titre accrocheur (max 70 caractères)",
  "subheadline": "promesse en une phrase",
  "short_description": "description courte 2-3 phrases pour fiche/aperçu",
  "long_description": "description longue en TEXTE SIMPLE (PAS de HTML, PAS de balises, PAS de markdown). Paragraphes séparés par une ligne vide. 300-500 mots, persuasive, bénéfices clairs. IMPORTANT : INSÈRE entre les paragraphes 3 à 5 emplacements d'images sous cette forme EXACTE sur sa propre ligne :\n\n📸 IMAGE SUGGÉRÉE ICI — [type : ex. gros plan macro / avant-après / personne qui utilise / packshot fond blanc / ambiance lifestyle]\nDescription : ce que doit montrer la photo, l'angle, la lumière, le contexte, l'émotion.\nPourquoi : raison de conversion à cet endroit précis.\n\nPlace ces blocs aux moments stratégiques (après l'accroche, après les bénéfices, près de la garantie, avant le CTA final).",
  "bullets": ["bénéfice 1", "bénéfice 2", "bénéfice 3", "bénéfice 4", "bénéfice 5"],
  "features": ["caractéristique technique 1", "caractéristique 2", "caractéristique 3"],
  "guarantee": "garantie / réducteur de risque",
  "urgency": "urgence ou rareté crédible",
  "cta": "texte du bouton (max 30 caractères)",
  "faq": [{"q": "question fréquente", "a": "réponse rassurante"}],
  "seo_title": "titre SEO 50-60 caractères",
  "seo_description": "meta description 140-155 caractères",
  "image_prompts": [
    {"title": "Court titre FR", "prompt": "Prompt en anglais ULTRA-DÉTAILLÉ pour photo PHOTORÉALISTE (jamais un rendu IA générique). Mentionner systématiquement: shot on Canon EOS R5 85mm f/1.4 OR iPhone 15 Pro, natural soft lighting, photorealistic, real human skin texture with pores, candid documentary photography, 35mm grain", "why": "Pourquoi cette image convertit"}
  ]
}

RÈGLES STRICTES — génère EXACTEMENT ${image_count} entrées image_prompts :
1) Privilégie des HUMAINS RÉELS qui utilisent / portent / tiennent le produit (peau réelle, pores, micro-expressions, imperfections authentiques). JAMAIS de rendu 3D / visage symétrique parfait / esthétique IA.
2) Représentation par défaut : personnes Afro-descendantes / Africaines (carnations variées). Indiquer dans le prompt : "Black African person, real skin texture, natural pores, authentic expression".
3) Si SANTÉ / BEAUTÉ / COSMÉTIQUE / BIEN-ÊTRE : inclure 1 image AVANT/APRÈS (split-screen diptyque réaliste), 1 personne visiblement SATISFAITE (sourire authentique type témoignage), 1 application/usage du produit, 1 packshot épuré, 1 lifestyle.
4) Si MODE / ACCESSOIRES : porté par une personne réelle, contexte urbain africain (Abidjan, Dakar, Lagos), plusieurs angles et distances.
5) Si TECH / OBJET : main qui tient, scène d'usage réelle, macro détail, packshot, contexte de vie.
6) Si ALIMENTAIRE : main qui sert/verse, dégustation expressive, mise en scène conviviale.
7) Varie distances (gros plan, plan américain, plan large) et lumières (jour naturel, golden hour, intérieur chaleureux).
8) Chaque prompt DOIT inclure cette mention en fin : "ultra-realistic photography, photojournalism style, real human skin, candid, depth of field, --no AI look, no plastic skin, no cartoon, no 3d render, no cgi, no illustration, no oversaturation, no perfect symmetric face, no generic stock".`;

    const userPrompt = `Produit: ${name}
Prix: ${price ?? "(non spécifié)"} ${currency}
Catégorie: ${category || "(non spécifiée)"}
Cible: ${target_audience || "(générale)"}

Brief / informations fournies par le vendeur :
${brief || "(aucun brief — déduis depuis le nom du produit)"}

Rédige une fiche produit complète, persuasive, adaptée au marché ouest-africain (français, FCFA, codes culturels locaux quand pertinent).`;

    // 1) Copy generation (OpenRouter Gemini → Lovable Cloud fallback)
    let rawCopy = "{}";
    try {
      const { content, provider } = await geminiChat({
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
        jsonMode: true,
      });
      console.log(`[generate-product-sheet] copy provider=${provider}`);
      rawCopy = content || "{}";
    } catch (e) {
      console.error("copy AI error", e);
      return json({ success: false, error: "Service IA momentanément indisponible (rédaction). Réessayez dans un instant." });
    }
    let sheet: any = {};
    try { sheet = JSON.parse(rawCopy); } catch { sheet = {}; }

    // 2) Image generation (best effort, parallel)
    const prompts: Array<{ title: string; prompt: string; why?: string }> = Array.isArray(sheet.image_prompts) ? sheet.image_prompts.slice(0, image_count) : [];
    const images: Array<{ title: string; url: string | null; prompt: string; why?: string; error?: string }> = [];

    if (generate_images && prompts.length > 0) {
      const results = await Promise.all(prompts.map(async (p) => {
        try {
          // Si une image de référence du produit a été fournie, on l'injecte
          // dans la requête image pour que le modèle PRESERVE le produit réel
          // (forme, couleur, étiquettes, marque) et ne génère pas un produit
          // imaginaire similaire. Les personnages / décor peuvent changer.
          const refImagePrompt =
            (image_base64
              ? "CRITICAL PRODUCT FIDELITY RULE: The attached reference image shows the EXACT product to feature. You MUST keep the product identical to the reference: same shape, same packaging, same label, same brand text, same colors, same proportions, same materials. Do NOT redesign, restyle, or invent a similar-looking product. Only the human models, background, lighting and scene may change. Place the EXACT product from the reference into the scene below.\n\nSCENE: "
              : "") + p.prompt;

          const styledPrompt = refImagePrompt +
            ". STYLE: ultra-realistic photography, photojournalism, real human skin with natural pores and texture, authentic candid moment, shot on professional camera 85mm lens, natural soft lighting, shallow depth of field, 4k, subtle photographic film grain, editorial magazine quality. NEGATIVE PROMPT: no AI generated look, no plastic skin, no cartoon, no 3d render, no cgi, no illustration, no oversaturation, no perfect symmetric face, no waxy skin, no generic stock photo, no uncanny valley.";
          const refs = image_base64
            ? [`data:${image_mime || "image/jpeg"};base64,${image_base64}`]
            : [];
          const { url, provider } = await geminiImage(styledPrompt, refs);
          console.log(`[generate-product-sheet] image provider=${provider}`);
          return { title: p.title, url, prompt: p.prompt, why: p.why };
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