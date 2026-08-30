// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { OPENAI_CONFIG, getOpenAiApiKey } from "../_shared/openai-config.ts";
import { analyzeImageWithGpt4oMini } from "../_shared/openai-key.ts";
import { PromptEngine } from "../_shared/prompt-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const __quota = await enforceAiQuota(req, "generate-ad-visual");
  if (!__quota.allowed) return __quota.response;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    let userId = "guest-" + (req.headers.get("x-forwarded-for") || "anonymous");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user?.id) userId = user.id;
      } catch (_) {}
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);
    const isFounder = Array.isArray(roleData) && roleData.length > 0;

    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .single();
    const hasActiveSubscription = isFounder || subData?.status === "active";

    let freeGenerationsRemaining = 3;
    let purchasedCredits = 0;
    if (!hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .eq("id", userId)
        .maybeSingle();

      freeGenerationsRemaining = profileData?.free_generations_remaining ?? 3;
      purchasedCredits = profileData?.purchased_credits ?? 0;

      if (freeGenerationsRemaining <= 0 && purchasedCredits <= 0) {
        return new Response(
          JSON.stringify({ 
            error: "Vous avez utilisé vos 3 générations gratuites. Veuillez recharger vos crédits IA.",
            quotaExhausted: true,
            freeGenerationsRemaining: 0,
            purchasedCredits: 0
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const reqBody = await req.json().catch(() => ({}));
    const { 
      prompt = "",
      userPrompt = "",
      customInstructions = "",
      personDescription = "",
      productName = "Produit Ecomfy", 
      niche = "général", 
      platform = "facebook", 
      style = "studio", 
      productImage = null,
      mode = "publicite-produit"
    } = reqBody;

    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      throw new Error("Clé API OpenAI non configurée (OPENAI_API_KEY).");
    }

    const sacredPrompt = (prompt || userPrompt || customInstructions || personDescription || "").trim();

    // 1. Perform Vision Audit if reference product image provided
    let visionAnalysis = "";
    if (productImage) {
      console.log(`[AdVisual Engine] Auditing product photo with ${OPENAI_CONFIG.VISION_MODEL}...`);
      visionAnalysis = await analyzeImageWithGpt4oMini(productImage);
    }

    // 2. Synthesize 23-Pillar Prompt
    const finalPrompt = await PromptEngine.generateProfessionalPrompt({
      userPrompt: sacredPrompt,
      mode,
      style,
      sourceImageAnalysis: visionAnalysis,
      productName,
      niche
    });

    let gptImageSize = "1024x1024";
    if (platform === "tiktok" || platform === "instagram_story") {
      gptImageSize = "1024x1792";
    } else if (platform === "facebook") {
      gptImageSize = "1792x1024";
    }

    console.log(`[AdVisual Engine] Calling OpenAI ${OPENAI_CONFIG.IMAGE_MODEL} (${gptImageSize})...`);
    
    // Direct call to OpenAI DALL-E 3
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.IMAGE_MODEL,
        prompt: finalPrompt.substring(0, 3800),
        size: gptImageSize,
        quality: OPENAI_CONFIG.IMAGE_QUALITY,
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[AdVisual Engine Error]:", res.status, errText);
      throw new Error(`Erreur OpenAI DALL-E 3 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);

    if (!imageUrl) {
      throw new Error("L'API OpenAI n'a retourné aucune image valide.");
    }

    const durationMs = Date.now() - startTime;
    console.log(`[AdVisual Engine] Success in ${durationMs}ms for user ${userId}`);

    // Decrement credits
    if (userId && !hasActiveSubscription && !isFounder && !userId.startsWith("guest-")) {
      if (purchasedCredits > 0) {
        await supabaseClient.from("profiles").update({ purchased_credits: Math.max(0, purchasedCredits - 1) }).eq("id", userId);
      } else if (freeGenerationsRemaining > 0) {
        await supabaseClient.from("profiles").update({ free_generations_remaining: Math.max(0, freeGenerationsRemaining - 1) }).eq("id", userId);
      }
    }

    return new Response(
      JSON.stringify({
        imageUrl,
        success: true,
        meta: {
          model: OPENAI_CONFIG.IMAGE_MODEL,
          durationMs
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la génération.";
    console.error("[AdVisual Error]:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
