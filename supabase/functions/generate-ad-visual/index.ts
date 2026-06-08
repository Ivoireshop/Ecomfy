import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

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
  const __quota = await enforceAiQuota(req, "generate-ad-visual");
  if (!__quota.allowed) return __quota.response;


  let currentQueueItemId: string | undefined; // Declare at function scope
  
  // Create admin client at function scope for use in catch block
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Get JWT from Authorization header
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

    const body = await req.json();
    const { productName, niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription, fast, template, tagline, callToAction, queueItemId, userId: requestUserId } = body;
    
    currentQueueItemId = queueItemId; // Assign to function-scoped variable
    
    const isFast = Boolean(fast);
    const MAX_CONCURRENT_GENERATIONS = 10;

    // Check if this is being called from the queue processor
    const isFromQueue = Boolean(queueItemId);
    
    // If not from queue, check if we need to queue this request
    if (!isFromQueue) {
      // Count current processing generations
      const { data: processingCount, error: countError } = await supabaseClient
        .rpc("count_processing_generations");

      if (countError) {
        console.error("Error counting processing generations:", countError);
      } else if (processingCount >= MAX_CONCURRENT_GENERATIONS) {
        console.log(`Queue is full (${processingCount}/${MAX_CONCURRENT_GENERATIONS}), adding to queue`);
        
        // Create queue item
        const { data: queueItem, error: queueError } = await supabaseClient
          .from("generation_queue")
          .insert({
            user_id: userId,
            status: "pending",
            prompt: `${productName} - ${description}`,
            product_details: {
              productName,
              niche,
              description,
              benefits,
              container,
              style,
              price,
              promotionalPrice,
              posology,
              productImage,
              personDescription,
              fast,
              template,
              tagline,
              callToAction
            },
            platform: platform || "all"
          })
          .select()
          .single();

        if (queueError) {
          console.error("Error creating queue item:", queueError);
          throw queueError;
        }

        console.log(`Created queue item ${queueItem.id}, position: ${processingCount + 1}`);

        return new Response(
          JSON.stringify({ 
            queued: true,
            queueItemId: queueItem.id,
            position: processingCount + 1,
            message: "Votre génération a été ajoutée à la file d'attente"
          }),
          {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        console.log(`Processing immediately (${processingCount}/${MAX_CONCURRENT_GENERATIONS})`);
        
        // Create queue item in processing state
        const { data: queueItem, error: queueError } = await supabaseClient
          .from("generation_queue")
          .insert({
            user_id: userId,
            status: "processing",
            prompt: `${productName} - ${description}`,
            product_details: {
              productName,
              niche,
              description,
              benefits,
              container,
              style,
              price,
              promotionalPrice,
              posology,
              productImage,
              personDescription,
              fast,
              template,
              tagline,
              callToAction
            },
            platform: platform || "all",
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (queueError) {
          console.error("Error creating processing queue item:", queueError);
        }
      }
    }
    

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY"); // For fallback and format generation

    // Helper function to generate a hash for cache lookup
    const generatePromptHash = async (text: string, platform: string, size: string): Promise<string> => {
      const input = `${text}|${platform}|${size}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Build an advanced prompt optimized for GPT-image-1 (latest OpenAI model) - use template if provided
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

    // Determine image size for GPT-image-1 (supports 1024x1024, 1536x1024, 1024x1536)
    let gptImageSize: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024";
    if (platform === "tiktok" || platform === "instagram_story") {
      gptImageSize = "1024x1536"; // Vertical for stories/TikTok
    } else if (platform === "facebook") {
      gptImageSize = "1536x1024"; // Horizontal for Facebook feed
    }

    // === CACHE LOOKUP ===
    const promptHash = await generatePromptHash(prompt, platform || "all", gptImageSize);
    console.log("Looking up cache for hash:", promptHash.substring(0, 16) + "...");
    
    const { data: cachedImage, error: cacheError } = await supabaseClient
      .from("image_cache")
      .select("id, image_url")
      .eq("prompt_hash", promptHash)
      .single();

    if (cachedImage && !cacheError) {
      console.log("Cache HIT! Returning cached image");
      
      // Update cache stats (access count and last accessed)
      await supabaseClient
        .from("image_cache")
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: cachedImage.access_count ? cachedImage.access_count + 1 : 2
        })
        .eq("id", cachedImage.id);

      // Still save to generated_images for user's library
      await supabaseClient
        .from("generated_images")
        .insert({
          user_id: userId,
          image_url: cachedImage.image_url,
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
            cached: true
          },
        });

      // Decrement credits even for cached images (fair usage)
      if (!hasActiveSubscription && !isFounder) {
        if (purchasedCredits > 0) {
          await supabaseClient.from("profiles").update({ purchased_credits: purchasedCredits - 1 }).eq("id", userId);
        } else if (freeGenerationsRemaining > 0) {
          await supabaseClient.from("profiles").update({ free_generations_remaining: freeGenerationsRemaining - 1 }).eq("id", userId);
        }
      }

      // Update queue item if exists
      if (currentQueueItemId) {
        await supabaseClient
          .from("generation_queue")
          .update({
            status: "completed",
            image_url: cachedImage.image_url,
            completed_at: new Date().toISOString(),
          })
          .eq("id", currentQueueItemId);
      }

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

    // Retry logic with exponential backoff for GPT-image-1 (latest OpenAI model)
    let imageUrl: string | null = null;

    // PRIMARY: OpenRouter (auto-routes to best image model)
    const openRouterKey = getOpenRouterKey();
    if (openRouterKey) {
      try {
        console.log("Trying OpenRouter as primary image provider...");
        imageUrl = await generateImageWithOpenRouter(openRouterKey, { prompt });
      } catch (e) {
        console.warn("OpenRouter primary failed, falling back to GPT-image-1:", e);
      }
    }

    const maxRetries = 3;
    const retryDelayMs = 2000; // Start with 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries && !imageUrl; attempt++) {
      try {
        console.log(`GPT-image-1 generation attempt ${attempt}/${maxRetries}`);
        
        const gptImageResponse = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: prompt,
            size: gptImageSize,
            quality: "high", // High quality for professional ads
            n: 1,
          }),
          timeoutMs: 90000, // GPT-image-1 can take longer for high quality
        });

        if (gptImageResponse.ok) {
          const gptImageData = await gptImageResponse.json();
          // GPT-image-1 returns base64 directly
          const b64Image = gptImageData.data?.[0]?.b64_json;
          
          if (b64Image) {
            imageUrl = `data:image/png;base64,${b64Image}`;
            console.log("GPT-image-1 generation successful on attempt", attempt);
          } else {
            // Fallback to URL if b64_json not present
            const generatedUrl = gptImageData.data?.[0]?.url;
            if (generatedUrl) {
              console.log("GPT-image-1 returned URL, converting to base64...");
              const imageResponse = await fetch(generatedUrl);
              const imageBlob = await imageResponse.blob();
              const arrayBuffer = await imageBlob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              
              // Convert to base64
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);
              imageUrl = `data:image/png;base64,${base64}`;
              console.log("GPT-image-1 URL converted to base64 on attempt", attempt);
            } else {
              console.warn("GPT-image-1 response missing image data:", gptImageData);
            }
          }
        } else {
          const errorText = await gptImageResponse.text();
          console.error(`GPT-image-1 error (attempt ${attempt}):`, gptImageResponse.status, errorText);
          
          // Handle rate limits with exponential backoff
          if (gptImageResponse.status === 429 && attempt < maxRetries) {
            const delay = retryDelayMs * Math.pow(2, attempt - 1);
            console.log(`Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // Handle content policy violations
          if (gptImageResponse.status === 400 && errorText.includes("content_policy")) {
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
        console.error(`GPT-image-1 attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Fallback to Lovable AI if GPT-image-1 failed after retries
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

    // === SAVE TO CACHE ===
    console.log("Saving image to cache with hash:", promptHash.substring(0, 16) + "...");
    await supabaseClient
      .from("image_cache")
      .insert({
        prompt_hash: promptHash,
        prompt: prompt.substring(0, 1000),
        image_url: imageUrl,
        model: "gpt-image-1",
        platform: platform || "all",
        size: gptImageSize,
        user_id: userId,
      });

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

          // Primary: OpenRouter
          let formatImageUrl: string | null = null;
          if (openRouterKey) {
            try {
              formatImageUrl = await generateImageWithOpenRouter(openRouterKey, {
                prompt: resizePrompt,
                referenceImages: [imageUrl],
                timeoutMs: 25000,
              });
            } catch (e) {
              console.warn(`OpenRouter format ${format.name} failed, fallback:`, e);
            }
          }

          const resizeResponse = formatImageUrl ? null : await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

          if (!formatImageUrl && resizeResponse && resizeResponse.ok) {
            const resizeData = await resizeResponse.json();
            formatImageUrl = resizeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          }

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
        } catch (formatError) {
          console.error(`Error generating ${format.name}:`, formatError);
          // Continue with other formats even if one fails
        }
      }
    }

    // Decrement credits (purchased credits first, then free generations)
    let updatedFreeGenerations = typeof freeGenerationsRemaining === "number" ? freeGenerationsRemaining : 0;
    let updatedPurchasedCredits = typeof purchasedCredits === "number" ? purchasedCredits : 0;
    
    if (userId && !hasActiveSubscription && !isFounder) {
      // Create admin client to bypass RLS for profile updates
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      // Prioritize using purchased credits
      if (updatedPurchasedCredits > 0) {
        const { data: updateData, error: updateError } = await adminClient
          .from("profiles")
          .update({ purchased_credits: updatedPurchasedCredits - 1 })
          .eq("id", userId)
          .select("purchased_credits")
          .single();
        
        if (updateError) {
          console.error("Error decrementing purchased credits:", updateError);
        }
        
        updatedPurchasedCredits = updateData?.purchased_credits ?? (updatedPurchasedCredits - 1);
        console.log("Decremented purchased credits. Remaining:", updatedPurchasedCredits);
      } else if (updatedFreeGenerations > 0) {
        // Use free generations if no purchased credits
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

        // Send reminder emails based on generations remaining (only for free generations)
        if (updatedPurchasedCredits === 0 && updatedFreeGenerations === 1) {
        // After 2nd generation (1 remaining) - send immediate reminder
        console.log("Sending 'after 2 generations' reminder email");
        try {
          const { data: profileData } = await adminClient
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();

          const reminderUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-generation-reminder`;
          fetch(reminderUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              userId,
              userEmail: user.email,
              userName: profileData?.full_name || user.email?.split('@')[0],
              reminderType: 'after_2_generations',
              freeGenerationsRemaining: updatedFreeGenerations
            })
          }).catch(err => console.error("Error sending reminder:", err));
          } catch (e) {
            console.error("Error triggering reminder email:", e);
          }
        } else if (updatedPurchasedCredits === 0 && updatedFreeGenerations === 0) {
          // After 3rd generation (0 remaining) - record for 24h follow-up
          console.log("Recording user for 24h follow-up email");
          try {
            // Insert a record with current timestamp that the cron job will pick up
            await adminClient
              .from("email_reminders")
              .insert({
                user_id: userId,
                reminder_type: 'after_3_generations',
                sent_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h from now
              });
          } catch (e) {
            console.error("Error recording 24h reminder:", e);
          }
        }
      }
    }

    // If this was from the queue, mark as completed and trigger next processing
    if (queueItemId) {
      console.log(`Updating queue item ${queueItemId} to completed`);
      await supabaseClient
        .from("generation_queue")
        .update({
          status: "completed",
          image_url: imageUrl,
          completed_at: new Date().toISOString()
        })
        .eq("id", queueItemId);
    }

    // Trigger processing of next queue item (fire and forget)
    try {
      const processQueueUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`;
      fetch(processQueueUrl, { 
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Content-Type": "application/json"
        }
      }).catch(console.error);
    } catch (e) {
      console.error("Error triggering process-queue:", e);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        imageId: savedImage?.id || null,
        saved: !!savedImage,
        freeGenerationsRemaining: hasActiveSubscription ? null : updatedFreeGenerations,
        purchasedCredits: hasActiveSubscription ? null : updatedPurchasedCredits,
        additionalFormats: hasActiveSubscription ? additionalFormats : [],
        hasMultipleFormats: hasActiveSubscription && additionalFormats.length > 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-ad-visual function:", error);
    
    // If there's a queue item, mark it as failed
    if (currentQueueItemId) {
      try {
        await supabaseClient
          .from("generation_queue")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString()
          })
          .eq("id", currentQueueItemId);
      } catch (updateError) {
        console.error("Error updating failed queue item:", updateError);
      }
      
      // Trigger next item processing even if this one failed
      try {
        const processQueueUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`;
        fetch(processQueueUrl, { 
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json"
          }
        }).catch(console.error);
      } catch (e) {
        console.error("Error triggering process-queue after failure:", e);
      }
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
