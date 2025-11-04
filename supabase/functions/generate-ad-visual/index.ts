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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
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
      .eq("user_id", user.id)
      .single();

    const hasActiveSubscription = subData?.status === "active";

    // Check free generations
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("free_generations_remaining")
      .eq("id", user.id)
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

    const { productName, niche, description, benefits, container, platform, style } = await req.json();
    
    console.log("Generating visual for:", { productName, niche, platform, style });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt based on the form data
    let prompt = `Create a professional advertising visual for "${productName}". `;
    prompt += `Product niche: ${niche}. `;
    prompt += `Description: ${description}. `;
    
    if (benefits) {
      prompt += `Key benefits: ${benefits}. `;
    }
    
    if (container) {
      prompt += `Container type: ${container}. `;
    }
    
    if (style) {
      const styleDescriptions: Record<string, string> = {
        moderne: "modern and clean design",
        luxueux: "luxury and elegant design with premium feel",
        humoristique: "fun and humorous style",
        traditionnel: "traditional African style with cultural elements",
        minimaliste: "minimalist and simple design",
        dynamique: "dynamic and energetic style",
      };
      prompt += `Style: ${styleDescriptions[style] || style}. `;
    }
    
    // Add platform-specific requirements
    const platformSpecs: Record<string, string> = {
      facebook: "Optimized for Facebook ads (1200x628px recommended)",
      instagram: "Optimized for Instagram square format (1080x1080px)",
      tiktok: "Optimized for TikTok vertical format (1080x1920px)",
      all: "Versatile design that works across all social media platforms",
    };
    
    if (platform) {
      prompt += platformSpecs[platform] || "";
    }
    
    prompt += " High quality, professional advertising photography, commercial product shot, perfect lighting, attention-grabbing.";

    console.log("Generated prompt:", prompt);

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
            content: prompt,
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
        .eq("id", user.id)
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
