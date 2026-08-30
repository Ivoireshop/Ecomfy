import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { OPENAI_CONFIG, getOpenAiApiKey } from "../_shared/openai-config.ts";
import { analyzeImageWithGpt4oMini } from "../_shared/openai-key.ts";
import { PromptEngine } from "../_shared/prompt-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const __quota = await enforceAiQuota(req, "generate-ai-image");
  if (!__quota.allowed) return __quota.response;

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let userId = "guest-" + (req.headers.get("x-forwarded-for") || "anonymous");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user?.id) userId = user.id;
      } catch (_) {}
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);
    const isFounder = Array.isArray(roleData) && roleData.length > 0;

    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();
    const hasActiveSubscription = isFounder || subData?.status === "active";

    let freeGenerationsRemaining = 3;
    let purchasedCredits = 0;
    if (!hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .maybeSingle();

      freeGenerationsRemaining = profileData?.free_generations_remaining ?? 3;
      purchasedCredits = profileData?.purchased_credits ?? 0;

      if (freeGenerationsRemaining <= 0 && purchasedCredits <= 0) {
        return new Response(
          JSON.stringify({ 
            error: "Vous avez utilisé vos 3 générations gratuites d'images. Veuillez recharger vos crédits IA ou souscrire à un abonnement pour continuer.",
            quotaExhausted: true,
            freeGenerationsRemaining: 0,
            purchasedCredits: 0
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { 
      mode = "publicite-produit", 
      prompt = "", 
      userPrompt = "", 
      style = "professional studio", 
      sourceImage, 
      bannerImage, 
      replacementPhoto, 
      preset, 
      aspectRatio = "1:1", 
      size,
      productName,
      niche
    } = body;

    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      console.error("[Engine Audit] Missing OPENAI_API_KEY.");
      throw new Error("Clé API OpenAI non configurée côté serveur (OPENAI_API_KEY).");
    }

    let imageSize = OPENAI_CONFIG.ASPECT_RATIO_MAP[aspectRatio] || OPENAI_CONFIG.DEFAULT_SIZE;
    if (size) imageSize = size;

    const sacredPrompt = (prompt || userPrompt || "").trim();
    const imageToAnalyze = sourceImage || bannerImage || replacementPhoto;

    // 1. Vision Audit (GPT-4o) for Reference Product Photo
    let visionAnalysis = "";
    if (imageToAnalyze) {
      console.log(`[Engine Audit] Auditing reference product image with ${OPENAI_CONFIG.VISION_MODEL}...`);
      visionAnalysis = await analyzeImageWithGpt4oMini(imageToAnalyze);
    }

    // 2. Synthesize 23-Pillar Commercial Ad Prompt via PromptEngine
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

    console.log(`[Engine Audit] Calling OpenAI ${OPENAI_CONFIG.IMAGE_MODEL} (${imageSize}, Quality: ${OPENAI_CONFIG.IMAGE_QUALITY})...`);

    // 3. Direct Call to OpenAI gpt-image-1 (with gpt-image-2 fallback)
    const imageUrl = await callOpenAiImageEngine(OPENAI_API_KEY, finalExpandedPrompt, imageSize);

    const durationMs = Date.now() - startTime;
    console.log(`[Engine Audit] Generation Successful in ${durationMs}ms for user ${userId}`);

    // 4. Save to DB
    await supabaseClient.from("generated_images").insert({
      user_id: userId,
      image_url: imageUrl,
      prompt: finalExpandedPrompt.substring(0, 3500),
      product_details: {
        mode,
        style,
        preset: preset?.name || null,
        originalPrompt: sacredPrompt,
        size: imageSize,
        modelUsed: OPENAI_CONFIG.IMAGE_MODEL,
        durationMs,
        estimatedCostUsd: OPENAI_CONFIG.ESTIMATED_COST_USD
      }
    });

    // 5. Credit management
    if (!hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) {
        if (profileData.purchased_credits > 0) {
          await supabaseClient
            .from("profiles")
            .update({ purchased_credits: Math.max(0, profileData.purchased_credits - 1) })
            .eq("id", userId);
        } else if (profileData.free_generations_remaining > 0) {
          await supabaseClient
            .from("profiles")
            .update({ free_generations_remaining: Math.max(0, profileData.free_generations_remaining - 1) })
            .eq("id", userId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        imageUrl, 
        success: true, 
        meta: {
          model: OPENAI_CONFIG.IMAGE_MODEL,
          quality: OPENAI_CONFIG.IMAGE_QUALITY,
          durationMs
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la génération";
    console.error(`[Engine Audit Error] Failed after ${durationMs}ms:`, errorMessage);

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callOpenAiImageEngine(apiKey: string, prompt: string, size: string): Promise<string> {
  const models = [OPENAI_CONFIG.IMAGE_MODEL, OPENAI_CONFIG.IMAGE_MODEL_FALLBACK, "dall-e-3"];
  let lastError = "";

  for (const modelCandidate of models) {
    try {
      console.log(`[OpenAI Call] Requesting model ${modelCandidate} (${size}, quality: ${OPENAI_CONFIG.IMAGE_QUALITY})...`);
      const bodyPayload: any = {
        model: modelCandidate,
        prompt: prompt.substring(0, 3800),
        size,
        n: 1,
      };

      if (modelCandidate.startsWith("gpt-image")) {
        bodyPayload.quality = OPENAI_CONFIG.IMAGE_QUALITY;
      } else {
        bodyPayload.quality = "hd";
      }

      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (url) return url;
      } else {
        lastError = await res.text();
        console.warn(`[OpenAI Call ${modelCandidate} Failed]:`, res.status, lastError);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAI Call ${modelCandidate} Exception]:`, lastError);
    }
  }

  throw new Error(`Échec de la génération d'image OpenAI : ${lastError}`);
}
