import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to enforce timeouts on external calls
async function fetchWithTimeout(input: Request | string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30000, ...rest } = init as any;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const res = await fetch(input as any, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header (required for saving images)
    const authHeader = req.headers.get("Authorization");
    
    // Create Supabase client for auth verification
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader || "" },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (!user || userError) {
      return new Response(
        JSON.stringify({ 
          error: "Authentification requise pour générer des images."
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = user.id;
    
    // Create admin client for database operations (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    let isFounder = false;
    let hasActiveSubscription = false;

    // Check founder/co-founder role for unlimited access
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      // @ts-ignore enum type differences
      .in("role", ["founder", "co_founder"]);

    isFounder = Array.isArray(roleData) && roleData.length > 0;

    // Check subscription status
    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();

    hasActiveSubscription = isFounder || subData?.status === "active";

    // Check free generations (only for non-subscribed users)
    let freeGenerationsRemaining = 0;
    if (!hasActiveSubscription) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining")
        .eq("id", userId)
        .single();

      freeGenerationsRemaining = profileData?.free_generations_remaining || 0;

      if (freeGenerationsRemaining <= 0) {
        return new Response(
          JSON.stringify({ 
            error: "Vous avez épuisé vos générations gratuites. Veuillez souscrire à un abonnement.",
            freeGenerationsRemaining: 0
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const body = await req.json();
    const { productName, niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription, fast, template, tagline, callToAction } = body;
    
    const isFast = Boolean(fast);
    

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY"); // For fallback and format generation

    // Build an advanced prompt optimized for DALL-E 3 - use template if provided
    let prompt: string;
    
    if (template && template.prompt_template) {
      // Use template prompt
      prompt = template.prompt_template
        .replace(/\{productName\}/g, productName)
        .replace(/\{niche\}/g, niche)
        .replace(/\{description\}/g, description)
        .replace(/\{benefits\}/g, benefits || '')
        .replace(/\{platform\}/g, platform)
        .replace(/\{style\}/g, style || template.style_preset)
        .replace(/\{price\}/g, price || '')
        .replace(/\{personDescription\}/g, personDescription || '');
      
      console.log("Using template prompt:", template.name);
    } else {
      // Default prompt - BACKGROUND ONLY (zero-fault workflow)
      // Optimized for DALL-E 3 (more concise, clear instructions)
      prompt = `Professional advertising background for African market, no text overlay.

Product: ${productName} (${niche})
Description: ${description}

CRITICAL: Generate ONLY the visual background/scene. Absolutely NO text, letters, words, prices, or product names in the image.`;

    
      if (benefits) {
        prompt += `\nBenefits context: ${benefits}`;
      }
      
      if (container) {
        prompt += `\nPackaging: ${container}`;
      }
      
      if (personDescription) {
        prompt += `\n\nScene: ${personDescription} - person naturally interacting with product, authentic African setting`;
      }

      const styleMap: Record<string, string> = {
        moderne: "Modern, clean, contemporary African aesthetic with vibrant gradients",
        luxueux: "Luxury premium with gold accents, sophisticated palette, refined elegance",
        humoristique: "Fun, playful, bright colors, expressive and relatable",
        traditionnel: "Traditional African heritage - Kente/Ankara patterns, warm earth tones",
        minimaliste: "Minimalist with African warmth, negative space, focused composition",
        dynamique: "Dynamic energetic, bold contrasts, motion blur, youthful vibrancy",
      };
      
      if (style) {
        prompt += `\n\nStyle: ${styleMap[style] || style}`;
      }
      
      // Platform optimization (concise for DALL-E 3)
      const platformMap: Record<string, string> = {
        facebook: "Optimized for Facebook feed - high contrast, mobile-first, eye-catching",
        instagram: "Instagram aesthetic - square composition, lifestyle feel, aspirational yet relatable",
        tiktok: "TikTok vertical - authentic feel, youthful energy, stop-the-scroll impact",
        all: "Multi-platform versatile - works in any crop, universal appeal",
      };
      
      if (platform) {
        prompt += `\nPlatform: ${platformMap[platform] || platformMap.all}`;
      }
      
      prompt += `

Visual requirements:
- Professional advertising photography quality, ultra high resolution
- Vibrant colors optimized for African market preferences (warm, trustworthy)
- Product as hero, authentic African cultural elements
- Leave 20% space TOP and BOTTOM for text overlays
- Commercial lighting, attention-grabbing composition
- Mobile-optimized contrast and clarity

ABSOLUTELY NO TEXT, letters, words, numbers, or written content. Clean background only for text overlay.`;
    }

    console.log("Generated prompt (length:", prompt.length, ")");

    // Determine image size based on platform
    let imageSize: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    if (platform === "tiktok" || platform === "instagram_story") {
      imageSize = "1024x1792"; // Vertical for stories/TikTok
    } else if (platform === "facebook") {
      imageSize = "1792x1024"; // Horizontal for Facebook feed
    }

    // Retry logic with exponential backoff for DALL-E 3
    let imageUrl: string | null = null;
    const maxRetries = 3;
    const retryDelayMs = 2000; // Start with 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries && !imageUrl; attempt++) {
      try {
        console.log(`DALL-E 3 generation attempt ${attempt}/${maxRetries}`);
        
        const dalleResponse = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            size: imageSize,
            quality: "hd", // High quality for professional ads
            style: style === "traditionnel" || style === "humoristique" ? "vivid" : "natural",
            n: 1,
          }),
          timeoutMs: 60000, // DALL-E 3 can take longer
        });

        if (dalleResponse.ok) {
          const dalleData = await dalleResponse.json();
          const generatedUrl = dalleData.data?.[0]?.url;
          
          if (generatedUrl) {
            // Convert URL to base64 for consistent storage
            console.log("DALL-E 3 image generated, converting to base64...");
            const imageResponse = await fetch(generatedUrl);
            const imageBlob = await imageResponse.blob();
            const arrayBuffer = await imageBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            
            // Convert to base64 using Deno's standard encoding
            const base64Chunks: string[] = [];
            for (let i = 0; i < bytes.length; i += 3) {
              const chunk = bytes.slice(i, i + 3);
              base64Chunks.push(btoa(String.fromCharCode(...chunk)));
            }
            const base64 = base64Chunks.join('');
            imageUrl = `data:image/png;base64,${base64}`;
            console.log("DALL-E 3 generation successful on attempt", attempt);
          } else {
            console.warn("DALL-E 3 response missing URL:", dalleData);
          }
        } else {
          const errorText = await dalleResponse.text();
          console.error(`DALL-E 3 error (attempt ${attempt}):`, dalleResponse.status, errorText);
          
          // Handle rate limits with exponential backoff
          if (dalleResponse.status === 429 && attempt < maxRetries) {
            const delay = retryDelayMs * Math.pow(2, attempt - 1);
            console.log(`Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // Handle content policy violations
          if (dalleResponse.status === 400 && errorText.includes("content_policy")) {
            return new Response(
              JSON.stringify({ 
                error: "Le contenu demandé viole la politique d'utilisation. Veuillez modifier votre description." 
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          
          // If last attempt, break to try fallback
          if (attempt === maxRetries) {
            break;
          }
        }
      } catch (err) {
        console.error(`DALL-E 3 attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Fallback to Lovable AI if DALL-E 3 failed after retries
    if (!imageUrl) {
      console.log("DALL-E 3 failed after retries, falling back to Lovable AI...");
      
      if (LOVABLE_API_KEY) {
        try {
          const fallbackResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [
                { role: "user", content: prompt },
              ],
              modalities: ["image", "text"],
            }),
            timeoutMs: 45000,
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            imageUrl = fallbackData.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
            if (imageUrl) {
              console.log("Fallback to Lovable AI successful");
            }
          }
        } catch (fallbackErr) {
          console.error("Lovable AI fallback failed:", fallbackErr);
        }
      }
    }
    
    if (!imageUrl) {
      console.error("All generation attempts failed");
      return new Response(
        JSON.stringify({ 
          error: "Échec de la génération d'image après plusieurs tentatives. Veuillez réessayer." 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Save the generated image to the database
    const { data: savedImage, error: saveError } = await supabaseClient
      .from("generated_images")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        prompt: prompt.substring(0, 500),
        product_details: {
          productName,
          niche,
          description,
          platform,
          style,
          price,
          promotionalPrice,
          benefits,
          tagline,
          callToAction,
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving image:", saveError);
      // Don't fail the request, just log the error
    }

    // Generate multiple formats for paid subscribers
    const additionalFormats: any[] = [];
    if (!isFast && hasActiveSubscription && savedImage) {
      console.log("Generating additional formats for paid subscriber");
      
      const formats = [
        { name: "Facebook Feed", size: "1200x628", platform: "facebook" },
        { name: "Facebook Story", size: "1080x1920", platform: "facebook" },
        { name: "Instagram Feed", size: "1080x1080", platform: "instagram" },
        { name: "Instagram Story", size: "1080x1920", platform: "instagram" },
        { name: "TikTok", size: "1080x1920", platform: "tiktok" },
        { name: "E-commerce", size: "1200x1200", platform: "ecommerce" },
      ];

      for (const format of formats) {
        try {
          const resizePrompt = `Resize and adapt this advertising visual to ${format.size} pixels for ${format.name}. Maintain all text readability and ensure the product is prominently displayed. Optimize the layout for the aspect ratio without losing important information.`;
          
          const resizeResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: resizePrompt },
                    { type: "image_url", image_url: { url: imageUrl } },
                  ],
                },
              ],
              modalities: ["image", "text"],
            }),
            timeoutMs: 20000,
          });

          if (resizeResponse.ok) {
            const resizeData = await resizeResponse.json();
            const formatImageUrl = resizeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            
            if (formatImageUrl) {
              // Save format to database
              await supabaseClient
                .from("image_formats")
                .insert({
                  image_id: savedImage.id,
                  format_name: format.name,
                  format_size: format.size,
                  platform: format.platform,
                  image_url: formatImageUrl,
                });
              
              additionalFormats.push({
                name: format.name,
                size: format.size,
                url: formatImageUrl,
              });
              
              console.log(`Generated ${format.name} format`);
            }
          }
        } catch (formatError) {
          console.error(`Error generating ${format.name}:`, formatError);
          // Continue with other formats even if one fails
        }
      }
    }

    // Decrement free generations if not subscribed and not founder (must use admin client to bypass RLS)
    let updatedFreeGenerations = typeof freeGenerationsRemaining === "number" ? freeGenerationsRemaining : 0;
    if (userId && !hasActiveSubscription && !isFounder && updatedFreeGenerations > 0) {
      // Create admin client to bypass RLS for profile updates
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const { data: updateData, error: updateError } = await adminClient
        .from("profiles")
        .update({ free_generations_remaining: updatedFreeGenerations - 1 })
        .eq("id", userId)
        .select("free_generations_remaining")
        .single();
      
      if (updateError) {
        console.error("Error decrementing free generations:", updateError);
      }
      
      updatedFreeGenerations = updateData?.free_generations_remaining ?? (updatedFreeGenerations - 1);
      console.log("Decremented free generations. Remaining:", updatedFreeGenerations);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        imageId: savedImage?.id || null,
        saved: !!savedImage,
        freeGenerationsRemaining: hasActiveSubscription ? null : updatedFreeGenerations,
        additionalFormats: hasActiveSubscription ? additionalFormats : [],
        hasMultipleFormats: hasActiveSubscription && additionalFormats.length > 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-ad-visual function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
