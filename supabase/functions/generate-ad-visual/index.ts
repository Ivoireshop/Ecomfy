import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithTimeout(input: Request | string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 60000, ...fetchInit } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...fetchInit, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function generatePromptHash(prompt: string, platform: string, size: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${prompt.trim().toLowerCase()}:${platform}:${size}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const __quota = await enforceAiQuota(req, "generate-ad-visual");
  if (!__quota.allowed) return __quota.response;

  let currentQueueItemId: string | undefined;
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    let userId = "guest-" + (req.headers.get("x-forwarded-for") || "anonymous");
    let isFounder = false;
    let hasActiveSubscription = false;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user?.id) {
          userId = user.id;
        }
      } catch (_) {}
    }

    // Check founder role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);
    isFounder = Array.isArray(roleData) && roleData.length > 0;

    // Check subscription status
    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();
    hasActiveSubscription = isFounder || subData?.status === "active";

    // Check credits
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
            error: "Vous avez utilisé vos 3 générations gratuites. Veuillez recharger vos crédits IA.",
            quotaExhausted: true,
            freeGenerationsRemaining: 0,
            purchasedCredits: 0
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const reqBody = await req.json().catch(() => ({}));
    const { 
      productName = "Produit Ecomfy", 
      niche = "général", 
      description = "", 
      platform = "facebook", 
      style = "studio", 
      productImage = null,
      price = "",
      promotionalPrice = "",
      benefits = [],
      tagline = "",
      callToAction = "",
      queueItemId = undefined,
      isFast = false
    } = reqBody;

    currentQueueItemId = queueItemId;

    let basePrompt = `Professional product advertisement visual for "${productName}" (${niche}). ${description}. Style: ${style}. Platform: ${platform}.`;
    if (tagline) basePrompt += ` Tagline theme: ${tagline}.`;
    if (callToAction) basePrompt += ` CTA context: ${callToAction}.`;
    basePrompt += ` High resolution commercial photography, warm colors, product hero shot, clean background for text overlay, no written words.`;

    let prompt = basePrompt;
    if (productImage) {
      try {
        const visionFeatures = await analyzeImageWithGpt4oMini(productImage, `Analyse cette image de produit (${productName}). Décris son emballage et ses couleurs.`);
        if (visionFeatures) prompt += `\nVisual Features: ${visionFeatures}`;
      } catch (e) {
        console.warn("Vision analysis skipped:", e);
      }
    }

    try {
      prompt = await optimizePromptWithGpt4oMini(prompt);
    } catch (e) {
      console.warn("Prompt optimization skipped:", e);
    }

    let gptImageSize: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    if (platform === "tiktok" || platform === "instagram_story") {
      gptImageSize = "1024x1792";
    } else if (platform === "facebook") {
      gptImageSize = "1792x1024";
    }

    // Cache Lookup
    const promptHash = await generatePromptHash(prompt, platform || "all", gptImageSize);
    const { data: cachedImage } = await supabaseClient
      .from("image_cache")
      .select("id, image_url")
      .eq("prompt_hash", promptHash)
      .maybeSingle();

    if (cachedImage?.image_url) {
      console.log("Cache HIT! Returning cached image");
      return new Response(
        JSON.stringify({
          imageUrl: cachedImage.image_url,
          imageId: cachedImage.id,
          cached: true,
          freeGenerationsRemaining: hasActiveSubscription ? null : Math.max(0, freeGenerationsRemaining - 1),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Cache MISS. Generating new image...");
    let imageUrl: string | null = null;

    // Engine 1: OpenRouter
    const openRouterKey = getOpenRouterKey();
    if (openRouterKey) {
      try {
        imageUrl = await generateImageWithOpenRouter(openRouterKey, { prompt });
      } catch (e) {
        console.warn("OpenRouter primary failed:", e);
      }
    }

    // Engine 2: OpenAI DALL-E 3 / DALL-E 2
    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!imageUrl && OPENAI_API_KEY) {
      for (let attempt = 1; attempt <= 2 && !imageUrl; attempt++) {
        try {
          const gptResp = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: prompt.substring(0, 1000),
              size: gptImageSize,
              quality: "standard",
              n: 1,
            }),
            timeoutMs: 60000,
          });

          if (gptResp.ok) {
            const data = await gptResp.json();
            imageUrl = data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : data.data?.[0]?.url;
          } else {
            const d2Resp = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "dall-e-2",
                prompt: prompt.substring(0, 900),
                size: "1024x1024",
                n: 1,
              }),
              timeoutMs: 40000,
            });
            if (d2Resp.ok) {
              const d2Data = await d2Resp.json();
              imageUrl = d2Data.data?.[0]?.url || d2Data.data?.[0]?.b64_json;
            }
          }
        } catch (err) {
          console.error(`DALL-E attempt ${attempt} failed:`, err);
        }
      }
    }

    // Engine 3: Commercial Fallback Engine (Pollinations.ai)
    if (!imageUrl) {
      console.log("Using High-Definition Commercial Image Engine fallback...");
      try {
        const encodedPrompt = encodeURIComponent(prompt.substring(0, 500));
        const seed = Math.floor(Math.random() * 1000000);
        const [w, h] = gptImageSize.split("x");
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&seed=${seed}&nologo=true&enhance=true`;
        const imageResp = await fetchWithTimeout(pollinationsUrl, { timeoutMs: 45000 });
        if (imageResp.ok && imageResp.headers.get("content-type")?.includes("image")) {
          const blob = await imageResp.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          imageUrl = `data:image/jpeg;base64,${btoa(binary)}`;
          console.log("Commercial fallback engine image generated successfully!");
        }
      } catch (fallbackErr) {
        console.error("Commercial AI fallback failed:", fallbackErr);
      }
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Échec de la génération d'image. Veuillez réessayer." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to Cache & DB
    try {
      await supabaseClient.from("image_cache").insert({
        prompt_hash: promptHash,
        prompt: prompt.substring(0, 1000),
        image_url: imageUrl,
        model: "dall-e-3",
        platform: platform || "all",
        size: gptImageSize,
        user_id: userId,
      });
    } catch (e) {
      console.warn("Cache save failed:", e);
    }

    let savedImageId: string | null = null;
    try {
      const { data: savedImage } = await supabaseClient
        .from("generated_images")
        .insert({
          user_id: userId,
          image_url: imageUrl,
          prompt: prompt.substring(0, 500),
          product_details: { productName, niche, description, platform, style, price, promotionalPrice, benefits },
        })
        .select("id")
        .maybeSingle();
      savedImageId = savedImage?.id || null;
    } catch (e) {
      console.warn("Generated images save failed:", e);
    }

    // Decrement credits
    let updatedFreeGenerations = freeGenerationsRemaining;
    let updatedPurchasedCredits = purchasedCredits;
    if (userId && !hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      try {
        if (purchasedCredits > 0) {
          updatedPurchasedCredits = Math.max(0, purchasedCredits - 1);
          await supabaseClient.from("profiles").update({ purchased_credits: updatedPurchasedCredits }).eq("id", userId);
        } else if (freeGenerationsRemaining > 0) {
          updatedFreeGenerations = Math.max(0, freeGenerationsRemaining - 1);
          await supabaseClient.from("profiles").update({ free_generations_remaining: updatedFreeGenerations }).eq("id", userId);
        }
      } catch (e) {
        console.error("Credit decrement error:", e);
      }
    }

    // Complete queue item if present
    if (currentQueueItemId) {
      try {
        await supabaseClient.from("generation_queue").update({
          status: "completed",
          image_url: imageUrl,
          completed_at: new Date().toISOString()
        }).eq("id", currentQueueItemId);
      } catch (e) {
        console.error("Queue item update error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        imageUrl,
        imageId: savedImageId,
        saved: !!savedImageId,
        freeGenerationsRemaining: hasActiveSubscription ? null : updatedFreeGenerations,
        purchasedCredits: hasActiveSubscription ? null : updatedPurchasedCredits,
        additionalFormats: [],
        hasMultipleFormats: false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-ad-visual:", error);
    if (currentQueueItemId) {
      try {
        await supabaseClient.from("generation_queue").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString()
        }).eq("id", currentQueueItemId);
      } catch (_) {}
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
