// @ts-nocheck
declare const Deno: any;

import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { consumeAiCredit } from "../_shared/credits-gate.ts";
import { estimateOpenRouterImageCostUsd, estimateSheetTextCostUsd, dailyCostCapUsd } from "../_shared/ai-cost.ts";
import { dailyLimitResponse, recordGeneration, todaySpendUsd } from "../_shared/ai-generation-log.ts";
import { classifyOpenAiFailure, fetchWithTimeout, runWithRetry } from "../_shared/ai-retry.ts";
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
}): Promise<{ content: string; attempts: number; model: string }> {
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

  // Budget de 3 appels au total (avant : un essai par modèle, sans distinguer panne passagère et refus définitif).
  // Panne passagère -> même modèle après une attente ; modèle indisponible -> le suivant ; refus définitif -> arrêt,
  // l'appelant bascule alors sur le second fournisseur (Gemini).
  const startedAt = Date.now();
  const report = await runWithRetry<string>(
    [OPENAI_CONFIG.TEXT_MODEL, "gpt-4o-mini"],
    async (model, _n, remaining) => {
      console.log(`[PRODUCT_AI_OPENAI_REQUEST] Attempting call with OpenAI model: ${model}`);
      const res = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.3 }),
        },
        Math.max(5_000, Math.min(45_000, remaining)),
      );
      if (res.ok) {
        const content = res.json()?.choices?.[0]?.message?.content;
        if (content) return { ok: true as const, value: content as string };
        return { ok: false as const, failure: { kind: "retryable" as const, code: "empty_response", status: res.status, detail: "réponse vide" } };
      }
      console.warn(`[PRODUCT_AI_OPENAI_ERROR] Model ${model} HTTP ${res.status}:`, res.text.slice(0, 300));
      return { ok: false as const, failure: classifyOpenAiFailure(res.status, res.text) };
    },
    { maxAttempts: 3, deadlineAt: startedAt + 100_000 },
  );

  if (report.ok) {
    console.log(`[PRODUCT_AI_OPENAI_SUCCESS] Model ${report.model} responded successfully`);
    return { content: report.value as string, attempts: report.attempts, model: report.model as string };
  }
  const err: any = new Error(`OpenAI ${report.failure?.code ?? "unreachable"}: ${report.failure?.detail ?? ""}`);
  err.attempts = report.attempts;
  throw err;
}

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const __quota = await enforceAiQuota(req, "generate-product-sheet");
  if (!__quota.allowed) return __quota.response;

  // Suivi du coût (voir ai_generation_log) : renseigné au fil de la requête, écrit une fois à la sortie.
  const startedAt = Date.now();
  const usage = { userId: "", costUsd: 0, attempts: 0, model: null as string | null, aiContent: false, logged: false };
  const logOnce = async (
    status: "succeeded" | "failed",
    extra: { errorCode?: string; chargeSource?: "free" | "credits" | "subscription" | "exempt"; chargeAmount?: number } = {},
  ) => {
    if (usage.logged || !usage.userId) return;
    usage.logged = true;
    await recordGeneration(usage.userId, "product_sheet", {
      status, attempts: usage.attempts, model: usage.model, costUsd: usage.costUsd, durationMs: Date.now() - startedAt, ...extra,
    });
  };

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
    usage.userId = userId;

    // Règle d'accueil conservée : un utilisateur sans crédit n'est PAS bloqué (la création de produit ne doit pas
    // s'arrêter là). Le plafond de coût du jour, lui, s'applique à tous : c'est une limite de sécurité, pas un prix.
    const spent = await todaySpendUsd(userId);
    if (spent === null) {
      return json({ success: false, error: "Le suivi des crédits est momentanément indisponible. Réessayez dans un instant.", code: "quota_unavailable" });
    }
    if (spent >= dailyCostCapUsd()) return dailyLimitResponse();

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

    // Borné côté serveur : le nombre d'images (une génération OpenRouter chacune) ne doit pas venir du navigateur.
    const maxImages = Math.min(5, Math.max(0, Math.floor(Number(image_count)) || 0));

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
      const ai = await generateWithOpenAI({
        systemPrompt,
        userPrompt,
        imageBase64: image_base64,
        imageMime: image_mime,
      });
      rawCopy = ai.content;
      usage.attempts += ai.attempts;
      usage.model = ai.model;
      usage.costUsd += estimateSheetTextCostUsd(Boolean(image_base64));
      usage.aiContent = true;
      console.log("[PRODUCT_AI_GENERATION_COMPLETED] Raw OpenAI response received");
    } catch (openAiError: any) {
      usage.attempts += openAiError?.attempts ?? 0;
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
        usage.attempts++;
        usage.model = "gemini";
        usage.costUsd += estimateSheetTextCostUsd(Boolean(image_base64));
        usage.aiContent = Boolean(content);
      } catch (geminiError: any) {
        // Aucun texte de remplacement n'est inventé : un texte générique avec faux témoignages, garantie et délais
        // inventés serait publié par le vendeur comme s'il avait été rédigé pour son produit.
        console.warn("[PRODUCT_AI_FALLBACK_TRIGGERED] Both AI providers failed", geminiError.message);
        sheet = {};
        usage.aiContent = false;
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
        usage.aiContent = false;
      }
    }

    // Normalize benefits and bullets array
    if (sheet && typeof sheet === "object") {
      sheet.benefits = Array.isArray(sheet.benefits) && sheet.benefits.length ? sheet.benefits : (Array.isArray(sheet.bullets) ? sheet.bullets : []);
      sheet.bullets = Array.isArray(sheet.bullets) && sheet.bullets.length ? sheet.bullets : (Array.isArray(sheet.benefits) ? sheet.benefits : []);
    }

    // Réponse sans contenu exploitable (ni texte long, ni avantages) : même traitement qu'une IA indisponible.
    if (usage.aiContent && !String(sheet?.long_description ?? "").trim() && !(Array.isArray(sheet?.benefits) && sheet.benefits.length)) {
      usage.aiContent = false;
    }

    // IA indisponible ou réponse inexploitable : un vrai échec, rien n'est facturé, rien n'est inventé. Avant, un texte
    // générique revenait avec success:true et l'écran le présentait comme « rédigé par l'IA ».
    if (!usage.aiContent) {
      await logOnce("failed", { errorCode: "ai_unavailable" });
      return json({
        success: false,
        code: "ai_unavailable",
        error: "La rédaction par l'IA est momentanément indisponible. Aucun crédit n'a été débité. Réessayez dans un instant ou rédigez la description en mode Expert.",
      });
    }

    // 2) Image prompts & rendering (best effort)
    const prompts: Array<{ title: string; prompt: string; why?: string }> = Array.isArray(sheet.image_prompts) ? sheet.image_prompts.slice(0, maxImages) : [];
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
          usage.attempts++;
          if (url) usage.costUsd += estimateOpenRouterImageCostUsd();
          return { title: p.title, url, prompt: p.prompt, why: p.why };
        } catch (e) {
          console.warn("[PRODUCT_AI_IMAGE_GEN_EXCEPTION]", e);
          return { title: p.title, url: null, prompt: p.prompt, why: p.why, error: e instanceof Error ? e.message : "Erreur" };
        }
      }));
      images.push(...results);
    }

    // Le crédit n'est débité que si une vraie fiche rédigée par l'IA est livrée (avant : débité d'avance, y compris
    // quand l'IA tombait en panne et qu'un texte générique de secours était renvoyé). Toujours « au mieux » : un échec
    // du débit, ou un solde insuffisant, ne bloque pas la création du produit (règle d'accueil).
    if (usage.aiContent) {
      let chargeSource: "free" | "credits" | "subscription" | "exempt" = "free";
      let chargeAmount = 0;
      try {
        const charge: any = await consumeAiCredit(userId, "product_sheet", 1.5);
        if (charge.success) {
          if (charge.exempt) chargeSource = "exempt";
          else if (charge.subscription) chargeSource = "subscription";
          else if (charge.free_trial) chargeSource = "free";
          else { chargeSource = "credits"; chargeAmount = Number(charge.charged) || 1.5; }
        } else if (charge.error === "credits_required") {
          console.warn("[PRODUCT_AI_CREDITS] User has insufficient credits, proceeding with free onboarding generation");
        }
      } catch (creditErr) {
        console.warn("[PRODUCT_AI_CREDITS_WARN]", creditErr);
      }
      await logOnce("succeeded", { chargeSource, chargeAmount });
    }

    return json({ success: true, sheet, images });
  } catch (e: any) {
    console.error("[PRODUCT_AI_GENERATION_FAILED_GLOBAL]", e);
    await logOnce("failed", { errorCode: "internal_error" });
    // Pas de texte de remplacement (voir plus haut) : l'erreur reste visible, le vendeur peut réessayer.
    return json({
      success: false,
      code: "internal_error",
      error: "La rédaction de la fiche a échoué. Aucun crédit n'a été débité. Réessayez dans un instant ou rédigez la description en mode Expert.",
    });
  }
});