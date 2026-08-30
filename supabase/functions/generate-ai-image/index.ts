// @ts-nocheck
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

serve(async (req: Request) => {
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
      userId = "guest-user",
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

    // 1. Quota Verification
    let isFounder = false;
    let hasActiveSubscription = false;

    if (userId && !userId.startsWith("guest-")) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("is_founder, subscription_status")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        isFounder = profile.is_founder === true;
        hasActiveSubscription = profile.subscription_status === "active";
      }

      if (!isFounder && !hasActiveSubscription) {
        const quotaResult = await enforceAiQuota(supabaseClient, userId, "generate_image");
        if (!quotaResult.allowed) {
          return new Response(
            JSON.stringify({ 
              error: quotaResult.message || "Quota de générations d'images d'essai atteint.",
              quotaExceeded: true,
              success: false 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. Vision Audit (GPT-4o) for Reference Product Photo
    let visionAnalysis = "";
    if (imageToAnalyze) {
      console.log(`[Engine Audit] Auditing reference product image with ${OPENAI_CONFIG.VISION_MODEL}...`);
      visionAnalysis = await analyzeImageWithGpt4oMini(imageToAnalyze);
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

    console.log(`[Engine Audit] Calling OpenAI Engine (Reference Image: ${!!imageToAnalyze}, Size: ${imageSize})...`);

    // 4. OpenAI Image Engine Execution (Option A Image Edits / Generations)
    const imageUrl = await callOpenAiImageEngine(OPENAI_API_KEY, finalExpandedPrompt, imageSize, imageToAnalyze);

    const durationMs = Date.now() - startTime;
    console.log(`[Engine Audit] Generation Successful in ${durationMs}ms for user ${userId}`);

    // 5. Save to DB
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

    // 6. Credit management
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
            .update({ purchased_credits: profileData.purchased_credits - 1 })
            .eq("id", userId);
        } else if (profileData.free_generations_remaining > 0) {
          await supabaseClient
            .from("profiles")
            .update({ free_generations_remaining: profileData.free_generations_remaining - 1 })
            .eq("id", userId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        imageUrl, 
        prompt: finalExpandedPrompt,
        success: true,
        durationMs
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err.message || "Une erreur est survenue lors de la génération de l'image.";
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

async function callOpenAiImageEngine(apiKey: string, prompt: string, size: string, referenceImage?: string): Promise<string> {
  const models = [OPENAI_CONFIG.IMAGE_MODEL, OPENAI_CONFIG.IMAGE_MODEL_FALLBACK, "dall-e-3"];
  let lastError = "";

  // If user provided a reference image, execute Option A (/v1/images/edits) first
  if (referenceImage) {
    try {
      console.log(`[OpenAI Call] Executing Option A (Reference Image Input via /v1/images/edits)...`);
      let imageBlob: Blob;

      if (referenceImage.startsWith("data:")) {
        const parts = referenceImage.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/png";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        imageBlob = new Blob([u8arr], { type: mime });
      } else {
        const fetchRes = await fetch(referenceImage);
        imageBlob = await fetchRes.blob();
      }

      for (const modelCandidate of models) {
        try {
          console.log(`[OpenAI Edits] Trying model ${modelCandidate} via /v1/images/edits...`);
          const formData = new FormData();
          formData.append("image", imageBlob, "product_reference.png");
          formData.append("prompt", prompt.substring(0, 950));
          formData.append("model", modelCandidate);
          formData.append("n", "1");
          formData.append("size", size);

          const res = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
            if (url) {
              console.log(`[OpenAI Edits SUCCESS] Option A succeeded with model ${modelCandidate}!`);
              return url;
            }
          } else {
            const errText = await res.text();
            console.warn(`[OpenAI Edits ${modelCandidate} Failed]:`, res.status, errText);
            lastError = errText;
          }
        } catch (editErr) {
          console.warn(`[OpenAI Edits ${modelCandidate} Exception]:`, editErr);
        }
      }
    } catch (blobErr) {
      console.warn("[OpenAI Edits Blob Conversion Failed]:", blobErr);
    }
  }

  // Fallback to /v1/images/generations with Vision-Guided Sacred Prompt
  console.log(`[OpenAI Call] Executing /v1/images/generations with Vision-Guided Prompt Engine...`);
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
