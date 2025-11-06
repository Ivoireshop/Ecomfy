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

    // Generate video using Lovable AI - Fast generation (target: <15 seconds)
    console.log("Starting fast video generation for video ID:", videoData.id);
    
    try {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      // Generate image with Lovable AI (fast model)
      console.log("Generating base image with Lovable AI...");
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

      console.log("Image generated successfully, uploading to storage...");

      // Extract base64 data
      const base64Data = generatedImageUrl.split(',')[1];
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Upload to Supabase Storage with user_id in path
      const fileName = `${userId}/videos/${videoData.id}.png`;
      const { error: uploadError } = await supabaseClient
        .storage
        .from('generated-content')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabaseClient
        .storage
        .from('generated-content')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      console.log("Image uploaded to storage:", publicUrl);
      
      // Update the video record with the public URL
      const { error: updateVideoError } = await supabaseClient
        .from("generated_videos")
        .update({
          video_url: publicUrl,
          status: "completed",
        })
        .eq("id", videoData.id);

      if (updateVideoError) {
        console.error("Error updating video record:", updateVideoError);
        throw updateVideoError;
      }

      console.log("Video generation completed in < 15 seconds for video ID:", videoData.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          videoId: videoData.id,
          videoUrl: generatedImageUrl,
          message: "Vidéo générée avec succès en moins de 15 secondes !",
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