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

    // 3. PromptEngine Tests (Scénarios A à F)
    console.log("[Test Engine] Testing PromptEngine across Scenarios A-F...");
    
    // Test A: Prompt court sans ethnie -> Doit générer modèle Africain par défaut
    const testA = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Un homme présentant ce produit", mode: "publicite-produit" });
    // Test B: Prompt court femme sans ethnie -> Doit générer femme Africaine par défaut
    const testB = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Une femme présentant ce produit", mode: "temoignage-client" });
    // Test C: Publicité sans langue spécifiée -> Texte en Français par défaut
    const testC = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Crée une publicité pour ce produit", mode: "publicite-produit" });
    // Test D: Demande explicite en Anglais -> Texte en Anglais
    const testD = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Create an advertising visual for this product in English", mode: "publicite-produit" });
    // Test E: Prompt hyper court -> Enrichissement automatique complet
    const testE = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Produit dans une boutique", mode: "photo-produit" });
    // Test F: Ethnie spécifique (Homme japonais) -> Doit respecter l'ethnie explicite
    const testF = await PromptEngine.generateProfessionalPrompt({ userPrompt: "Un homme japonais présentant le produit", mode: "publicite-produit" });

    results.tests["3_prompt_engine_scenarios"] = {
      testA_african_man_default: testA.includes("African"),
      testB_african_woman_default: testB.includes("African"),
      testC_french_default: testC.includes("French"),
      testD_english_explicit: testD.includes("English"),
      testE_auto_enhancement: testE.length > 200,
      testF_japanese_man_explicit: testF.includes("Japanese"),
      snippetTestA: testA.substring(0, 180) + "...",
      snippetTestF: testF.substring(0, 180) + "..."
    };

    // 4. Test Image Edits API (Option A - Reference Image Input)
    console.log("[Test Engine] Fetching sample reference image binary for Option A Image Edits test...");
    const sampleImgResp = await fetch(sampleImageUrl);
    const sampleImgBlob = await sampleImgResp.blob();

    const formData = new FormData();
    formData.append("image", sampleImgBlob, "product_reference.png");
    formData.append("prompt", testA.substring(0, 950));
    formData.append("model", OPENAI_CONFIG.IMAGE_MODEL);
    formData.append("n", "1");
    formData.append("size", "1024x1024");

    console.log(`[Test Engine] Calling OpenAI Image Edits API (Option A) with model ${OPENAI_CONFIG.IMAGE_MODEL}...`);
    const editsRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (editsRes.ok) {
      const editsData = await editsRes.json();
      const url = editsData.data?.[0]?.url || (editsData.data?.[0]?.b64_json ? `data:image/png;base64,${editsData.data[0].b64_json}` : null);
      results.tests["4_image_edits_option_a"] = {
        status: true,
        endpoint: "/v1/images/edits",
        modelUsed: OPENAI_CONFIG.IMAGE_MODEL,
        imageUrl: url ? url.substring(0, 100) + "..." : null
      };
      results.passed = true;
    } else {
      const errText = await editsRes.text();
      console.warn("[Test Engine] Image Edits endpoint returned error:", editsRes.status, errText);

      // Retry Option A with dall-e-2 or fallback to /v1/images/generations with Vision-Guided Prompt
      console.log("[Test Engine] Retrying Image Edits with dall-e-2...");
      const formDataD2 = new FormData();
      formDataD2.append("image", sampleImgBlob, "product_reference.png");
      formDataD2.append("prompt", synthesizedPrompt.substring(0, 950));
      formDataD2.append("model", "dall-e-2");
      formDataD2.append("n", "1");
      formDataD2.append("size", "1024x1024");

      const d2Res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formDataD2,
      });

      if (d2Res.ok) {
        const d2Data = await d2Res.json();
        const url = d2Data.data?.[0]?.url || (d2Data.data?.[0]?.b64_json ? `data:image/png;base64,${d2Data.data[0].b64_json}` : null);
        results.tests["4_image_edits_option_a"] = {
          status: true,
          endpoint: "/v1/images/edits",
          modelUsed: "dall-e-2",
          imageUrl: url ? url.substring(0, 100) + "..." : null
        };
        results.passed = true;
      } else {
        const d2ErrText = await d2Res.text();
        results.tests["4_image_edits_option_a"] = {
          status: false,
          errorPrimary: errText,
          errorFallback: d2ErrText
        };
      }
    }

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
