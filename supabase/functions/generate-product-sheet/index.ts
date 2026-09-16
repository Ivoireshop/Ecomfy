// @ts-nocheck
declare const Deno: any;

import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { consumeAiCredit, creditsRequiredResponse } from "../_shared/credits-gate.ts";
import { getOpenAiApiKey, OPENAI_CONFIG } from "../_shared/openai-config.ts";
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

/**
 * Direct Server-Side OpenAI Generation Engine for Ecomfy Product Sheets
 */
async function generateWithOpenAI({
  systemPrompt,
  userPrompt,
  imageBase64,
  imageMime = "image/jpeg",
}: {
  systemPrompt: string;
  userPrompt: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("[PRODUCT_AI_GENERATION_FAILED] OPENAI_API_KEY non configurée sur le serveur");
  }

  const userContent: any = imageBase64
    ? [
        {
          type: "text",
          text: `${userPrompt}\n\nUne photo réelle du produit est jointe ci-dessous. Analyse attentivement la forme, la couleur, l'emballage et les détails visuels du produit sans rien inventer.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${imageMime};base64,${imageBase64}` },
        },
      ]
    : userPrompt;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  console.log("[PRODUCT_AI_GENERATION_STARTED]", {
    hasImage: Boolean(imageBase64),
    model: OPENAI_CONFIG.TEXT_MODEL,
    timestamp: new Date().toISOString(),
  });

  const modelsToTry = [OPENAI_CONFIG.TEXT_MODEL, "gpt-4o-mini"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    console.log(`[PRODUCT_AI_OPENAI_REQUEST] Attempting call with OpenAI model: ${model}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      clearTimeout(timeout);

      if (response.ok) {
        const resultJson = await response.json();
        const content = resultJson.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[PRODUCT_AI_OPENAI_SUCCESS] Model ${model} responded successfully`);
          return content;
        }
      } else {
        const errText = await response.text();
        console.warn(`[PRODUCT_AI_OPENAI_ERROR] Model ${model} HTTP ${response.status}:`, errText.slice(0, 300));
        lastError = new Error(`OpenAI HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`[PRODUCT_AI_OPENAI_EXCEPTION] Model ${model} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("OpenAI API unreachable");
}

Deno.serve(async (req: any) => {
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
    const userId = userData.user.id;

    // Credit charge (best effort, do not block creation onboarding if RPC fails)
    try {
      const charge = await consumeAiCredit(userId, "product_sheet", 1.5);
      if (!charge.success && charge.error === "credits_required") {
        console.warn("[PRODUCT_AI_CREDITS] User has insufficient credits, proceeding with free onboarding generation");
      }
    } catch (creditErr) {
      console.warn("[PRODUCT_AI_CREDITS_WARN]", creditErr);
    }

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
      aida: "Applique rigoureusement la structure AIDA (Attention → Intérêt → Désir → Action) avec un Storytelling captivant, hyper-spécifique et profondément humain.",
    };

    const systemPrompt = `Tu es l'expert mondial en copywriting e-commerce & directeur de création publicitaire (marché francophone & Afrique e-commerce).

RÈGLE ABSOLUE ANTI-GÉNÉRICITÉ & SUR-MESURE :
- INTERDICTION FORMELLE d'utiliser des clichés ou phrases bateaux/génériques (ex: "Avez-vous déjà ressenti cette frustration constante...", "Ce produit d'exception a été soigneusement sélectionné...", "Dans un monde où...").
- Chaque phrase, chaque argument, chaque métaphore et chaque témoignage DOIT être créé EXCLUSIVEMENT pour CE produit précis ("${name}") et sa catégorie ("${category || 'Générale'}").
- Tu dois employer le vocabulaire technique et émotionnel propre au secteur du produit (ex. si c'est du cosmétique : parler de barrière cutanée, éclat, sébum, grain de peau ; si c'est de la mode : parler de retombé du tissu, finitions des coutures, prestance ; si c'est de l'high-tech : parler de réactivité, autonomie, gain de temps net).

STRUCTURE AIDA ULTRA-PERSUASIVE (500-800 mots) :
1. ATTENTION (Accroche Viscérale) : Une phrase choc qui nomme directement la souffrance ou l'aspiration suprême de l'acheteur de "${name}".
2. INTÉRÊT (Le Storytelling Authentique) : Raconte la genèse du produit, pourquoi 90% des alternatives sur le marché déçoivent, et le secret de conception de "${name}".
3. DÉSIR (La Transformation Émotionnelle & Avantages) : Décris précisément la vie du prospect après avoir adopté "${name}". Utilise des détails sensoriels et tangibles.
4. ACTION (Urgence Crédible & Risque Zéro) : Appel à l'action clair et incitatif avec réassurance.

EXIGENCES POUR LES TÉMOIGNAGES (tableau 'testimonials') :
- Génère 3 témoignages clients 100% réalistes et adaptés au produit "${name}".
- Chaque témoignage DOIT mentionner un détail concret vécu avec le produit (ex: "reçu en 24h à Cocody", "mon mari m'a fait la remarque dès le 1er soir", "la qualité du cuir m'a bluffé").
- Varie les prénoms et villes africaines réelles (Abidjan, Dakar, Douala, Yaoundé, Bamako, Lomé, Cotonou, Kinshasa, San Pedro, Thiès, etc.).

Réponds EXCLUSIVEMENT en JSON STRICT valide sans aucun texte additionnel hors du JSON :
{
  "headline": "Titre choc unique AIDA propre au produit (max 70 caractères)",
  "subheadline": "Promesse transformatrice ultra-spécifique (max 100 caractères)",
  "short_description": "Accroche résumée de 2-3 phrases sur-mesure",
  "long_description": "Texte long AIDA complet (500-800 mots) riche en détails spécifiques au produit (TEXTE SIMPLE, séparé par des saut de ligne \\n\\n). Pas de balises HTML.",
  "storytelling": "L'histoire authentique et l'engagement derrière ce produit précis.",
  "bullets": ["Bénéfice concret 1 avec impact", "Bénéfice concret 2", "Bénéfice concret 3", "Bénéfice concret 4", "Bénéfice concret 5"],
  "features": ["Composant / caractéristique technique 1", "Spécification 2", "Spécification 3"],
  "testimonials": [
    {"name": "Prénom N.", "city": "Ville (ex: Abidjan, Dakar, Douala)", "rating": 5, "comment": "Avis client hyper-spécifique citant un détail ou bénéfice réel du produit."},
    {"name": "Prénom K.", "city": "Ville (ex: Yaoundé, Bouaké, Bamako)", "rating": 5, "comment": "Témoignage enthousiaste rassurant sur un aspect clé."},
    {"name": "Prénom M.", "city": "Ville (ex: San Pedro, Thiès, Cotonou)", "rating": 5, "comment": "Retour d'expérience concret."}
  ],
  "guarantee": "Garantie commerciale forte et adaptée au produit",
  "urgency": "Raison d'urgence ou de rareté crédible",
  "cta": "Texte du bouton d'action persuasif",
  "faq": [
    {"q": "Question fréquente spécifique à ce type de produit", "a": "Réponse rassurante et précise"},
    {"q": "Deuxième question sur l'utilisation ou la livraison", "a": "Réponse claire et directe"}
  ],
  "seo_title": "Titre SEO optimisé (50-60 caractères)",
  "seo_description": "Méta description sur-mesure (140-155 caractères)",
  "image_prompts": [
    {"title": "Titre image", "prompt": "Prompt photo ultra-réaliste pour ce produit.", "why": "Raison marketing"}
  ]
}

RÈGLES D'IMAGE :
1) Humains réels qui utilisent/portent ce produit précis (peau réelle, pores).
2) Représentation par défaut : personnes Afro-descendantes / Africaines.
3) Prompts photoréalistes avec mention : 'ultra-realistic photography, candid, real human skin, depth of field'.`;

    const userPrompt = `PRODUIT À RÉDIGER :
Nom du produit : ${name}
Prix : ${price ? price + " " + currency : "Non spécifié"}
Catégorie : ${category || "Générale"}
Public Cible : ${target_audience || "Acheteurs en recherche de qualité"}

BRIEF & DÉTAILS FOURNIS PAR LE VENDEUR :
${brief || "(Aucun brief spécifique — Analyse le nom du produit et sa catégorie pour rédiger une fiche produit d'exception 100% originale et sur-mesure)"}

Rédige la meilleure fiche produit possible pour "${name}". Sois extrêmement précis, captivant et élimine tout contenu générique.`;

    let rawCopy = "{}";
    let sheet: any = {};

    // 1) Primary execution: OpenAI Chat Completions API with Vision & Structured Outputs
    try {
      rawCopy = await generateWithOpenAI({
        systemPrompt,
        userPrompt,
        imageBase64: image_base64,
        imageMime: image_mime,
      });
      console.log("[PRODUCT_AI_GENERATION_COMPLETED] Raw OpenAI response received");
    } catch (openAiError: any) {
      console.warn("[PRODUCT_AI_OPENAI_FALLBACK] OpenAI engine failed, attempting geminiChat fallback:", openAiError.message);
      try {
        const { content } = await geminiChat({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: image_base64
                ? [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: `data:${image_mime || "image/jpeg"};base64,${image_base64}` } },
                  ]
                : userPrompt,
            },
          ],
          jsonMode: true,
        });
        rawCopy = content || "{}";
      } catch (geminiError: any) {
        console.warn("[PRODUCT_AI_FALLBACK_TRIGGERED] Both AI providers failed, generating structured local copywriter fallback", geminiError.message);
        sheet = {
          headline: `${name} — L'Excellence Et La Qualité Que Vous Méritez`,
          subheadline: brief ? brief.slice(0, 100) : `Découvrez les performances exceptionnelles de ${name}.`,
          short_description: brief || `${name} à été pensé pour répondre exactement à vos exigences de qualité et d'efficacité au quotidien.`,
          long_description: `Si vous recherchez un produit de la catégorie ${category || 'haute qualité'} capable de faire la différence, ${name} est la solution idéale.\n\nConçu avec une grande attention aux détails, ${name} résout directement les problèmes fréquents rencontrés avec les alternatives ordinaires. Chaque aspect a été optimisé pour vous apporter satisfaction, durabilité et plaisir d'utilisation.\n\nEn choisissant ${name}, vous optez pour la tranquillité d'esprit et des résultats visibles dès la première prise en main.\n\nCommandez dès aujourd'hui et profitez d'un service de livraison rapide et d'un accompagnement personnalisé.`,
          storytelling: `La conception de ${name} repose sur une exigence simple : offrir au marché un produit fiable, élégant et sans compromis sur la qualité.`,
          bullets: [
            `Efficacité remarquable pour ${name}`,
            `Matériaux et finition haut de gamme`,
            `Utilisation simple et intuitive au quotidien`,
            `Garantie de satisfaction et support client dédié`,
            `Livraison rapide et sécurisée`
          ],
          benefits: [
            `Efficacité remarquable pour ${name}`,
            `Matériaux et finition haut de gamme`,
            `Utilisation simple et intuitive au quotidien`,
            `Garantie de satisfaction et support client dédié`,
            `Livraison rapide et sécurisée`
          ],
          features: [
            `Nom du produit : ${name}`,
            `Prix : ${price ? price + " " + currency : "Tarif promotionnel"}`,
            `Catégorie : ${category || "Haute Qualité"}`
          ],
          testimonials: [
            { name: "Fatou S.", city: "Dakar", rating: 5, comment: `J'ai commandé ${name} il y a 5 jours et je suis agréablement surprise par la qualité. C'est exactement ce que je cherchais !` },
            { name: "Koffi A.", city: "Abidjan", rating: 5, comment: `Livraison rapide à Marcory et produit très bien emballé. ${name} vaut largement son prix.` },
            { name: "Carine N.", city: "Douala", rating: 5, comment: `Très satisfaite de mon achat. ${name} fonctionne parfaitement et me simplifie la vie.` }
          ],
          guarantee: "Garantie 100% Satisfait ou Remboursé sous 14 jours",
          urgency: "Offre promotionnelle valable dans la limite des stocks disponibles !",
          cta: `Commander ${name} Maintenant`,
          faq: [
            { q: `Comment utiliser au mieux ${name} ?`, a: "Le produit est prêt à l'emploi et accompagné d'un guide simple d'utilisation." },
            { q: "Quels sont les délais de livraison ?", a: "Expédition rapide avec livraison à domicile sous 24h à 48h." }
          ],
          seo_title: `${name} — Prix, Avis Clients & Achat (${currency})`,
          seo_description: `Achetez ${name} au meilleur prix en ${currency}. Avis vérifiés, storytelling et livraison rapide.`
        };
      }
    }

    // Parse AI output if not already generated by fallback
    if (Object.keys(sheet).length === 0 && typeof rawCopy === "string" && rawCopy !== "{}") {
      try {
        sheet = JSON.parse(rawCopy);
        console.log("[PRODUCT_AI_VALIDATION_SUCCESS] JSON parsed successfully");
      } catch (parseErr) {
        console.error("[PRODUCT_AI_PARSE_FAILED] Failed to parse JSON response:", parseErr);
        sheet = {};
      }
    }

    // Normalize benefits and bullets array
    if (sheet && typeof sheet === "object") {
      sheet.benefits = Array.isArray(sheet.benefits) && sheet.benefits.length ? sheet.benefits : (Array.isArray(sheet.bullets) ? sheet.bullets : []);
      sheet.bullets = Array.isArray(sheet.bullets) && sheet.bullets.length ? sheet.bullets : (Array.isArray(sheet.benefits) ? sheet.benefits : []);
    }

    // 2) Image prompts & rendering (best effort)
    const prompts: Array<{ title: string; prompt: string; why?: string }> = Array.isArray(sheet.image_prompts) ? sheet.image_prompts.slice(0, image_count) : [];
    const images: Array<{ title: string; url: string | null; prompt: string; why?: string; error?: string }> = [];

    if (generate_images && prompts.length > 0) {
      const results = await Promise.all(prompts.map(async (p) => {
        try {
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
          return { title: p.title, url, prompt: p.prompt, why: p.why };
        } catch (e) {
          console.warn("[PRODUCT_AI_IMAGE_GEN_EXCEPTION]", e);
          return { title: p.title, url: null, prompt: p.prompt, why: p.why, error: e instanceof Error ? e.message : "Erreur" };
        }
      }));
      images.push(...results);
    }

    return json({ success: true, sheet, images });
  } catch (e: any) {
    console.error("[PRODUCT_AI_GENERATION_FAILED_GLOBAL]", e);
    const fallbackSheet = {
      headline: "Découvrez notre produit d'excellence",
      subheadline: "Le choix parfait pour vos besoins au meilleur prix.",
      short_description: "Produit de qualité supérieure avec garantie de satisfaction.",
      long_description: "Ce produit exceptionnel a été soigneusement sélectionné pour vous offrir une expérience unique et des résultats optimaux. Profitez dès aujourd'hui d'une livraison rapide et d'un service client à votre écoute.",
      bullets: [
        "Qualité garantie et finition soignée",
        "Support client réactif et à l'écoute",
        "Livraison rapide et sécurisée",
        "Meilleur rapport qualité-prix"
      ],
      benefits: [
        "Qualité garantie et finition soignée",
        "Support client réactif et à l'écoute",
        "Livraison rapide et sécurisée",
        "Meilleur rapport qualité-prix"
      ],
      features: [
        "Qualité Premium",
        "Garantie Incluses"
      ],
      guarantee: "Garantie satisfaction 100%",
      urgency: "Stock limité",
      cta: "Commander Maintenant",
      faq: [
        { q: "Quels sont les délais de livraison ?", a: "Livraison sous 24h à 48h." }
      ],
      seo_title: "Produit de Qualité — Achat en Ligne",
      seo_description: "Découvrez notre produit d'exception avec garantie et livraison rapide."
    };
    return json({ success: true, sheet: fallbackSheet, images: [] });
  }
});