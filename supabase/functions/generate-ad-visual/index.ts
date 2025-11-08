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
    

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build an advanced prompt - use template if provided
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
      prompt = `You are an expert advertising visual creator specializing in the African market.

IMPORTANT: Generate ONLY the background/scene for this advertisement. DO NOT include any text, product names, prices, or written content in the image. The text will be added separately as vector overlays to ensure perfect spelling.

COMPETITIVE ANALYSIS CONTEXT:
Analyze successful advertising campaigns for "${productName}" in the ${niche} niche across Facebook, Instagram, TikTok, Pinterest, Snapchat, and Google Ads. Consider what visual elements, colors, layouts, and composition patterns consistently perform well for African audiences.

PRODUCT CONTEXT (for background design only):
- Product Name: ${productName}
- Niche: ${niche}
- Description: ${description}`;
    
      if (price) {
        prompt += `\n- Price context: ${price}${promotionalPrice ? ` (promotional discount from ${promotionalPrice})` : ''} (for visual context only - DO NOT write this text in the image)`;
      }
      
      if (benefits) {
        prompt += `\n- Key Benefits: ${benefits} (for visual theme only - DO NOT write this text in the image)`;
      }
      
      if (posology) {
        prompt += `\n- Dosage/Usage context: ${posology} (for visual theme only - DO NOT write this text in the image)`;
      }
      
      if (container) {
        prompt += `\n- Container/Packaging: ${container}`;
      }
      
      if (productImage) {
        prompt += `\n\nIMPORTANT: Use EXACTLY the provided product image as the hero.\n- DO NOT invent/imagine another product, packaging, logo or brand\n- Faithfully preserve the shape, label, colors and identity of the product\n- The provided product must be the HERO of the composition\n- You can add scenery, decorative elements AROUND the product without replacing it\n- If a person is present, they must interact with THIS product (hold/present/use it)\n- Leave space for text overlays (product name at top, price at bottom)\n- DO NOT add any text to the image`;
      }
      
      if (personDescription) {
      prompt += `\n\nPERSON/SCENE STAGING REQUEST (OPTIONAL):
The user wants to feature a person with the product. Description: "${personDescription}"
- Integrate this person naturally into the composition with the product
- The person should complement and highlight the product, not overshadow it
- Ensure the scene looks authentic and professional
- The person should be holding, using, or presenting the product naturally
- Match the person's style to the niche and target audience
- Leave clear space for text overlays (top and bottom areas)`;
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
      
      prompt += `\n\nCREATIVE EXECUTION - BACKGROUND ONLY:
- Apply proven visual patterns from successful ${niche} campaigns in African markets
- Use color psychology that resonates with African consumers (warm, vibrant, trustworthy)
- Incorporate culturally relevant visual cues and symbols that build instant connection
- Design for thumb-stopping impact with strong visual hierarchy
- Balance professional quality with authentic, relatable aesthetics
- Ensure the product is hero of the composition while leaving clear space for text overlays
- Use lighting and composition techniques seen in high-converting ads
- Leave prominent space at the TOP for product name (approximately 15-20% of image height)
- Leave clear space at the BOTTOM for price and call-to-action (approximately 15-20% of image height)
- Create visual breathing room in key areas for text legibility

CRITICAL - NO TEXT RULE:
- DO NOT include any written text, letters, words, numbers, or symbols in the generated image
- DO NOT write the product name, price, benefits, or any other text
- DO NOT add labels, captions, or typography
- The image should be a clean background/scene ready for text overlay
- Focus purely on creating an engaging visual backdrop that supports the product

TECHNICAL REQUIREMENTS:
- Ultra high resolution, professional advertising photography quality
- Commercial product shot quality with perfect lighting
- Attention-grabbing composition that stands out in social feeds
- Optimized color and contrast for mobile screens
- Clear focal point for the product as the hero
- Balanced composition with designated text areas

Create a stunning, conversion-focused advertising background that combines the best visual elements of successful ads in this niche with authentic African cultural appeal. Remember: ABSOLUTELY NO TEXT in the generated image.`;
    }

    console.log("Generated prompt:", prompt);

    // Build the message content - if product image is provided, include it FIRST to enforce conditioning
    const messageContent = productImage 
      ? [
          {
            type: "image_url",
            image_url: { url: productImage },
          },
          {
            type: "text",
            text: prompt,
          }
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
      timeoutMs: 45000,
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
