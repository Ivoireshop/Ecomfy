import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

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

    if (!hasActiveSubscription && !isFounder) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .single();

      const freeGenerationsRemaining = profileData?.free_generations_remaining || 0;
      const purchasedCredits = profileData?.purchased_credits || 0;

      if (freeGenerationsRemaining <= 0 && purchasedCredits <= 0) {
        return new Response(
          JSON.stringify({ error: "Crédits épuisés. Veuillez souscrire à un abonnement." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { mode, prompt, style, sourceImage, bannerImage, replacementPhoto, newText, preset } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    // For modes with source images, use image editing
    if ((mode === "image-edit" || mode === "banner" || mode === "banner-replace") && 
        (sourceImage || bannerImage)) {
      // Use GPT-image-1 with image input for editing
      const messages: any[] = [
        {
          role: "user",
          content: []
        }
      ];

      // Add text instruction
      messages[0].content.push({
        type: "text",
        text: enhancedPrompt
      });

      // Add images based on mode
      if (mode === "image-edit" && sourceImage) {
        messages[0].content.push({
          type: "image_url",
          image_url: { url: sourceImage }
        });
      } else if (mode === "banner" && sourceImage) {
        messages[0].content.push({
          type: "image_url",
          image_url: { url: sourceImage }
        });
      } else if (mode === "banner-replace") {
        if (bannerImage) {
          messages[0].content.push({
            type: "image_url",
            image_url: { url: bannerImage }
          });
        }
        if (replacementPhoto) {
          messages[0].content.push({
            type: "image_url",
            image_url: { url: replacementPhoto }
          });
        }
      }

      console.log("Using image editing with GPT vision + image generation");

      // Primary: OpenRouter
      const openRouterKey = getOpenRouterKey();
      const refImages: string[] = [];
      if (mode === "image-edit" && sourceImage) refImages.push(sourceImage);
      else if (mode === "banner" && sourceImage) refImages.push(sourceImage);
      else if (mode === "banner-replace") {
        if (bannerImage) refImages.push(bannerImage);
        if (replacementPhoto) refImages.push(replacementPhoto);
      }

      if (openRouterKey) {
        try {
          imageUrl = await generateImageWithOpenRouter(openRouterKey, {
            prompt: enhancedPrompt,
            referenceImages: refImages,
          });
        } catch (e) {
          console.warn("OpenRouter edit failed, falling back to Lovable Gateway:", e);
        }
      }

      // Fallback: Lovable AI gateway
      const editResponse = imageUrl ? null : await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: messages,
          modalities: ["image", "text"]
        }),
      });

      if (!imageUrl && editResponse) {
        if (!editResponse.ok) {
          const errorText = await editResponse.text();
          console.error("Edit API error:", errorText);
          throw new Error(`Erreur de l'API d'édition: ${editResponse.status}`);
        }
        const editData = await editResponse.json();
        const generatedImageData = editData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!generatedImageData) {
          console.log("No image returned from edit API, falling back to generation");
          imageUrl = await generatePureImage(LOVABLE_API_KEY, enhancedPrompt);
        } else {
          imageUrl = generatedImageData;
        }
      }
    } else {
      // Pure text-to-image generation
      imageUrl = await generatePureImage(LOVABLE_API_KEY, enhancedPrompt);
    }

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
  // Primary: OpenRouter (auto-routes to best image model)
  const openRouterKey = getOpenRouterKey();
  if (openRouterKey) {
    try {
      return await generateImageWithOpenRouter(openRouterKey, { prompt });
    } catch (e) {
      console.warn("OpenRouter failed, falling back to Lovable AI Gateway:", e);
    }
  }

  console.log("Generating image via Lovable AI Gateway (fallback)");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI Gateway error:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("Trop de requêtes, veuillez réessayer dans quelques instants.");
    }
    if (response.status === 402) {
      throw new Error("Crédits IA épuisés. Veuillez recharger vos crédits.");
    }
    throw new Error(`Erreur de génération d'image: ${response.status}`);
  }

  const data = await response.json();
  const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!generatedImageUrl) {
    throw new Error("Aucune image générée");
  }

  return generatedImageUrl;
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
