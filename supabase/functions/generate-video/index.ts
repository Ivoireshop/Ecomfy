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
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Non authentifié - token manquant" }),
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

    // Get authenticated user using Supabase helper (avoids manual JWT parsing)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log("User authentication result:", { hasUser: !!user, error: userError?.message });
    
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ 
          error: "Non authentifié - session invalide",
          details: userError?.message || "Veuillez vous reconnecter"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const userId = user.id;
    console.log("User authenticated:", userId);

    // Check founder/co-founder role for unlimited access
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      // @ts-ignore - enum types differ in edge env
      .in("role", ["founder", "co_founder"]);

    const isFounder = Array.isArray(roleData) && roleData.length > 0;

    // Check subscription status
    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status, video_generations_remaining")
      .eq("user_id", userId)
      .single();

    const hasActiveSubscription = subData?.status === "active";

    // Video generation requires active subscription unless founder
    if (!isFounder && !hasActiveSubscription) {
      return new Response(
        JSON.stringify({ 
          error: "La génération de vidéos nécessite un abonnement actif.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Remaining generations (default to 5/month if null)
    const videoGenerationsRemaining = typeof subData?.video_generations_remaining === "number"
      ? subData!.video_generations_remaining
      : 5;

    // Check if user has remaining video generations (founders bypass)
    if (!isFounder && videoGenerationsRemaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Vous avez épuisé vos générations de vidéos pour ce mois.",
          videoGenerationsRemaining: 0
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { productName, niche, description, benefits, platform, style, price, personDescription, duration, template } = await req.json();
    
    // Clamp duration between 5 and 15 seconds; default 10s; prefer 10 or 15 as per user request
    const requestedDuration = Number(duration) || 10;
    const safeDuration = Math.max(5, Math.min(15, requestedDuration));
    
    console.log("Generating video for:", { productName, niche, platform, personDescription, safeDuration, hasTemplate: !!template });

    // Build prompt for image generation (optimized for speed)
    let imagePrompt: string;
    
    if (template && template.prompt_template) {
      // Use template's prompt
      imagePrompt = template.prompt_template
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
      // Default prompt
      imagePrompt = `Créez un visuel publicitaire professionnel et dynamique pour ${platform} :

Produit: ${productName}
Niche: ${niche}
Description: ${description}
${benefits ? `Avantages: ${benefits}` : ''}
${price ? `Prix: ${price}` : ''}
${personDescription ? `Mise en scène: ${personDescription}` : ''}
Style: ${style}

Le visuel doit être:
- Adapté au marché africain avec des couleurs vibrantes
- Professionnel et captivant pour ${platform}
- Optimisé pour le format vidéo vertical (9:16)
- Avec du texte en français si pertinent`;
    }

    // Create a video record in processing state
    const { data: videoData, error: insertError } = await supabaseClient
      .from("generated_videos")
      .insert({
        user_id: userId,
        video_url: "processing",
        prompt: imagePrompt.substring(0, 500),
        product_details: {
          productName,
          niche,
          description,
          platform,
          style,
          price,
        },
        status: "processing",
        progress_step: "initializing",
        progress_percentage: 0,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Decrement video generations for subscribed non-founder users only
    if (!isFounder && hasActiveSubscription) {
      const { error: updateError } = await supabaseClient
        .from("subscriptions")
        .update({ video_generations_remaining: Math.max(0, videoGenerationsRemaining - 1) })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating video generations:", updateError);
      }
    }

    // Generate video using Lovable AI + Runway API - Fast generation (target: <15 seconds)
    console.log("Starting video generation for video ID:", videoData.id);
    
    try {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      const runwayApiKey = Deno.env.get("RUNWAY_API_KEY");
      
      if (!lovableApiKey) {
        throw new Error("LOVABLE_API_KEY not configured");
      }
      
      if (!runwayApiKey) {
        throw new Error("RUNWAY_API_KEY not configured");
      }

      // Step 1: Generate base image with GPT-image-1 (OpenAI's latest model)
      console.log("Step 1: Generating base image with GPT-image-1...");
      
      // Update progress: generating image
      await supabaseClient
        .from("generated_videos")
        .update({
          progress_step: "generating_image",
          progress_percentage: 20,
        })
        .eq("id", videoData.id);
      
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      let generatedImageUrl: string | null = null;
      
      // Use GPT-image-1 as primary model
      if (OPENAI_API_KEY) {
        try {
          console.log("Using GPT-image-1 for image generation...");
          const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-image-1",
              prompt: imagePrompt,
              size: "1024x1024",
              quality: "high",
              n: 1
            }),
          });
          
          if (openaiResp.ok) {
            const openaiData = await openaiResp.json();
            const b64 = openaiData.data?.[0]?.b64_json;
            if (b64) {
              generatedImageUrl = `data:image/png;base64,${b64}`;
              console.log("GPT-image-1 generation successful");
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
                generatedImageUrl = `data:image/png;base64,${btoa(binary)}`;
              }
            }
          } else {
            const t = await openaiResp.text();
            console.error("GPT-image-1 API error:", openaiResp.status, t);
          }
        } catch (e) {
          console.error("GPT-image-1 request failed:", e);
        }
      }
      
      // Fallback to Lovable AI if GPT-image-1 failed
      if (!generatedImageUrl && lovableApiKey) {
        console.log("GPT-image-1 failed, falling back to Lovable AI...");
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"]
          })
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          generatedImageUrl = (
            imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
            imageData.choices?.[0]?.message?.images?.[0]?.url ||
            null
          );
          if (generatedImageUrl) {
            console.log("Lovable AI fallback successful");
          }
        } else {
          const errorText = await imageResponse.text();
          console.error("Lovable AI fallback failed:", imageResponse.status, errorText);
        }
      }

      if (!generatedImageUrl) {
        throw new Error("Échec de la génération d'image. Veuillez réessayer.");
      }


      console.log("Base image generated successfully");

      // Download image or decode data URL, then upload to storage
      let imageBuffer: ArrayBuffer | Uint8Array;
      let contentType = 'image/png';
      if (generatedImageUrl.startsWith('data:image')) {
        const mimeMatch = generatedImageUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,/);
        if (mimeMatch) contentType = mimeMatch[1];
        const base64Data = generatedImageUrl.split(',')[1];
        imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        const imgResp = await fetch(generatedImageUrl);
        if (!imgResp.ok) throw new Error(`Failed to download generated image: ${imgResp.status}`);
        imageBuffer = await imgResp.arrayBuffer();
        contentType = imgResp.headers.get('content-type') || 'image/png';
      }
      
      const imageFileName = `${userId}/images/${videoData.id}.png`;
      const { error: imageUploadError } = await supabaseClient
        .storage
        .from('generated-content')
        .upload(imageFileName, imageBuffer, {
          contentType,
          upsert: true
        });

      if (imageUploadError) {
        console.error("Storage upload error:", imageUploadError);
        throw imageUploadError;
      }

      const { data: imageUrlData } = supabaseClient
        .storage
        .from('generated-content')
        .getPublicUrl(imageFileName);

      const imagePublicUrl = imageUrlData.publicUrl;
      console.log("Image uploaded to storage:", imagePublicUrl);
      
      // Update progress: image generated
      await supabaseClient
        .from("generated_videos")
        .update({
          progress_step: "image_generated",
          progress_percentage: 40,
        })
        .eq("id", videoData.id);

      // Step 2: Generate video from image using Runway Gen-3 Turbo (~5-10 seconds)
      console.log("Step 2: Génération vidéo avec Runway Gen-3 Turbo (optimisé pour qualité)...");
      
      // Update progress: animating video
      await supabaseClient
        .from("generated_videos")
        .update({
          progress_step: "animating_video",
          progress_percentage: 50,
        })
        .eq("id", videoData.id);
      
      // Enhanced prompt for high-quality advertising videos
      let enhancedPrompt: string;
      
      if (template && template.animation_prompt_template) {
        // Use template's animation prompt
        enhancedPrompt = template.animation_prompt_template
          .replace(/\{productName\}/g, productName)
          .replace(/\{niche\}/g, niche)
          .replace(/\{platform\}/g, platform)
          .replace(/\{style\}/g, style || template.style_preset)
          .replace(/\{personDescription\}/g, personDescription || '');
        
        console.log("Using template animation prompt:", template.name);
      } else {
        // Default animation prompt
        enhancedPrompt = `Publicité professionnelle ${niche} pour ${platform} - Style: ${style}. 
Effet cinématographique avec: mouvements de caméra fluides et dynamiques, zoom progressif engageant, 
transitions professionnelles, éclairage publicitaire optimal, atmosphère captivante pour réseaux sociaux. 
${personDescription ? `Mise en scène: ${personDescription}.` : ''} 
Animation de haute qualité avec profondeur, énergie et impact visuel maximum pour conversion publicitaire.`;
      }
      
      const runwayResponse = await fetch("https://api.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${runwayApiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          model: "gen3a_turbo",
          promptImage: imagePublicUrl,
          promptText: enhancedPrompt,
          duration: template?.recommended_duration || safeDuration,
          ratio: "9:16",
          watermark: false,
          seed: Math.floor(Math.random() * 1000000) // Random seed for variety
        })
      });
      
      console.log("Runway request envoyé avec prompt amélioré");

      if (!runwayResponse.ok) {
        const errorText = await runwayResponse.text();
        console.error("Runway API error:", errorText);
        throw new Error(`Runway API failed: ${runwayResponse.status} - ${errorText}`);
      }

      const runwayData = await runwayResponse.json();
      const taskId = runwayData.id;
      
      console.log("Runway task created:", taskId, "- Polling for completion...");

      // Poll for video completion (with timeout after ~60 seconds total)
      const maxPollingTime = 60000; // give Runway more time
      const pollInterval = 2000; // Check every 2 seconds
      const startTime = Date.now();
      
      let videoUrl = null;
      let pollingComplete = false;

      while (!pollingComplete && (Date.now() - startTime) < maxPollingTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${runwayApiKey}`,
            "X-Runway-Version": "2024-11-06"
          }
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log("Runway status:", statusData.status);
          
          if (statusData.status === "SUCCEEDED") {
            videoUrl = statusData.output?.[0];
            pollingComplete = true;
            console.log("Video generated successfully:", videoUrl);
            
            // Update progress: video ready
            await supabaseClient
              .from("generated_videos")
              .update({
                progress_step: "video_ready",
                progress_percentage: 80,
              })
              .eq("id", videoData.id);
          } else if (statusData.status === "FAILED") {
            throw new Error("Runway video generation failed");
          }
        }
      }

      if (!videoUrl) {
        console.log("Video generation taking longer than expected, will continue in background");
        // Update status to processing and return early
        await supabaseClient
          .from("generated_videos")
          .update({
            video_url: imagePublicUrl, // Use image as fallback
            status: "processing",
          })
          .eq("id", videoData.id);

        return new Response(
          JSON.stringify({ 
            success: true,
            videoId: videoData.id,
            videoUrl: imagePublicUrl,
            message: "Image générée, vidéo en cours de traitement...",
            videoGenerationsRemaining: isFounder ? null : Math.max(0, videoGenerationsRemaining - 1),
            isProcessing: true
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Download the video from Runway and upload to our storage
      console.log("Downloading video from Runway...");
      
      // Update progress: finalizing
      await supabaseClient
        .from("generated_videos")
        .update({
          progress_step: "finalizing",
          progress_percentage: 90,
        })
        .eq("id", videoData.id);
      const videoResponse = await fetch(videoUrl);
      const videoBlob = await videoResponse.arrayBuffer();
      
      const videoFileName = `${userId}/videos/${videoData.id}.mp4`;
      const { error: videoUploadError } = await supabaseClient
        .storage
        .from('generated-content')
        .upload(videoFileName, videoBlob, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (videoUploadError) {
        console.error("Video upload error:", videoUploadError);
        throw videoUploadError;
      }

      const { data: videoUrlData } = supabaseClient
        .storage
        .from('generated-content')
        .getPublicUrl(videoFileName);

      const videoPublicUrl = videoUrlData.publicUrl;
      console.log("Video uploaded to storage:", videoPublicUrl);
      
      // Update the video record with the public URL
      const { error: updateVideoError } = await supabaseClient
        .from("generated_videos")
        .update({
          video_url: videoPublicUrl,
          status: "completed",
          progress_step: "completed",
          progress_percentage: 100,
        })
        .eq("id", videoData.id);

      if (updateVideoError) {
        console.error("Error updating video record:", updateVideoError);
        throw updateVideoError;
      }

      const totalTime = Date.now() - startTime;
      console.log(`Video generation completed in ${totalTime}ms for video ID:`, videoData.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          videoId: videoData.id,
          videoUrl: videoPublicUrl,
          message: `Vidéo MP4 animée générée avec succès en ${Math.round(totalTime/1000)}s !`,
          videoGenerationsRemaining: isFounder ? null : Math.max(0, videoGenerationsRemaining - 1)
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (genError) {
      console.error("Video generation error:", genError);
      
      // Update status to failed
      await supabaseClient
        .from("generated_videos")
        .update({
          status: "failed",
        })
        .eq("id", videoData.id);

      return new Response(
        JSON.stringify({ 
          error: "Erreur lors de la génération de la vidéo",
          details: genError instanceof Error ? genError.message : String(genError),
          videoGenerationsRemaining: isFounder ? null : Math.max(0, videoGenerationsRemaining - 1)
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});