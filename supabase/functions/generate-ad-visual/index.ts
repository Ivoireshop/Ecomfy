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
    const { productName, niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription, fast } = body;
    
    const isFast = Boolean(fast);
    

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build an advanced prompt that analyzes successful ads in the niche
    let prompt = `You are an expert advertising visual creator specializing in the African market. 

CRITICAL: All text in the generated image MUST be in perfect French with NO spelling errors. Double-check every word for correct French orthography, grammar, and accents.

COMPETITIVE ANALYSIS CONTEXT:
First, mentally analyze successful advertising campaigns for "${productName}" in the ${niche} niche across Facebook, Instagram, TikTok, Pinterest, Snapchat, and Google Ads. Consider what visual elements, colors, layouts, and messaging patterns consistently perform well in this niche for African audiences.

PRODUCT INFORMATION:
- Product Name: ${productName}
- Niche: ${niche}
- Description: ${description}`;
    
    if (price && promotionalPrice) {
      prompt += `\n- Promotional Price (crossed out): ${promotionalPrice}`;
      prompt += `\n- Current Price: ${price} (MUST be prominently displayed with promotional price crossed out to show discount)`;
    } else if (price) {
      prompt += `\n- Price: ${price} (MUST be prominently displayed on the visual)`;
    }
    
    if (benefits) {
      prompt += `\n- Key Benefits: ${benefits}`;
    }
    
    if (posology) {
      prompt += `\n- Dosage/Usage: ${posology} (include this information on the visual)`;
    }
    
    if (container) {
      prompt += `\n- Container/Packaging: ${container}`;
    }
    
    if (productImage) {
      prompt += `\n\nIMPORTANT: Use the provided product image as the base. Integrate it into a professional advertising composition while maintaining the actual product appearance. DO NOT create a different product - use the exact product shown in the image.`;
    }
    
    if (personDescription) {
      prompt += `\n\nPERSON/SCENE STAGING REQUEST (OPTIONAL):
The user wants to feature a person with the product. Here's their description: "${personDescription}"
- Integrate this person naturally into the composition with the product
- The person should complement and highlight the product, not overshadow it
- Ensure the scene looks authentic and professional
- The person should be holding, using, or presenting the product in a natural way
- Match the person's style and appearance to the described niche and target audience
- Make sure the overall composition remains focused on the product as the hero element`;
    }

    prompt += `\n\nVISUAL STYLE DIRECTION:`;
    
    if (style) {
      const styleDescriptions: Record<string, string> = {
        moderne: "Modern and clean design with contemporary African aesthetics - think bold typography, vibrant gradients, and sleek product presentation",
        luxueux: "Luxury and premium design with elegant African touches - gold accents, sophisticated color palettes, refined imagery that conveys prestige and exclusivity",
        humoristique: "Fun, playful, and humorous style that resonates with African humor and culture - bright colors, expressive faces, relatable situations",
        traditionnel: "Traditional African style celebrating cultural heritage - authentic patterns (Kente, Ankara, Bogolan), warm earth tones, cultural symbols, community-focused imagery",
        minimaliste: "Minimalist and clean with African warmth - simple composition, strategic use of negative space, focus on product, subtle cultural elements",
        dynamique: "Dynamic and energetic style capturing African vibrancy - motion blur effects, bold contrasts, action-oriented composition, youthful energy",
      };
      prompt += `\n${styleDescriptions[style] || style}`;
    }
    
    // Add platform-specific requirements with best practices
    const platformSpecs: Record<string, string> = {
      facebook: "\n\nPLATFORM OPTIMIZATION: Facebook feed ad (1200x628px)\n- Inspired by top-performing Facebook ads: eye-catching headline text overlay, clear value proposition visible within 3 seconds, product prominently displayed in first 40% of image\n- Use Facebook's best practices: high contrast, mobile-first design, culturally relevant imagery",
      instagram: "\n\nPLATFORM OPTIMIZATION: Instagram square post (1080x1080px)\n- Inspired by viral Instagram ads: aesthetically pleasing composition, Instagram-native feel, lifestyle integration of product, authentic African settings\n- Incorporate trending Instagram advertising elements: bold central focus, aspirational yet relatable imagery, visual storytelling",
      tiktok: "\n\nPLATFORM OPTIMIZATION: TikTok vertical format (1080x1920px)\n- Inspired by successful TikTok ads: authentic and less polished feel, engaging hook in top third, product demonstration or transformation angle\n- TikTok advertising best practices: youthful energy, trending visual styles, stop-the-scroll impact, mobile-native vertical composition",
      all: "\n\nPLATFORM OPTIMIZATION: Multi-platform versatile design\n- Inspired by cross-platform successful ads: clear focal point works in any crop, readable text at any size, platform-agnostic color psychology\n- Universal best practices: immediate visual impact, clear brand message, culturally resonant for African audiences across all platforms",
    };
    
    if (platform) {
      prompt += platformSpecs[platform] || platformSpecs.all;
    }
    
    prompt += `\n\nCREATIVE EXECUTION INSPIRED BY TOP-PERFORMING ADS:
- Apply proven visual patterns from successful ${niche} campaigns in African markets
- Use color psychology that resonates with African consumers (warm, vibrant, trustworthy)
- Incorporate culturally relevant visual cues and symbols that build instant connection
- Design for thumb-stopping impact - the ad must make people pause their scroll
- Balance professional quality with authentic, relatable aesthetics
- Ensure the product is hero of the composition while telling a compelling story
- Use lighting and composition techniques seen in high-converting ads
${promotionalPrice && price ? `- Display the promotional price "${promotionalPrice}" crossed out (strikethrough) and the current price "${price}" prominently next to it to emphasize the discount` : price ? `- Display the price "${price}" prominently and legibly on the visual` : ''}
${posology ? `- Include dosage/usage instructions "${posology}" in a clear, readable format` : ''}

TEXT QUALITY REQUIREMENTS (CRITICAL):
- ALL text must be in PERFECT French with correct spelling, grammar, and accents
- Verify every word for orthographic accuracy before finalizing
- Use proper French typography and punctuation
- Ensure all accents (é, è, ê, à, ô, etc.) are correctly placed
- Double-check product name, price, and dosage text for errors

TECHNICAL REQUIREMENTS:
- Ultra high resolution, professional advertising photography
- Commercial product shot quality with perfect lighting
- Attention-grabbing composition that stands out in social feeds
- Optimized for fast loading while maintaining visual quality
- Colors and contrast optimized for mobile screens
- All text must be sharp, legible, and professionally rendered

Create a stunning, conversion-focused advertising visual that combines the best elements of successful ads in this niche with authentic African cultural appeal. Ensure ZERO spelling errors in all French text.`;

    console.log("Generated prompt:", prompt);

    // Build the message content - if product image is provided, include it
    const messageContent = productImage 
      ? [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: productImage,
            },
          },
        ]
      : prompt;

    // Try Lovable AI first; fallback to OpenAI if credits exhausted
    let imageUrl: string | null = null;

    const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: messageContent },
        ],
        modalities: ["image", "text"],
      }),
      timeoutMs: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes dépassée. Veuillez réessayer plus tard." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        // Fallback to OpenAI if configured
        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (OPENAI_API_KEY) {
          console.log("Lovable AI crédits insuffisants. Bascule sur OpenAI gpt-image-1.");
          const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-image-1",
              prompt,
              size: "1024x1024",
              n: 1
            }),
          });

          if (openaiResp.ok) {
            const openaiData = await openaiResp.json();
            const b64 = openaiData.data?.[0]?.b64_json;
            if (b64) {
              imageUrl = `data:image/png;base64,${b64}`;
            } else {
              console.error("OpenAI response missing b64_json", openaiData);
            }
          } else {
            const t = await openaiResp.text();
            console.error("OpenAI images API error:", openaiResp.status, t);
          }
        }

        if (!imageUrl) {
          return new Response(
            JSON.stringify({ error: "Crédits IA insuffisants. Veuillez ajouter des crédits ou configurer OPENAI_API_KEY." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        throw new Error(`AI gateway error: ${response.status}`);
      }
    }

    if (!imageUrl) {
      const data = await response.json();
      console.log("AI response received");
      console.log("Response structure:", JSON.stringify({
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        hasImages: !!data.choices?.[0]?.message?.images,
        imagesLength: data.choices?.[0]?.message?.images?.length,
        messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      }));
      
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    }
    
    if (!imageUrl) {
      console.error("No image generated by either provider.");
      throw new Error("No image generated. The AI service returned no image.");
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

    // Decrement free generations if not subscribed and not founder
    let updatedFreeGenerations = typeof freeGenerationsRemaining === "number" ? freeGenerationsRemaining : 0;
    if (!hasActiveSubscription && !isFounder && updatedFreeGenerations > 0) {
      const { data: updateData } = await supabaseClient
        .from("profiles")
        .update({ free_generations_remaining: updatedFreeGenerations - 1 })
        .eq("id", userId)
        .select("free_generations_remaining")
        .single();
      
      updatedFreeGenerations = updateData?.free_generations_remaining ?? (updatedFreeGenerations - 1);
      console.log("Decremented free generations. Remaining:", updatedFreeGenerations);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
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
