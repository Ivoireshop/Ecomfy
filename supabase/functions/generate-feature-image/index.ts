import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to enforce timeouts on external calls
async function fetchWithTimeout(input: Request | string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20000, ...rest } = init as any;
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


  // Create admin client with SERVICE_ROLE_KEY for all database operations
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Get JWT from Authorization header - REQUIRED
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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
    
    // Extract token and verify with service role client
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (!user || userError) {
      console.error("Auth error:", userError);
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

    /* TEMPORARILY DISABLED
    // Check free generations (only for non-subscribed users)
    let freeGenerationsRemaining = 0;
    let purchasedCredits = 0;
    if (!hasActiveSubscription) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .single();

      freeGenerationsRemaining = profileData?.free_generations_remaining || 0;
      purchasedCredits = profileData?.purchased_credits || 0;

      // Check if user has any credits available (free or purchased)
      if (freeGenerationsRemaining <= 0 && purchasedCredits <= 0) {
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
    */

    const body = await req.json();
    const { prompt, productName, niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription } = body;
    
    if (!prompt && !productName) {
      return new Response(
        JSON.stringify({ error: 'Prompt or product information is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build professional advertising prompt if product details provided
    let finalPrompt = prompt;
    
    if (productName) {
      finalPrompt = `You are an expert advertising visual creator specializing in the African market. 

CRITICAL: All text in the generated image MUST be in perfect French with NO spelling errors. Double-check every word for correct French orthography, grammar, and accents.

PRODUCT INFORMATION:
- Product Name: ${productName}
- Niche: ${niche || 'Général'}
- Description: ${description || ''}`;
      
      if (price && promotionalPrice) {
        finalPrompt += `\n- Promotional Price (crossed out): ${promotionalPrice}`;
        finalPrompt += `\n- Current Price: ${price} (MUST be prominently displayed with promotional price crossed out to show discount)`;
      } else if (price) {
        finalPrompt += `\n- Price: ${price} (MUST be prominently displayed on the visual)`;
      }
      
      if (benefits) {
        finalPrompt += `\n- Key Benefits: ${benefits}`;
      }
      
      if (posology) {
        finalPrompt += `\n- Dosage/Usage: ${posology} (include this information on the visual)`;
      }
      
      if (container) {
        finalPrompt += `\n- Container/Packaging: ${container}`;
      }
      
      if (personDescription) {
        finalPrompt += `\n\nPERSON/SCENE STAGING:\nThe user wants to feature a person with the product. Description: "${personDescription}"\n- Integrate this person naturally with the product\n- The person should complement and highlight the product\n- Ensure authentic and professional scene`;
      }

      if (productImage) {
        finalPrompt += `\n\nIMPORTANT ET OBLIGATOIRE: Utilise EXACTEMENT l'image de produit fournie comme base.\n- NE PAS inventer/imaginer un autre produit, emballage, logo ou marque\n- Conserver fidèlement la forme, l'étiquette, les couleurs et l'identité du produit\n- Le produit fourni doit être le HÉROS de la composition\n- Tu peux ajouter un décor, des textes et des éléments graphiques AUTOUR du produit sans le remplacer\n- Si un personnage est présent, il doit interagir avec CE produit (le tenir/présenter/utiliser)\n- Refuse toute substitution de produit.`;
      }

      finalPrompt += `\n\nVISUAL STYLE:`;
      
      if (style) {
        const styleDescriptions: Record<string, string> = {
          moderne: "Modern and clean design with contemporary African aesthetics - bold typography, vibrant colors, sleek product presentation",
          luxueux: "Luxury and premium design with elegant African touches - gold accents, sophisticated palettes, refined imagery",
          humoristique: "Fun, playful style resonating with African humor - bright colors, expressive faces, relatable situations",
          traditionnel: "Traditional African style celebrating cultural heritage - authentic patterns, warm earth tones, cultural symbols",
          minimaliste: "Minimalist and clean with African warmth - simple composition, focus on product, subtle cultural elements",
          dynamique: "Dynamic and energetic style capturing African vibrancy - motion effects, bold contrasts, youthful energy",
        };
        finalPrompt += `\n${styleDescriptions[style] || style}`;
      }
      
      const platformSpecs: Record<string, string> = {
        facebook: "\n\nFacebook ad (1200x628px): eye-catching headline, clear value proposition, product prominently displayed, high contrast, mobile-first design",
        instagram: "\n\nInstagram post (1080x1080px): aesthetically pleasing, lifestyle integration, authentic African settings, bold central focus",
        tiktok: "\n\nTikTok vertical (1080x1920px): authentic feel, engaging hook in top third, product demonstration angle, youthful energy",
        all: "\n\nMulti-platform versatile: clear focal point, readable text at any size, immediate visual impact, culturally resonant",
      };
      
      if (platform) {
        finalPrompt += platformSpecs[platform] || platformSpecs.all;
      }
      
      finalPrompt += `\n\nCREATIVE EXECUTION FOR FACEBOOK ADVERTISING:
- Create a professional advertising visual optimized for social media
- Use vibrant, attention-grabbing colors that work on mobile screens
- Product must be the hero of the composition with clear visibility
- Include the product in a real-world context or lifestyle setting
- Show the product being used or its benefits in action
- Use authentic African models, settings, or cultural elements when relevant
- Professional photography quality with perfect lighting and composition
- Text overlays must be bold, readable, and in perfect French
- Create thumb-stopping impact that makes people pause their scroll
- Balance professional quality with authentic, relatable aesthetics
${promotionalPrice && price ? `- Display promotional price "${promotionalPrice}" crossed out and current price "${price}" prominently to show discount` : price ? `- Display price "${price}" prominently and legibly` : ''}
${posology ? `- Include dosage/usage "${posology}" in clear, readable format` : ''}

TEXT REQUIREMENTS (CRITICAL):
- ALL text in PERFECT French with correct spelling, grammar, and accents
- Verify every word for orthographic accuracy
- Use proper French typography and punctuation
- Ensure all accents (é, è, ê, à, ô, etc.) are correctly placed

TECHNICAL SPECIFICATIONS:
- Ultra high resolution, professional advertising photography
- Commercial product shot quality
- Optimized for social media feeds (Facebook, Instagram)
- Colors and contrast optimized for mobile screens
- All text sharp, legible, and professionally rendered
- Create a conversion-focused advertising visual with authentic African appeal

Create a stunning Facebook advertising visual that looks like a professional marketing campaign. ZERO spelling errors in French text.`;
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY'); // For fallback

    // Helper function to generate a hash for cache lookup
    const generatePromptHash = async (text: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // === CACHE LOOKUP ===
    const promptHash = await generatePromptHash(finalPrompt);
    console.log("Looking up cache for hash:", promptHash.substring(0, 16) + "...");
    
    const { data: cachedImage, error: cacheError } = await supabaseClient
      .from("image_cache")
      .select("id, image_url, access_count")
      .eq("prompt_hash", promptHash)
      .single();

    if (cachedImage && !cacheError) {
      console.log("Cache HIT! Returning cached image");
      
      // Update cache stats
      await supabaseClient
        .from("image_cache")
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: (cachedImage.access_count || 1) + 1
        })
        .eq("id", cachedImage.id);

      // Save to user's library
      await supabaseClient.from("generated_images").insert({
        user_id: userId,
        image_url: cachedImage.image_url,
        prompt: finalPrompt.substring(0, 500),
        product_details: { productName, niche, description, platform, style, price, promotionalPrice, benefits, cached: true },
      });

      // Decrement credits
      if (!hasActiveSubscription && !isFounder) {
        if (purchasedCredits > 0) {
          await supabaseClient.from("profiles").update({ purchased_credits: purchasedCredits - 1 }).eq("id", userId);
        } else if (freeGenerationsRemaining > 0) {
          await supabaseClient.from("profiles").update({ free_generations_remaining: freeGenerationsRemaining - 1 }).eq("id", userId);
        }
      }

      return new Response(
        JSON.stringify({ imageUrl: cachedImage.image_url, cached: true, freeGenerationsRemaining: hasActiveSubscription ? null : Math.max(0, freeGenerationsRemaining - 1) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Cache MISS. Generating with GPT-image-1 (latest OpenAI model)...");

    // Use GPT-image-1 as primary model
    let imageUrl: string | null = null;
    let usedFallback = false;

    // PRIMARY: OpenRouter (auto-routes to best image model with new API key)
    const openRouterKey = getOpenRouterKey();
    if (openRouterKey) {
      try {
        console.log("Trying OpenRouter as primary image provider...");
        imageUrl = await generateImageWithOpenRouter(openRouterKey, {
          prompt: finalPrompt,
          referenceImages: productImage ? [productImage] : [],
        });
      } catch (e) {
        console.warn("OpenRouter primary failed, falling back to GPT-image-1:", e);
      }
    }

    if (!imageUrl) try {
      const openaiResp = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: finalPrompt,
          size: '1024x1024',
          quality: 'high',
          n: 1,
        }),
        timeoutMs: 90000, // GPT-image-1 can take longer for high quality
      });

      if (openaiResp.ok) {
        const openaiData = await openaiResp.json();
        const b64 = openaiData.data?.[0]?.b64_json;
        if (b64) {
          imageUrl = `data:image/png;base64,${b64}`;
          console.log('GPT-image-1 generation successful');
        } else {
          // Fallback to URL if b64_json not present
          const generatedUrl = openaiData.data?.[0]?.url;
          if (generatedUrl) {
            console.log("GPT-image-1 returned URL, converting to base64...");
            const imgResp = await fetch(generatedUrl);
            const imgBlob = await imgResp.blob();
            const arrayBuffer = await imgBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            imageUrl = `data:image/png;base64,${btoa(binary)}`;
          }
        }
      } else {
        const errorText = await openaiResp.text();
        console.error('GPT-image-1 error:', openaiResp.status, errorText);
        
        // Handle content policy violations
        if (openaiResp.status === 400 && errorText.includes("content_policy")) {
          return new Response(
            JSON.stringify({ 
              error: "L'IA a refusé de générer cette image. Veuillez modifier la description du produit pour respecter les politiques de contenu."
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Try fallback to Lovable AI
        if (LOVABLE_API_KEY) {
          console.log('GPT-image-1 failed, falling back to Lovable AI...');
          usedFallback = true;
        }
      }
    } catch (e) {
      console.error('GPT-image-1 request failed:', e);
      if (LOVABLE_API_KEY) {
        console.log('Falling back to Lovable AI...');
        usedFallback = true;
      }
    }
    
    // Fallback to Lovable AI if GPT-image-1 failed
    if (!imageUrl && usedFallback && LOVABLE_API_KEY) {
      try {
        const messageContent = productImage 
          ? [
              { type: "image_url", image_url: { url: productImage } },
              { type: "text", text: finalPrompt },
            ]
          : finalPrompt;

        const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-1.5-flash',
            messages: [{ role: 'user', content: messageContent }],
            modalities: ['image', 'text']
          }),
          timeoutMs: 45000,
        });

        if (response.ok) {
          const data = await response.json();
          imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
                     data.choices?.[0]?.message?.images?.[0]?.url ||
                     null;
          if (imageUrl) {
            console.log('Lovable AI fallback successful');
          }
        } else if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Limite de requêtes dépassée. Veuillez réessayer plus tard.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Crédits IA épuisés. Veuillez réessayer plus tard.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (fallbackErr) {
        console.error('Lovable AI fallback failed:', fallbackErr);
      }
    }
    
    if (!imageUrl) {
      throw new Error('Échec de la génération d\'image. Veuillez réessayer.');
    }

    console.log('Image generated successfully');

    // === SAVE TO CACHE ===
    console.log("Saving image to cache with hash:", promptHash.substring(0, 16) + "...");
    await supabaseClient
      .from("image_cache")
      .insert({
        prompt_hash: promptHash,
        prompt: finalPrompt.substring(0, 1000),
        image_url: imageUrl,
        model: "gpt-image-1",
        platform: platform || "all",
        size: "1024x1024",
        user_id: userId,
      });

    console.log('Image URL extracted successfully');

    // Save image to database FIRST (server-side storage)
    const { data: savedImage, error: saveError } = await supabaseClient
      .from("generated_images")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        prompt: finalPrompt.substring(0, 500),
        product_details: {
          productName,
          niche,
          description,
          platform,
          style,
          price,
          promotionalPrice,
          benefits,
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving image:", saveError);
      // Continue even if save fails
    } else {
      console.log("Image saved to database successfully");
    }

    // Decrement free generations if not subscribed and not founder
    let updatedFreeGenerations = typeof freeGenerationsRemaining === "number" ? freeGenerationsRemaining : 0;
    if (!hasActiveSubscription && !isFounder && updatedFreeGenerations > 0) {
      // Use purchased credits first if available
      if (purchasedCredits > 0) {
        const { data: updateData, error: updateError } = await supabaseClient
          .from("profiles")
          .update({ purchased_credits: purchasedCredits - 1 })
          .eq("id", userId)
          .select("purchased_credits, free_generations_remaining")
          .single();
        
        if (updateError) {
          console.error("Error decrementing purchased credits:", updateError);
        } else {
          console.log("Decremented purchased credits. Remaining:", updateData?.purchased_credits);
          updatedFreeGenerations = updateData?.free_generations_remaining ?? updatedFreeGenerations;
        }
      } else {
        // Use free generations
        const { data: updateData, error: updateError } = await supabaseClient
          .from("profiles")
          .update({ free_generations_remaining: updatedFreeGenerations - 1 })
          .eq("id", userId)
          .select("free_generations_remaining")
          .single();
        
        if (updateError) {
          console.error("Error decrementing free generations:", updateError);
        } else {
          updatedFreeGenerations = updateData?.free_generations_remaining ?? (updatedFreeGenerations - 1);
          console.log("Decremented free generations. Remaining:", updatedFreeGenerations);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        freeGenerationsRemaining: hasActiveSubscription ? null : updatedFreeGenerations
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in generate-feature-image:', error);
    const isTimeout = (error as any)?.name === 'AbortError' || (error as any)?.message === 'timeout' || (error as any) === 'timeout';
    const status = isTimeout ? 504 : 500;
    const errorMessage = isTimeout
      ? 'Le service est temporairement lent. Réessayez dans un instant.'
      : (error instanceof Error ? error.message : 'Une erreur est survenue');
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});