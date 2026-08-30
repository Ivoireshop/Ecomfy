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
    const { mode, prompt = "", userPrompt = "", style, sourceImage, bannerImage, replacementPhoto, newText, preset, aspectRatio = "1:1", size } = body;

    const OPENAI_API_KEY = getOpenAiApiKey();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY && !OPENROUTER_API_KEY) {
      throw new Error("Aucune clé API configurée pour la génération");
    }

    // Determine target DALL-E 3 image resolution
    let imageSize = "1024x1024";
    if (size) {
      imageSize = size;
    } else if (aspectRatio === "9:16") {
      imageSize = "1024x1792";
    } else if (aspectRatio === "16:9") {
      imageSize = "1792x1024";
    }

    const sacredPrompt = (prompt || userPrompt || "").trim();
    let structuredPrompt = `[PRIMARY USER DEMAND - MANDATORY INSTRUCTION]:\n${sacredPrompt}\n\n`;

    const imageToAnalyze = sourceImage || bannerImage || replacementPhoto;
    if (imageToAnalyze) {
      console.log("Analyzing uploaded reference photo with GPT-4o Vision...");
      const visionAnalysis = await analyzeImageWithGpt4oMini(
        imageToAnalyze,
        `Perform an ultra-high precision commercial product visual audit of this uploaded reference image.
Describe in detail (in English) so OpenAI DALL-E 3 can recreate this EXACT product faithfully:
1. EXACT PRODUCT IDENTITY: Product type, container/packaging shape (bottle, box, jar, tube, bag, etc.), materials (glass, matte plastic, gold metal, leather, fabric), cap/closure style.
2. COLOR PALETTE: Primary, secondary, and accent colors, gradients, metallic foils, label colors.
3. BRANDING & TEXT: Logo placement, label design, typography style, key visible branding elements.
4. TEXTURE & FINISH: Glossy, reflective, matte, embossed, woven, transparent.
Format as a clear, structured prompt fragment designed for DALL-E 3 to faithfully recreate this exact product hero element in a professional ad background.`
      );
      if (visionAnalysis) {
        structuredPrompt += `[EXACT PRODUCT VISUAL IDENTITY - MUST REPRODUCE FAITHFULLY]:\n${visionAnalysis}\n\n`;
      }
    }

    structuredPrompt += `[STYLE & ADVERTISING DIRECTIVES]:\nStyle: ${style || "professional studio"}. High-resolution commercial studio photography, HD 8k, sharp focus, vibrant commercial lighting.`;

    const finalPrompt = await optimizePromptWithGpt4oMini(structuredPrompt);

    console.log(`Mode: ${mode}, Size: ${imageSize}, Final Prompt length: ${finalPrompt.length}`);

    // Generate pure HD image using OpenAI DALL-E 3
    const imageUrl = await generatePureImage(OPENAI_API_KEY, finalPrompt, imageSize);

    // Save to generated_images
    await supabaseClient.from("generated_images").insert({
      user_id: userId,
      image_url: imageUrl,
      prompt: finalPrompt.substring(0, 500),
      product_details: {
        mode,
        style,
        preset: preset?.name || null,
        originalPrompt: sacredPrompt,
        size: imageSize
      }
    });

    // Decrement credits
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
      JSON.stringify({ imageUrl, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-ai-image:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generatePureImage(openAiApiKey: string, prompt: string, size: string = "1024x1024"): Promise<string> {
  if (openAiApiKey) {
    try {
      console.log(`Generating HD image with OpenAI DALL-E 3 (${size}, HD quality)...`);
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.substring(0, 3800),
          size,
          quality: "hd", // HD Quality for ChatGPT Plus rendering
          n: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const generatedUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (generatedUrl) return generatedUrl;
      } else {
        const errBody = await res.text();
        console.warn("OpenAI DALL-E 3 HD failed:", res.status, errBody);

        // Retry with standard quality if HD quality has billing/tier limits
        console.log("Retrying OpenAI DALL-E 3 standard quality...");
        const resStd = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt.substring(0, 3800),
            size,
            quality: "standard",
            n: 1,
          }),
        });

        if (resStd.ok) {
          const dataStd = await resStd.json();
          const urlStd = dataStd.data?.[0]?.url || (dataStd.data?.[0]?.b64_json ? `data:image/png;base64,${dataStd.data[0].b64_json}` : null);
          if (urlStd) return urlStd;
        }
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
      console.warn("OpenRouter fallback failed:", e);
    }
  }

  // Fallback 2: High-Definition Commercial Image Engine (Pollinations.ai)
  try {
    console.log("Using High-Definition Commercial Image Engine fallback...");
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 500));
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;
    
    const imageResp = await fetch(pollinationsUrl);
    if (imageResp.ok && imageResp.headers.get("content-type")?.includes("image")) {
      const blob = await imageResp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      console.log("Commercial fallback engine image generated successfully!");
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (pollErr) {
    console.warn("Commercial fallback engine exception:", pollErr);
  }

  throw new Error("Impossible de générer l'image. Tous les moteurs d'images sont indisponibles.");
}
