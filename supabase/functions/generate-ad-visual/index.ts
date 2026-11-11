// @ts-nocheck
import { serveCors } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
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

// 200 + success:false : convention des fonctions IA, les écrans affichent `error` tel quel (message lisible).
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

    // Authentification obligatoire (H9) : plus de mode invité, chaque appel coûte une image OpenAI.
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "not_authenticated", message: "Connectez-vous pour générer un visuel." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Plafond horaire pour tous les profils, fondateurs et abonnés compris.
    const quota = await enforceUserAiQuota(userId, "generate-ad-visual", 40);
    if (!quota.allowed) return quota.response;

    const reqBody = await req.json();
    const {
      prompt = "",
      userPrompt = "",
      customInstructions = "",
      personDescription = "",
      productName = "Produit Ecomfy",
      niche = "général",
      platform = "facebook",
      style = "studio",
      productImage = null,
      mode = "publicite-produit"
    } = reqBody;

    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      console.error("[AI-OPERATOR-ALERT] generate-ad-visual : OPENAI_API_KEY absente");
      return json({ success: false, error: userMessageForFailure("provider_auth"), code: "provider_auth" });
    }

    const sacredPrompt = (prompt || userPrompt || customInstructions || personDescription || "").trim();

    // Réservation AVANT tout appel payant : solde (ou exemption fondateur / abonné), plafond de coût du jour, débit
    // atomique, remboursé automatiquement si la génération échoue. Avant, cette fonction ne vérifiait ni ne débitait
    // aucun crédit : seule la limite de 40 par heure bornait la dépense.
    const gen = await startGeneration(userId, "ad_visual");
    if (!gen.allowed) return gen.response;

    let costUsd = 0;
    let attempts = 0;
    let modelUsed: string | null = null;

    try {
      // 1. Perform Vision Audit if reference product image provided
      let visionAnalysis = "";
      if (productImage) {
        console.log(`[AdVisual Engine] Auditing product photo with ${OPENAI_CONFIG.VISION_MODEL}...`);
        visionAnalysis = await analyzeImageWithGpt4oMini(productImage);
        costUsd += estimateTextCallCostUsd();
      }

      // 2. Synthesize 23-Pillar Prompt
      const finalPrompt = await PromptEngine.generateProfessionalPrompt({
        userPrompt: sacredPrompt,
        mode,
        style,
        sourceImageAnalysis: visionAnalysis,
        productName,
        niche
      });
      costUsd += estimateTextCallCostUsd();

      let gptImageSize = "1024x1024";
      if (platform === "tiktok" || platform === "instagram_story") {
        gptImageSize = "1024x1792";
      } else if (platform === "facebook") {
        gptImageSize = "1792x1024";
      }

      console.log(`[AdVisual Engine] Calling OpenAI Engine (Reference Image: ${!!productImage}, Size: ${gptImageSize})...`);

      // 3. Moteur partagé : budget d'appels borné, échecs triés (voir _shared/ai-retry.ts)
      const engine = await generateOpenAiImage(OPENAI_API_KEY, finalPrompt, gptImageSize, productImage, startTime);
      attempts = engine.attempts;
      modelUsed = engine.model;

      if (!engine.ok) {
        const failure = engine.failure as Failure;
        console.error(
          `[AdVisual Engine] Image engine failed (${failure.code}) after ${engine.attempts} call(s):`,
          engine.trail.join(" > "),
          failure.detail
        );
        if (isOperatorAlertCode(failure.code)) {
          console.error(`[AI-OPERATOR-ALERT] generate-ad-visual : ${failure.code} (HTTP ${failure.status})`);
        }
        const fin = await finishGeneration(gen.logId, {
          status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: failure.code,
        });
        return json({ success: false, error: userMessageForFailure(failure.code), code: failure.code, refunded: fin.refunded });
      }

      costUsd += estimateImageCostUsd(engine.model as string, OPENAI_CONFIG.IMAGE_QUALITY, gptImageSize);
      const durationMs = Date.now() - startTime;

      // 4. Copie dans le stockage permanent (bucket generated-images)
      const stored = await persistGeneratedImage(supabaseClient, userId, engine.url as string);
      const permanentImageUrl = stored.url;

      // 5. Bibliothèque. Sans copie dans le stockage, image_url serait une data-URL de plusieurs Mo ou une URL OpenAI
      // qui expire en ~1 h : on n'enregistre alors rien (même règle que generate-ai-image).
      let savedToLibrary = false;
      if (stored.persisted) {
        const { error: dbError } = await supabaseClient.from("generated_images").insert({
          user_id: userId,
          image_url: permanentImageUrl,
          prompt: finalPrompt.substring(0, 3500),
          product_details: {
            productName,
            niche,
            platform,
            style,
            mode,
            modelUsed,
            durationMs,
            attempts,
            estimatedCostUsd: Number(costUsd.toFixed(4))
          }
        });
        if (dbError) console.error("[AdVisual DB Error] Failed to insert generated_images:", dbError);
        else savedToLibrary = true;
      }

      await finishGeneration(gen.logId, { status: "succeeded", attempts, model: modelUsed, costUsd, durationMs });

      return json({
        imageUrl: permanentImageUrl,
        prompt: finalPrompt,
        success: true,
        savedToLibrary,
        referenceIgnored: engine.referenceIgnored === true,
        durationMs
      });
    } catch (genErr) {
      // Erreur inattendue après la réservation : clôture en échec, ce qui rembourse.
      await finishGeneration(gen.logId, {
        status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: "internal_error",
      });
      throw genErr;
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    // Le détail reste dans les logs : on ne renvoie pas au navigateur le texte brut d'une erreur interne ou fournisseur.
    console.error(`[AdVisual Engine Error] Failed after ${durationMs}ms:`, err?.message || err);
    return json({ success: false, error: userMessageForFailure("internal_error"), code: "internal_error" });
  }
});
