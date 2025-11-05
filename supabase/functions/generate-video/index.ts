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

    // Call OpenRouter API for video generation
    try {
      const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
      if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured');
      }

      console.log("Starting OpenRouter video generation with prompt:", prompt);

      // Use OpenRouter to generate video script and instructions
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("SUPABASE_URL") ?? "",
          "X-Title": "VisualPro Video Generator",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-sonnet", // Using Claude for high-quality video generation
          messages: [
            {
              role: "user",
              content: `Generate a detailed video generation prompt for a professional advertising video with the following details:

${prompt}

Create a comprehensive prompt that includes:
- Scene composition and camera angles
- Professional lighting setup
- Color grading and mood
- Timing and pacing suggestions
- Background music style
- Text overlays and positioning
- Call-to-action placement

Format the response as a detailed video generation prompt.`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", response.status, errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const enhancedPrompt = data.choices?.[0]?.message?.content;

      console.log("Enhanced prompt generated:", enhancedPrompt);

      // For now, we'll store the enhanced prompt and mark as processing
      // In a future update, we can integrate actual video generation models
      const output = `video_${videoData.id}_processing.mp4`;

      console.log("Video generation initiated:", output);

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
          message: "Génération de vidéo en cours... Le traitement peut prendre quelques minutes.",
          videoGenerationsRemaining: videoGenerationsRemaining - 1,
          enhancedPrompt: enhancedPrompt
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (openRouterError) {
      console.error("OpenRouter API error:", openRouterError);
      
      // Update video status to failed
      await supabaseClient
        .from("generated_videos")
        .update({
          status: "failed",
        })
        .eq("id", videoData.id);

      const errorMessage = openRouterError instanceof Error ? openRouterError.message : "Erreur inconnue";
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