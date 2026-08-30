// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OPENAI_CONFIG, getOpenAiApiKey } from "../_shared/openai-config.ts";
import { analyzeImageWithGpt4oMini } from "../_shared/openai-key.ts";
import { PromptEngine } from "../_shared/prompt-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {},
    passed: false
  };

  try {
    const apiKey = getOpenAiApiKey();
    results.tests["1_key_configured"] = {
      status: !!apiKey,
      message: apiKey ? "OPENAI_API_KEY is present" : "OPENAI_API_KEY missing"
    };

    if (!apiKey) {
      return new Response(JSON.stringify(results), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Vision Audit Test
    console.log("[Test Engine] Testing Vision Model...");
    const sampleImageUrl = "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400";
    const visionAudit = await analyzeImageWithGpt4oMini(sampleImageUrl, "Audit this cosmetic packaging.");
    
    results.tests["2_vision_model_accessible"] = {
      status: !!visionAudit,
      model: OPENAI_CONFIG.VISION_MODEL,
      snippet: visionAudit ? visionAudit.substring(0, 150) + "..." : "Failed"
    };

    // 3. PromptEngine Test
    console.log("[Test Engine] Testing PromptEngine...");
    const synthesizedPrompt = await PromptEngine.generateProfessionalPrompt({
      userPrompt: "Publicité premium pour sérum avec homme africain de 35 ans",
      mode: "publicite-produit",
      sourceImageAnalysis: visionAudit
    });

    results.tests["3_prompt_engine"] = {
      status: synthesizedPrompt.length > 50,
      promptLength: synthesizedPrompt.length,
      snippet: synthesizedPrompt.substring(0, 200) + "..."
    };

    // 4. Test Image Generation with gpt-image-1 and gpt-image-2 (quality: 'high')
    const candidateModels = ["gpt-image-1", "gpt-image-2", "dall-e-3"];
    let successfulModel = null;
    let generatedImageUrl = null;
    const modelErrors: Record<string, string> = {};

    for (const modelCandidate of candidateModels) {
      console.log(`[Test Engine] Testing image model: ${modelCandidate}...`);
      const bodyPayload: any = {
        model: modelCandidate,
        prompt: synthesizedPrompt.substring(0, 900),
        size: "1024x1024",
        n: 1,
      };

      if (modelCandidate.startsWith("gpt-image")) {
        bodyPayload.quality = "high"; // Correct quality parameter for gpt-image models
      } else {
        bodyPayload.quality = "hd";
      }

      const genRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (genRes.ok) {
        const genData = await genRes.json();
        const url = genData.data?.[0]?.url || (genData.data?.[0]?.b64_json ? `data:image/png;base64,${genData.data[0].b64_json}` : null);
        if (url) {
          successfulModel = modelCandidate;
          generatedImageUrl = url;
          console.log(`[Test Engine] SUCCESS with model ${modelCandidate}!`);
          break;
        }
      } else {
        const errText = await genRes.text();
        modelErrors[modelCandidate] = errText;
        console.warn(`[Test Engine] Model ${modelCandidate} failed:`, errText);
      }
    }

    results.tests["4_image_generation"] = {
      status: !!successfulModel,
      activeModel: successfulModel,
      imageUrl: generatedImageUrl ? (generatedImageUrl.length > 100 ? generatedImageUrl.substring(0, 100) + "..." : generatedImageUrl) : null,
      attemptedModelErrors: modelErrors
    };
    results.passed = !!successfulModel;

    return new Response(JSON.stringify(results, null, 2), {
      status: results.passed ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    results.error = err.message;
    return new Response(JSON.stringify(results, null, 2), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
