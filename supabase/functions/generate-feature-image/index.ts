import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchWithTimeout(input: Request | string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 60000, ...rest } = init as any;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(input as any, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "generate-feature-image");
  if (!__quota.allowed) return __quota.response;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);
    isFounder = Array.isArray(roleData) && roleData.length > 0;

    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();
    hasActiveSubscription = isFounder || subData?.status === "active";

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
    }

    const body = await req.json();
    const { prompt = "", userPrompt = "", customInstructions = "", productName = "", niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription } = body;

    const sacredPrompt = (prompt || userPrompt || customInstructions || personDescription || "").trim();

    let masterPrompt = "";
    if (sacredPrompt) {
      masterPrompt += `[PRIMARY USER DEMAND - MANDATORY INSTRUCTION]:\n${sacredPrompt}\n\n`;
    }

    if (productName) {
      masterPrompt += `[PRODUCT INFORMATION]:\nProduct Name: ${productName}\nCategory: ${niche || 'Général'}\n`;
      if (description && description !== sacredPrompt) masterPrompt += `Description: ${description}\n`;
      if (container) masterPrompt += `Container: ${container}\n`;
      if (personDescription && personDescription !== sacredPrompt) masterPrompt += `Scene Staging: ${personDescription}\n`;
      if (style) masterPrompt += `Visual Style: ${style}\n`;
      if (platform) masterPrompt += `Target Format: ${platform}\n`;
    }

    if (productImage) {
      try {
        console.log("Analyzing product image with GPT-4o-mini Vision...");
        const visionFeatures = await analyzeImageWithGpt4oMini(
          productImage,
          `Perform a high-precision commercial product visual audit of this uploaded image for "${productName}".
Describe in detail (in English):
1. EXACT PRODUCT IDENTITY: Product type, container/packaging shape (bottle, box, jar, tube, bag, etc.), materials (glass, matte plastic, gold metal, leather, fabric), cap/closure style.
2. COLOR PALETTE: Primary, secondary, and accent colors, metallic foils, label colors.
3. BRANDING & TEXT: Logo placement, label design, typography style, key visible branding elements.
4. TEXTURE & FINISH: Glossy, reflective, matte, embossed, woven, transparent.
Format as a clear, structured prompt fragment designed for DALL-E 3 to faithfully recreate this exact product hero element in a professional ad background.`
        );
        if (visionFeatures) {
          masterPrompt += `\n[EXACT PRODUCT VISUAL IDENTITY - MUST REPRODUCE THIS PRODUCT FAITHFULLY]:\n${visionFeatures}\n`;
        }
      } catch (e) {
        console.warn("Vision analysis skipped:", e);
      }
    }

    masterPrompt += `\n[COMMERCIAL ADVERTISING PHOTOGRAPHY DIRECTIVES]:\nUltra-high resolution commercial photography, 8k quality, sharp focus, professional studio lighting, warm golden tones, mobile-optimized high contrast. Clean background for optional text overlay.`;

    let finalPrompt = masterPrompt;
    try {
      finalPrompt = await optimizePromptWithGpt4oMini(masterPrompt);
    } catch (e) {
      console.warn("Prompt optimization fallback:", e);
    }

    const OPENAI_API_KEY = getOpenAiApiKey();

    const generatePromptHash = async (text: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const promptHash = await generatePromptHash(finalPrompt);
    const { data: cachedImage } = await supabaseClient
      .from("image_cache")
      .select("id, image_url")
      .eq("prompt_hash", promptHash)
      .maybeSingle();

    if (cachedImage?.image_url) {
      console.log("Cache HIT! Returning cached image");
      return new Response(
        JSON.stringify({ imageUrl: cachedImage.image_url, cached: true, freeGenerationsRemaining: hasActiveSubscription ? null : Math.max(0, freeGenerationsRemaining - 1) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Generating feature image with prompt length:", finalPrompt.length);
    let imageUrl: string | null = null;

    // PRIMARY ENGINE: OpenAI DALL-E 3
    if (OPENAI_API_KEY) {
      try {
        console.log("Calling OpenAI DALL-E 3 as primary engine...");
        const openaiResp = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: finalPrompt.substring(0, 3800),
            size: '1024x1024',
            quality: 'standard',
            n: 1,
          }),
          timeoutMs: 65000,
        });

        if (openaiResp.ok) {
          const openaiData = await openaiResp.json();
          imageUrl = openaiData.data?.[0]?.b64_json ? `data:image/png;base64,${openaiData.data[0].b64_json}` : openaiData.data?.[0]?.url;
          if (imageUrl) console.log("OpenAI DALL-E 3 generated feature image successfully!");
        } else {
          console.warn("DALL-E 3 primary failed:", openaiResp.status, await openaiResp.text());
        }
      } catch (e) {
        console.error("DALL-E 3 exception:", e);
      }
    }

    // FALLBACK 1: OpenRouter
    if (!imageUrl) {
      const openRouterKey = getOpenRouterKey();
      if (openRouterKey) {
        try {
          imageUrl = await generateImageWithOpenRouter(openRouterKey, {
            prompt: finalPrompt,
            referenceImages: productImage ? [productImage] : [],
          });
        } catch (e) {
          console.warn("OpenRouter fallback failed:", e);
        }
      }
    }

    // FALLBACK 2: Commercial Fallback Engine
    if (!imageUrl) {
      console.log("Using High-Definition Commercial Image Engine fallback...");
      try {
        const encodedPrompt = encodeURIComponent(finalPrompt.substring(0, 500));
        const seed = Math.floor(Math.random() * 1000000);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;
        
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
        }
      } catch (fallbackErr) {
        console.error("Commercial AI fallback failed:", fallbackErr);
      }
    }

    if (!imageUrl) {
      throw new Error('Échec de la génération d\'image. Veuillez réessayer.');
    }

    // Save to Cache & DB
    try {
      await supabaseClient.from("image_cache").insert({
        prompt_hash: promptHash,
        prompt: finalPrompt.substring(0, 1000),
        image_url: imageUrl,
        model: "dall-e-3",
        platform: platform || "all",
        size: "1024x1024",
        user_id: userId,
      });
    } catch (e) {
      console.warn("Cache save failed:", e);
    }

    try {
      await supabaseClient.from("generated_images").insert({
        user_id: userId,
        image_url: imageUrl,
        prompt: finalPrompt.substring(0, 500),
        product_details: { productName, niche, description, platform, style, price, promotionalPrice, benefits },
      });
    } catch (e) {
      console.warn("Database save failed:", e);
    }

    // Decrement credits
    if (!hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      try {
        if (purchasedCredits > 0) {
          await supabaseClient.from("profiles").update({ purchased_credits: Math.max(0, purchasedCredits - 1) }).eq("id", userId);
        } else if (freeGenerationsRemaining > 0) {
          await supabaseClient.from("profiles").update({ free_generations_remaining: Math.max(0, freeGenerationsRemaining - 1) }).eq("id", userId);
        }
      } catch (e) {
        console.error("Credit decrement error:", e);
      }
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        freeGenerationsRemaining: hasActiveSubscription ? null : Math.max(0, freeGenerationsRemaining - 1)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-feature-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Une erreur est survenue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});