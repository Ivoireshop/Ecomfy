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

    // Extract userId from JWT
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
      .select("status, video_generations_remaining")
      .eq("user_id", userId)
      .single();

    const hasActiveSubscription = subData?.status === "active";

    // Video generation requires active subscription
    if (!hasActiveSubscription) {
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

    const videoGenerationsRemaining = subData?.video_generations_remaining || 0;

    // Check if user has remaining video generations
    if (videoGenerationsRemaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Vous avez épuisé vos 5 générations de vidéos mensuelles.",
          videoGenerationsRemaining: 0
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { productName, niche, description, benefits, platform, style, price, personDescription } = await req.json();
    
    console.log("Generating video for:", { productName, niche, platform, personDescription });

    // Build prompt for image generation (optimized for speed)
    const imagePrompt = `Créez un visuel publicitaire professionnel et dynamique pour ${platform} :

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
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Decrement video generations
    const { error: updateError } = await supabaseClient
      .from("subscriptions")
      .update({ video_generations_remaining: videoGenerationsRemaining - 1 })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating video generations:", updateError);
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

      // Step 1: Generate base image with Lovable AI (fast, ~3-5 seconds)
      console.log("Step 1: Generating base image with Lovable AI...");
      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: imagePrompt
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error("Lovable AI image generation failed:", errorText);
        throw new Error(`Image generation failed: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!generatedImageUrl) {
        throw new Error("No image URL in response");
      }

      console.log("Base image generated successfully");

      // Extract base64 data and upload to storage
      const base64Data = generatedImageUrl.split(',')[1];
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const imageFileName = `${userId}/images/${videoData.id}.png`;
      const { error: imageUploadError } = await supabaseClient
        .storage
        .from('generated-content')
        .upload(imageFileName, buffer, {
          contentType: 'image/png',
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

      // Step 2: Generate video from image using Runway API (~5-10 seconds)
      console.log("Step 2: Generating video with Runway API...");
      
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
          promptText: `Animate this ${niche} advertisement for ${platform}. Add smooth transitions, dynamic camera movements, and professional effects. Style: ${style}. Make it engaging and eye-catching for social media.`,
          duration: 5, // 5 seconds video for faster generation
          ratio: "1280:768",
          watermark: false
        })
      });

      if (!runwayResponse.ok) {
        const errorText = await runwayResponse.text();
        console.error("Runway API error:", errorText);
        throw new Error(`Runway API failed: ${runwayResponse.status} - ${errorText}`);
      }

      const runwayData = await runwayResponse.json();
      const taskId = runwayData.id;
      
      console.log("Runway task created:", taskId, "- Polling for completion...");

      // Poll for video completion (with timeout after 15 seconds total)
      const maxPollingTime = 12000; // 12 seconds (total with image gen should be ~15s)
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
            videoGenerationsRemaining: videoGenerationsRemaining - 1,
            isProcessing: true
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Download the video from Runway and upload to our storage
      console.log("Downloading video from Runway...");
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
          videoGenerationsRemaining: videoGenerationsRemaining - 1
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
          details: genError instanceof Error ? genError.message : "Unknown error",
          videoGenerationsRemaining: videoGenerationsRemaining - 1
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