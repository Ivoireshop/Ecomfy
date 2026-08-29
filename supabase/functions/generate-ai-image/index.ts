import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "generate-ai-image");
  if (!__quota.allowed) return __quota.response;


  try {
    // Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (!user || userError) {
      return new Response(
        JSON.stringify({ error: "Authentification invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check credits
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
    if (!hasActiveSubscription && !isFounder) {
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
    const { mode, prompt, style, sourceImage, bannerImage, replacementPhoto, newText, preset } = body;

    const OPENAI_API_KEY = getOpenAiApiKey();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY && !OPENROUTER_API_KEY) {
      throw new Error("Aucune clé API configurée pour la génération");
    }

    let imageUrl: string = "";

    // Build enhanced prompt based on mode
    let enhancedPrompt = "";

    switch (mode) {
      case "text-to-image":
        enhancedPrompt = buildTextToImagePrompt(prompt, style);
        break;
      case "image-edit":
        enhancedPrompt = buildImageEditPrompt(prompt, style);
        break;
      case "banner":
        enhancedPrompt = buildBannerPrompt(prompt, style, preset);
        break;
      case "banner-replace":
        enhancedPrompt = buildBannerReplacePrompt(prompt, newText, style, preset);
        break;
      default:
        enhancedPrompt = prompt;
    }

    console.log(`Mode: ${mode}, Prompt length: ${enhancedPrompt.length}`);

    // For modes with source images, use GPT-4o-mini Vision to analyze the uploaded product image
    const imageToAnalyze = sourceImage || bannerImage || replacementPhoto;
    if (imageToAnalyze) {
      console.log("Analyzing uploaded media with GPT-4o-mini Vision...");
      const visionAnalysis = await analyzeImageWithGpt4oMini(
        imageToAnalyze,
        `Analyze this product/media image in detail. Describe its colors, object details, packaging, and ideal advertising environment in 2 concise sentences in English.`
      );
      if (visionAnalysis) {
        enhancedPrompt += `\n\nSource Product Features (from GPT-4o-mini Vision): ${visionAnalysis}`;
      }
    }

    // Optimize overall prompt with GPT-4o-mini
    enhancedPrompt = await optimizePromptWithGpt4oMini(enhancedPrompt);

    // Generate pure image using OpenAI DALL-E 3 / primary engines
    imageUrl = await generatePureImage(LOVABLE_API_KEY, enhancedPrompt);

    // Save to generated_images
    await supabaseClient.from("generated_images").insert({
      user_id: userId,
      image_url: imageUrl,
      prompt: enhancedPrompt.substring(0, 500),
      product_details: {
        mode,
        style,
        preset: preset?.name || null,
        originalPrompt: prompt
      }
    });

    // Decrement credits
    if (!hasActiveSubscription && !isFounder) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .single();

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
      JSON.stringify({ imageUrl, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generatePureImage(lovableApiKey: string, prompt: string): Promise<string> {
  // Primary: OpenAI DALL-E 3
  const openAiApiKey = getOpenAiApiKey();
  if (openAiApiKey) {
    try {
      console.log("Generating image with OpenAI DALL-E 3...");
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.substring(0, 1000),
          size: "1024x1024",
          quality: "standard",
          response_format: "b64_json",
          n: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        if (b64) return `data:image/png;base64,${b64}`;
        const url = data.data?.[0]?.url;
        if (url) return url;
      } else {
        const errorText = await res.text();
        console.warn("OpenAI DALL-E 3 generation failed:", res.status, errorText);
      }
    } catch (err) {
      console.error("DALL-E 3 call error:", err);
    }
  }

  // Fallback 1: OpenRouter
  const openRouterKey = getOpenRouterKey();
  if (openRouterKey) {
    try {
      return await generateImageWithOpenRouter(openRouterKey, { prompt });
    } catch (e) {
      console.warn("OpenRouter failed, falling back to Lovable AI Gateway:", e);
    }
  }

  // Fallback 2: Lovable AI Gateway
  if (lovableApiKey) {
    console.log("Generating image via Lovable AI Gateway (fallback)");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (generatedImageUrl) return generatedImageUrl;
    }
  }

  throw new Error("Impossible de générer l'image. Tous les moteurs d'images sont indisponibles.");
}

function buildTextToImagePrompt(prompt: string, style: string): string {
  const styleDescriptions: Record<string, string> = {
    professional: "professional, clean, high-quality commercial photography style",
    creative: "creative, artistic, unique and visually striking",
    minimalist: "minimalist, clean lines, simple and elegant",
    vibrant: "vibrant colors, energetic, eye-catching",
    luxury: "luxury, premium, sophisticated and refined",
    modern: "modern, contemporary, trendy and stylish",
  };

  return `${prompt}

Style: ${styleDescriptions[style] || styleDescriptions.professional}

Requirements:
- Ultra high resolution, professional quality
- Optimized for African market aesthetic preferences
- Clean composition, visually appealing
- Commercial advertising quality`;
}

function buildImageEditPrompt(prompt: string, style: string): string {
  return `Edit this image according to the following instructions:

${prompt}

Apply a ${style} style to the final result.

Requirements:
- Maintain the essence of the original image
- Apply professional retouching
- Ensure high quality output
- Make the image suitable for advertising and marketing`;
}

function buildBannerPrompt(prompt: string, style: string, preset?: any): string {
  const dimensions = preset ? `${preset.width}x${preset.height} (${preset.name})` : "professional banner";
  
  return `Create a professional banner/cover image:

${prompt}

Format: ${dimensions}
Platform: ${preset?.platform || "multi-platform"}
Style: ${style}

Requirements:
- Professional advertising banner quality
- Clear visual hierarchy
- Space for text overlays if needed
- High contrast and readability
- Optimized for ${preset?.platform || "social media"}
- African market aesthetic preferences
- Eye-catching and engaging
- Ultra high resolution`;
}

function buildBannerReplacePrompt(prompt: string, newText: string, style: string, preset?: any): string {
  return `Recreate this banner/thumbnail design with the following modifications:

1. Replace the person in the original banner with the person from the second image (my photo)
2. Replace any text with this new text: "${newText}"
3. Keep the same overall design style and layout as the original banner
4. ${prompt || "Maintain professional quality and aesthetics"}

Style: ${style}
Format: ${preset ? `${preset.width}x${preset.height}` : "match original"}

Requirements:
- Seamlessly integrate the new person into the design
- Match the lighting and color grading of the original
- Ensure the new text is readable and well-positioned
- Professional advertising quality
- Keep the same energy and vibe as the original
- Ultra high resolution output`;
}
