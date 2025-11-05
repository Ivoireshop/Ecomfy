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

    // Build prompt for video generation
    const prompt = `Professional advertisement video for an African market:

Product: ${productName}
Category: ${niche}
Description: ${description}
${benefits ? `Benefits: ${benefits}` : ''}
${price ? `Price: ${price}` : ''}
${personDescription ? `Scene: ${personDescription} - Show this person naturally presenting or using the product` : ''}
Platform: ${platform}
Style: ${style}

The video should:
- Be dynamic and engaging for African social media
- Showcase the product professionally
- Be optimized for ${platform}
- Reflect ${style} style
${personDescription ? '- Show the described person interacting with the product professionally' : ''}
- Have engaging background music
- Include clear call-to-action
- Present product benefits progressively and convincingly`;

    // Create a video record in processing state
    const { data: videoData, error: insertError } = await supabaseClient
      .from("generated_videos")
      .insert({
        user_id: userId,
        video_url: "processing",
        prompt: prompt.substring(0, 500),
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

    // Call Runway ML API for ultra-realistic video generation
    try {
      const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY');
      if (!RUNWAY_API_KEY) {
        throw new Error('RUNWAY_API_KEY is not configured');
      }

      console.log("Starting Runway ML Gen-3 Alpha video generation with prompt:", prompt);

      // Generate video with Runway ML Gen-3 Alpha
      const runwayResponse = await fetch("https://api.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          model: "gen3a_turbo",
          prompt_text: prompt,
          duration: 10, // 10 seconds for dynamic content
          ratio: platform === "Instagram" || platform === "TikTok" ? "9:16" : "16:9",
          watermark: false,
        })
      });

      if (!runwayResponse.ok) {
        const errorText = await runwayResponse.text();
        console.error("Runway ML API error:", runwayResponse.status, errorText);
        throw new Error(`Runway ML API error: ${runwayResponse.status}`);
      }

      const runwayData = await runwayResponse.json();
      const taskId = runwayData.id;

      console.log("Runway ML task created:", taskId);

      // Poll for video completion (max 2 minutes)
      let videoUrl = null;
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes with 5 second intervals

      while (attempts < maxAttempts && !videoUrl) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${RUNWAY_API_KEY}`,
            "X-Runway-Version": "2024-11-06",
          }
        });

        if (!statusResponse.ok) {
          console.error("Error checking task status:", statusResponse.status);
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();
        console.log("Task status:", statusData.status);

        if (statusData.status === "SUCCEEDED") {
          videoUrl = statusData.output?.[0];
          console.log("Video generated successfully:", videoUrl);
        } else if (statusData.status === "FAILED") {
          throw new Error("Video generation failed");
        }

        attempts++;
      }

      if (!videoUrl) {
        throw new Error("Video generation timeout - please try again");
      }

      // Update the video record with the generated URL
      const { error: updateVideoError } = await supabaseClient
        .from("generated_videos")
        .update({
          video_url: videoUrl,
          status: "completed",
        })
        .eq("id", videoData.id);

      if (updateVideoError) {
        console.error("Error updating video URL:", updateVideoError);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          videoId: videoData.id,
          videoUrl: videoUrl,
          message: "Vidéo générée avec succès via Runway ML Gen-3 Alpha!",
          videoGenerationsRemaining: videoGenerationsRemaining - 1,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (runwayError) {
      console.error("Runway ML API error:", runwayError);
      
      // Update video status to failed
      await supabaseClient
        .from("generated_videos")
        .update({
          status: "failed",
        })
        .eq("id", videoData.id);

      const errorMessage = runwayError instanceof Error ? runwayError.message : "Erreur inconnue";
      throw new Error(`Échec de la génération vidéo: ${errorMessage}`);
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