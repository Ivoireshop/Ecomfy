import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Extract userId from verified JWT (platform already validated the token)
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload?.sub ?? null;
    } catch (e) {
      console.error("JWT parse error:", e);
    }
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check subscription status
    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();

    const hasActiveSubscription = subData?.status === "active";

    // Check free generations
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("free_generations_remaining")
      .eq("id", userId)
      .single();

    const freeGenerationsRemaining = profileData?.free_generations_remaining || 0;

    // Verify user can generate
    if (!hasActiveSubscription && freeGenerationsRemaining <= 0) {
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

    const { productName, niche, description, benefits, container, platform, style, price, posology, productImage } = await req.json();
    
    console.log("Generating visual for:", { productName, niche, platform, style });

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
    
    if (price) {
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
${price ? `- Display the price "${price}" prominently and legibly on the visual` : ''}
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
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
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Veuillez ajouter des crédits à votre compte." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error("No image generated");
    }

    // Decrement free generations if not subscribed
    let updatedFreeGenerations = freeGenerationsRemaining;
    if (!hasActiveSubscription && freeGenerationsRemaining > 0) {
      const { data: updateData } = await supabaseClient
        .from("profiles")
        .update({ free_generations_remaining: freeGenerationsRemaining - 1 })
        .eq("id", userId)
        .select("free_generations_remaining")
        .single();
      
      updatedFreeGenerations = updateData?.free_generations_remaining ?? freeGenerationsRemaining - 1;
      console.log("Decremented free generations. Remaining:", updatedFreeGenerations);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        freeGenerationsRemaining: hasActiveSubscription ? null : updatedFreeGenerations
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
