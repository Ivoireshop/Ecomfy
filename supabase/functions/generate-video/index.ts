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

    // Build prompt for video generation (minimum 30 seconds)
    const prompt = `Créez une vidéo publicitaire professionnelle d'au moins 30 secondes (et jusqu'à 60 secondes maximum) pour le produit suivant :

Produit: ${productName}
Niche: ${niche}
Description: ${description}
${benefits ? `Avantages: ${benefits}` : ''}
${price ? `Prix: ${price}` : ''}
${personDescription ? `Mise en scène: ${personDescription} - Intégrez cette personne de manière naturelle en train de présenter ou utiliser le produit` : ''}
Plateforme cible: ${platform}
Style: ${style}

La vidéo doit:
- Durer AU MINIMUM 30 secondes (peut aller jusqu'à 60 secondes)
- Être dynamique et captivante pour les réseaux sociaux africains
- Mettre en valeur le produit de manière professionnelle
- Inclure du texte en français parfait avec des sous-titres si nécessaire
- Être optimisée pour ${platform}
- Refléter le style ${style}
${personDescription ? '- Montrer la personne décrite en interaction avec le produit de façon professionnelle et naturelle' : ''}
- Avoir une narration ou musique de fond engageante
- Inclure des appels à l'action clairs
- Présenter les avantages du produit de manière progressive et convaincante`;

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

    // NOTE: In a real implementation, you would call a video generation API here
    // For now, we return a placeholder response
    console.log("Video generation initiated for video ID:", videoData.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        videoId: videoData.id,
        message: "Génération de vidéo initiée (30-60 secondes). Cela peut prendre quelques minutes.",
        videoGenerationsRemaining: videoGenerationsRemaining - 1
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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