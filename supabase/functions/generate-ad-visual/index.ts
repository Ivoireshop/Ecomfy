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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    let userId = "guest-user";
    let isFounder = false;
    let hasActiveSubscription = false;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        userId = user.id;

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("is_founder, subscription_status")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          isFounder = profile.is_founder === true;
          hasActiveSubscription = profile.subscription_status === "active";
        }
      }
    }

    // Quota Enforcement
    if (!isFounder && !hasActiveSubscription && userId !== "guest-user") {
      const quotaResult = await enforceAiQuota(supabaseClient, userId, "generate_ad_visual");
      if (!quotaResult.allowed) {
        return new Response(
          JSON.stringify({ 
            error: quotaResult.message || "Quota de visuels publicitaires atteint.",
            quotaExceeded: true,
            success: false 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const reqBody = await req.json();
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

    console.log(`[AdVisual Engine] Calling OpenAI Engine (Reference Image: ${!!productImage}, Size: ${gptImageSize})...`);
    
    // 3. Option A Execution (Reference Image Input via /v1/images/edits or /v1/images/generations fallback)
    const imageUrl = await callOpenAiAdEngine(OPENAI_API_KEY, finalPrompt, gptImageSize, productImage);
    const durationMs = Date.now() - startTime;

    // 4. Save to DB
    if (userId !== "guest-user") {
      await supabaseClient.from("generated_images").insert({
        user_id: userId,
        image_url: imageUrl,
        prompt: finalPrompt.substring(0, 3500),
        product_details: {
          productName,
          niche,
          platform,
          style,
          mode,
          durationMs,
          estimatedCostUsd: OPENAI_CONFIG.ESTIMATED_COST_USD
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        imageUrl, 
        prompt: finalPrompt,
        success: true,
        durationMs
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[AdVisual Engine Error] Failed after ${durationMs}ms:`, err);
    return new Response(
      JSON.stringify({ 
        error: err.message || "Erreur lors de la génération du visuel publicitaire.",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callOpenAiAdEngine(apiKey: string, prompt: string, size: string, referenceImage?: string): Promise<string> {
  const models = [OPENAI_CONFIG.IMAGE_MODEL, OPENAI_CONFIG.IMAGE_MODEL_FALLBACK, "dall-e-3"];
  let lastError = "";

  if (referenceImage) {
    try {
      console.log(`[AdVisual Call] Executing Option A (Reference Image Input via /v1/images/edits)...`);
      let imageBlob: Blob;

      if (referenceImage.startsWith("data:")) {
        const parts = referenceImage.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/png";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        imageBlob = new Blob([u8arr], { type: mime });
      } else {
        const fetchRes = await fetch(referenceImage);
        imageBlob = await fetchRes.blob();
      }

      for (const modelCandidate of models) {
        try {
          const formData = new FormData();
          formData.append("image", imageBlob, "product_reference.png");
          formData.append("prompt", prompt.substring(0, 950));
          formData.append("model", modelCandidate);
          formData.append("n", "1");
          formData.append("size", size);

          const res = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
            if (url) return url;
          } else {
            lastError = await res.text();
            console.warn(`[AdVisual Edits ${modelCandidate} Failed]:`, res.status, lastError);
          }
        } catch (editErr) {
          console.warn(`[AdVisual Edits ${modelCandidate} Exception]:`, editErr);
        }
      }
    } catch (blobErr) {
      console.warn("[AdVisual Edits Blob Conversion Failed]:", blobErr);
    }
  }

  // Fallback to /v1/images/generations
  for (const modelCandidate of models) {
    try {
      const bodyPayload: any = {
        model: modelCandidate,
        prompt: prompt.substring(0, 3800),
        size,
        n: 1,
      };

      if (modelCandidate.startsWith("gpt-image")) {
        bodyPayload.quality = OPENAI_CONFIG.IMAGE_QUALITY;
      } else {
        bodyPayload.quality = "hd";
      }

      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        if (url) return url;
      } else {
        lastError = await res.text();
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`Échec de la génération du visuel publicitaire OpenAI : ${lastError}`);
}
