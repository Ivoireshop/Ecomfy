import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Replicate from "https://esm.sh/replicate@0.25.2";

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

    // Call Replicate API for video generation
    try {
      const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
      if (!REPLICATE_API_KEY) {
        throw new Error('REPLICATE_API_KEY is not configured');
      }

      const replicate = new Replicate({
        auth: REPLICATE_API_KEY,
      });

      console.log("Starting Replicate video generation with prompt:", prompt);

      // Use zeroscope-v2-xl for text-to-video generation
      const output = await replicate.run(
        "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
        {
          input: {
            prompt: prompt,
            num_frames: 72, // About 3 seconds at 24fps
            num_inference_steps: 50,
            guidance_scale: 17.5,
            width: 1024,
            height: 576,
            fps: 24
          }
        }
      );

      console.log("Replicate video generation completed:", output);

      // Update the video record with the generated URL
      if (output && typeof output === 'string') {
        const { error: updateVideoError } = await supabaseClient
          .from("generated_videos")
          .update({
            video_url: output,
            status: "completed",
          })
          .eq("id", videoData.id);

        if (updateVideoError) {
          console.error("Error updating video URL:", updateVideoError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          videoId: videoData.id,
          videoUrl: output,
          message: "Vidéo générée avec succès !",
          videoGenerationsRemaining: videoGenerationsRemaining - 1
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (replicateError) {
      console.error("Replicate API error:", replicateError);
      
      // Update video status to failed
      await supabaseClient
        .from("generated_videos")
        .update({
          status: "failed",
        })
        .eq("id", videoData.id);

      const errorMessage = replicateError instanceof Error ? replicateError.message : "Erreur inconnue";
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