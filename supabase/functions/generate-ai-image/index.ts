// @ts-nocheck
import { serveCors } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { enforceUserAiQuota, getAuthenticatedUserId } from "../_shared/ai-quota.ts";
import { estimateImageCostUsd, estimateTextCallCostUsd } from "../_shared/ai-cost.ts";
import { finishGeneration, startGeneration } from "../_shared/ai-generation-log.ts";
import { isOperatorAlertCode, userMessageForFailure } from "../_shared/ai-retry.ts";
import type { Failure } from "../_shared/ai-retry.ts";
import { generateOpenAiImage, persistGeneratedImage } from "../_shared/openai-image-engine.ts";
import { OPENAI_CONFIG, getOpenAiApiKey } from "../_shared/openai-config.ts";
import { analyzeImageWithGpt4oMini } from "../_shared/openai-key.ts";
import { PromptEngine } from "../_shared/prompt-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serveCors("app", async (req: Request) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const body = await req.json();
    const {
      prompt,
      userPrompt,
      sourceImage,
      bannerImage,
      replacementPhoto,
      mode = "publicite-produit",
      style = "Professional Commercial Studio",
      preset,
      aspectRatio = "1:1",
      size,
      productName,
      niche
    } = body;

    // Authentification obligatoire (H9). L'identifiant vient uniquement du JWT : le champ userId du corps
    // était accepté tel quel, ce qui permettait d'usurper un fondateur ou de débiter un autre compte.
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "not_authenticated", message: "Connectez-vous pour générer une image." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Plafond horaire pour tous les profils, fondateurs et abonnés compris.
    const quota = await enforceUserAiQuota(userId, "generate-ai-image", 40);
    if (!quota.allowed) return quota.response;

    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      console.error("[Engine Audit] Missing OPENAI_API_KEY.");
      console.error("[AI-OPERATOR-ALERT] generate-ai-image : OPENAI_API_KEY absente");
      return json({ success: false, error: userMessageForFailure("provider_auth"), code: "provider_auth" });
    }

    let imageSize = OPENAI_CONFIG.ASPECT_RATIO_MAP[aspectRatio] || OPENAI_CONFIG.DEFAULT_SIZE;
    if (size) imageSize = size;

    const sacredPrompt = (prompt || userPrompt || "").trim();
    const imageToAnalyze = sourceImage || bannerImage || replacementPhoto;

    // Réservation AVANT tout appel payant : solde (ou exemption fondateur / abonné), plafond de coût du jour, débit
    // atomique. Le crédit est rendu automatiquement si la génération échoue (finishGeneration "failed").
    // Avant, le solde n'était jamais vérifié : un compte à zéro générait gratuitement.
    const gen = await startGeneration(userId, "image");
    if (!gen.allowed) return gen.response;

    // Dépense engagée, y compris si l'image elle-même échoue ensuite (audit visuel + synthèse du prompt).
    let costUsd = 0;
    let attempts = 0;
    let modelUsed: string | null = null;

    try {
      // 2. Vision Audit (GPT-4o) for Reference Product Photo
      let visionAnalysis = "";
      if (imageToAnalyze) {
        console.log(`[Engine Audit] Auditing reference product image with ${OPENAI_CONFIG.VISION_MODEL}...`);
        visionAnalysis = await analyzeImageWithGpt4oMini(imageToAnalyze);
        costUsd += estimateTextCallCostUsd();
      }

      // 3. Synthesize 23-Pillar Commercial Ad Prompt via PromptEngine
      console.log(`[Engine Audit] Synthesizing prompt via PromptEngine (Mode: ${mode})...`);
      const finalExpandedPrompt = await PromptEngine.generateProfessionalPrompt({
        userPrompt: sacredPrompt,
        mode,
        style,
        sourceImageAnalysis: visionAnalysis,
        aspectRatio,
        productName,
        niche
      });
      costUsd += estimateTextCallCostUsd();

      console.log(`[Engine Audit] Calling OpenAI Engine (Reference Image: ${!!imageToAnalyze}, Size: ${imageSize})...`);

      // 4. OpenAI Image Engine Execution : budget d'appels borné, échecs triés (voir _shared/ai-retry.ts)
      const engine = await generateOpenAiImage(OPENAI_API_KEY, finalExpandedPrompt, imageSize, imageToAnalyze, startTime);
      attempts = engine.attempts;
      modelUsed = engine.model;

      if (!engine.ok) {
        const failure = engine.failure as Failure;
        console.error(
          `[Engine Audit] Image engine failed (${failure.code}) after ${engine.attempts} call(s):`,
          engine.trail.join(" > "),
          failure.detail
        );
        if (isOperatorAlertCode(failure.code)) {
          // Repérable dans les logs de la fonction : clé invalide, solde OpenAI épuisé, modèle retiré.
          console.error(`[AI-OPERATOR-ALERT] generate-ai-image : ${failure.code} (HTTP ${failure.status})`);
        }
        const fin = await finishGeneration(gen.logId, {
          status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: failure.code,
        });
        // 200 + success:false : convention des fonctions IA, les écrans affichent `error` tel quel.
        return json({
          success: false,
          error: userMessageForFailure(failure.code),
          code: failure.code,
          refunded: fin.refunded,
        });
      }

      const imageUrl = engine.url as string;
      costUsd += estimateImageCostUsd(engine.model as string, OPENAI_CONFIG.IMAGE_QUALITY, imageSize);

      const durationMs = Date.now() - startTime;
      console.log(`[Engine Audit] Generation Successful in ${durationMs}ms (${attempts} call(s)) for user ${userId}`);

      // 5. Copie dans le stockage permanent (bucket generated-images)
      const stored = await persistGeneratedImage(supabaseClient, userId, imageUrl);
      const permanentImageUrl = stored.url;
      const persistedInStorage = stored.persisted;

      // 6. Save to DB for Library (retained 30 days).
      // Sans copie dans le stockage, image_url serait une data-URL de plusieurs Mo (qui alourdit toute la
      // Bibliothèque) ou une URL OpenAI qui expire en ~1 h : on n'enregistre alors rien et on le signale au client.
      let savedToLibrary = false;
      if (persistedInStorage) {
        const { data: insertedRecord, error: dbError } = await supabaseClient.from("generated_images").insert({
          user_id: userId,
          image_url: permanentImageUrl,
          prompt: finalExpandedPrompt.substring(0, 3500),
          product_details: {
            mode,
            style,
            preset: preset?.name || null,
            originalPrompt: sacredPrompt,
            size: imageSize,
            modelUsed,
            durationMs,
            attempts,
            estimatedCostUsd: Number(costUsd.toFixed(4))
          }
        }).select().maybeSingle();

        if (dbError) {
          console.error("[Engine DB Error] Failed to insert generated_images:", dbError);
        } else {
          savedToLibrary = true;
          console.log(`[Engine DB Audit] Saved generated image ID ${insertedRecord?.id} to Library for user ${userId}`);
        }
      }

      // 7. Clôture : coût estimé, tentatives, durée. Le crédit réservé au départ reste débité (succès).
      await finishGeneration(gen.logId, { status: "succeeded", attempts, model: modelUsed, costUsd, durationMs });

      return json({
        imageUrl: permanentImageUrl,
        prompt: finalExpandedPrompt,
        success: true,
        savedToLibrary,
        referenceIgnored: engine.referenceIgnored === true,
        durationMs
      });
    } catch (genErr) {
      // Erreur inattendue après la réservation (synthèse du prompt, stockage…) : clôture en échec, ce qui rembourse.
      await finishGeneration(gen.logId, {
        status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: "internal_error",
      });
      throw genErr;
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    // Le détail reste dans les logs : il peut contenir des éléments du fournisseur qu'on ne montre pas à l'utilisateur.
    console.error(`[Engine Audit Error] Failed after ${durationMs}ms:`, err?.message || err);
    return json({ success: false, error: userMessageForFailure("internal_error"), code: "internal_error" });
  }
});
