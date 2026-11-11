import { serveCors } from "../_shared/http.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";
import { generateImageWithOpenRouter, getOpenRouterKey } from "../_shared/openrouter-image.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { estimateImageCostUsd, estimateOpenRouterImageCostUsd, estimateTextCallCostUsd } from "../_shared/ai-cost.ts";
import { finishGeneration, startGeneration } from "../_shared/ai-generation-log.ts";
import { classifyOpenAiFailure, fetchWithTimeout, isOperatorAlertCode, runWithRetry, userMessageForFailure } from "../_shared/ai-retry.ts";
import type { Failure } from "../_shared/ai-retry.ts";
import { persistGeneratedImage } from "../_shared/openai-image-engine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 200 + success:false : convention des fonctions IA, les écrans affichent `error` tel quel (message lisible).
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** `fetch` avec délai maximal, pour le moteur de secours gratuit (la réponse est une image, pas du JSON). */
async function fetchBinaryWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

serveCors("app", async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const startTime = Date.now();
  const __quota = await enforceAiQuota(req, "generate-feature-image");
  if (!__quota.allowed) return __quota.response;
  // Toujours un utilisateur réel : enforceAiQuota refuse tout appel sans JWT valide (plus d'identité d'invité déduite de l'IP).
  const userId = __quota.userId;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json();
    const { prompt = "", userPrompt = "", customInstructions = "", productName = "", niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription } = body;

    // Réservation AVANT tout appel payant : solde (ou exemption fondateur / abonné), plafond de coût du jour, débit
    // atomique, remboursé si la génération échoue. Avant, le solde n'était jamais vérifié : le décompte venait après
    // coup et ne décrémentait que s'il restait quelque chose.
    const gen = await startGeneration(userId, "feature_image");
    if (!gen.allowed) return gen.response;

    let costUsd = 0;
    let attempts = 0;
    let modelUsed: string | null = null;

    try {
      const sacredPrompt = (prompt || userPrompt || customInstructions || personDescription || "").trim();

      let masterPrompt = "";
      if (sacredPrompt) {
        masterPrompt += `[PRIMARY USER DEMAND - MANDATORY INSTRUCTION]:\n${sacredPrompt}\n\n`;
      }

      if (productName) {
        masterPrompt += `[PRODUCT INFORMATION]:\nProduct Name: ${productName}\nCategory: ${niche || 'Général'}\n`;
        if (description && description !== sacredPrompt) masterPrompt += `Description: ${description}\n`;
        if (container) masterPrompt += `Container: ${container}\n`;
        if (personDescription && personDescription !== sacredPrompt) masterPrompt += `Scene Staging: ${personDescription}\n`;
        if (style) masterPrompt += `Visual Style: ${style}\n`;
        if (platform) masterPrompt += `Target Format: ${platform}\n`;
      }

      if (productImage) {
        try {
          console.log("Analyzing product image with GPT-4o-mini Vision...");
          const visionFeatures = await analyzeImageWithGpt4oMini(
            productImage,
            `Perform a high-precision commercial product visual audit of this uploaded image for "${productName}".
Describe in detail (in English):
1. EXACT PRODUCT IDENTITY: Product type, container/packaging shape (bottle, box, jar, tube, bag, etc.), materials (glass, matte plastic, gold metal, leather, fabric), cap/closure style.
2. COLOR PALETTE: Primary, secondary, and accent colors, metallic foils, label colors.
3. BRANDING & TEXT: Logo placement, label design, typography style, key visible branding elements.
4. TEXTURE & FINISH: Glossy, reflective, matte, embossed, woven, transparent.
Format as a clear, structured prompt fragment designed for DALL-E 3 to faithfully recreate this exact product hero element in a professional ad background.`
          );
          costUsd += estimateTextCallCostUsd();
          if (visionFeatures) {
            masterPrompt += `\n[EXACT PRODUCT VISUAL IDENTITY - MUST REPRODUCE THIS PRODUCT FAITHFULLY]:\n${visionFeatures}\n`;
          }
        } catch (e) {
          console.warn("Vision analysis skipped:", e);
        }
      }

      masterPrompt += `\n[COMMERCIAL ADVERTISING PHOTOGRAPHY DIRECTIVES]:\nUltra-high resolution commercial photography, 8k quality, sharp focus, professional studio lighting, warm golden tones, mobile-optimized high contrast. Clean background for optional text overlay.`;

      let finalPrompt = masterPrompt;
      try {
        finalPrompt = await optimizePromptWithGpt4oMini(masterPrompt);
        costUsd += estimateTextCallCostUsd();
      } catch (e) {
        console.warn("Prompt optimization fallback:", e);
      }

      const OPENAI_API_KEY = getOpenAiApiKey();

      const generatePromptHash = async (text: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const promptHash = await generatePromptHash(finalPrompt);
      const { data: cachedImage } = await supabaseClient
        .from("image_cache")
        .select("id, image_url")
        .eq("prompt_hash", promptHash)
        .maybeSingle();

      // Compteur d'essais restants renvoyé aux écrans qui l'affichent (null = abonné ou fondateur, illimité).
      const freeLeft = async (): Promise<number | null> => {
        if (gen.source === "subscription" || gen.source === "exempt") return null;
        const { data: p } = await supabaseClient.from("profiles").select("free_generations_remaining").eq("id", userId).maybeSingle();
        return Math.max(0, p?.free_generations_remaining ?? 0);
      };

      if (cachedImage?.image_url) {
        console.log("Cache HIT! Returning cached image");
        // Rien à facturer : le crédit réservé est rendu (statut « cancelled »), le coût des appels texte reste inscrit.
        await finishGeneration(gen.logId, {
          status: "cancelled", attempts: 0, model: "cache", costUsd, durationMs: Date.now() - startTime, errorCode: "cache_hit",
        });
        return json({ success: true, imageUrl: cachedImage.image_url, cached: true, freeGenerationsRemaining: await freeLeft() });
      }

      console.log("Generating feature image with prompt length:", finalPrompt.length);
      let imageUrl: string | null = null;
      let paidEngineUsed = false;
      let blocked: Failure | null = null;
      let lastFailure: Failure | null = null;

      // PRIMARY ENGINE: OpenAI DALL-E 3. Deux appels au plus, et seulement pour une panne passagère.
      if (OPENAI_API_KEY) {
        console.log("Calling OpenAI DALL-E 3 as primary engine...");
        const dalle = await runWithRetry<string>(
          ["dall-e-3"],
          async (_model, _n, remaining) => {
            const res = await fetchWithTimeout(
              'https://api.openai.com/v1/images/generations',
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'dall-e-3', prompt: finalPrompt.substring(0, 3800), size: '1024x1024', quality: 'standard', n: 1 }),
              },
              Math.max(5_000, Math.min(65_000, remaining)),
            );
            if (res.ok) {
              const d = res.json();
              const url = d?.data?.[0]?.b64_json ? `data:image/png;base64,${d.data[0].b64_json}` : d?.data?.[0]?.url;
              if (url) return { ok: true as const, value: url };
              return { ok: false as const, failure: { kind: "retryable" as const, code: "empty_response", status: res.status, detail: "aucune image" } };
            }
            return { ok: false as const, failure: classifyOpenAiFailure(res.status, res.text) };
          },
          { maxAttempts: 2, deadlineAt: startTime + 120_000 },
        );
        attempts += dalle.attempts;
        if (dalle.ok) {
          imageUrl = dalle.value as string;
          paidEngineUsed = true;
          modelUsed = "dall-e-3";
          costUsd += estimateImageCostUsd("dall-e-3", "standard", "1024x1024");
          console.log("OpenAI DALL-E 3 generated feature image successfully!");
        } else {
          lastFailure = dalle.failure ?? null;
          console.warn("DALL-E 3 primary failed:", dalle.trail.join(" > "), lastFailure?.detail);
          if (lastFailure && isOperatorAlertCode(lastFailure.code)) {
            console.error(`[AI-OPERATOR-ALERT] generate-feature-image : ${lastFailure.code} (HTTP ${lastFailure.status})`);
          }
          // Un refus du filtre de sécurité ne se contourne pas en confiant la même demande à d'autres moteurs.
          if (lastFailure?.code === "content_policy") blocked = lastFailure;
        }
      }

      // FALLBACK 1: OpenRouter
      if (!imageUrl && !blocked) {
        const openRouterKey = getOpenRouterKey();
        if (openRouterKey) {
          try {
            attempts++;
            imageUrl = await generateImageWithOpenRouter(openRouterKey, {
              prompt: finalPrompt,
              referenceImages: productImage ? [productImage] : [],
            });
            if (imageUrl) {
              paidEngineUsed = true;
              modelUsed = "openrouter";
              costUsd += estimateOpenRouterImageCostUsd();
            }
          } catch (e) {
            console.warn("OpenRouter fallback failed:", e);
          }
        }
      }

      // FALLBACK 2: moteur de secours gratuit (qualité moindre)
      let degraded = false;
      if (!imageUrl && !blocked) {
        console.log("Using High-Definition Commercial Image Engine fallback...");
        try {
          attempts++;
          const encodedPrompt = encodeURIComponent(finalPrompt.substring(0, 500));
          const seed = Math.floor(Math.random() * 1000000);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

          const imageResp = await fetchBinaryWithTimeout(pollinationsUrl, 45000);
          if (imageResp.ok && imageResp.headers.get("content-type")?.includes("image")) {
            const bytes = new Uint8Array(await imageResp.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            imageUrl = `data:image/jpeg;base64,${btoa(binary)}`;
            degraded = true;
            modelUsed = "pollinations";
          }
        } catch (fallbackErr) {
          console.error("Commercial AI fallback failed:", fallbackErr);
        }
      }

      if (!imageUrl) {
        const code = blocked?.code ?? (lastFailure && lastFailure.kind === "fatal" ? lastFailure.code : "provider_error");
        const fin = await finishGeneration(gen.logId, {
          status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: code,
        });
        return json({ success: false, error: userMessageForFailure(code), code, refunded: fin.refunded });
      }

      // Copie dans le stockage permanent. Sans elle, on ne met pas une data-URL de plusieurs Mo dans la base.
      const stored = await persistGeneratedImage(supabaseClient, userId, imageUrl);

      if (stored.persisted) {
        try {
          await supabaseClient.from("image_cache").insert({
            prompt_hash: promptHash,
            prompt: finalPrompt.substring(0, 1000),
            image_url: stored.url,
            model: modelUsed ?? "dall-e-3",
            platform: platform || "all",
            size: "1024x1024",
            user_id: userId,
          });
        } catch (e) {
          console.warn("Cache save failed:", e);
        }

        try {
          await supabaseClient.from("generated_images").insert({
            user_id: userId,
            image_url: stored.url,
            prompt: finalPrompt.substring(0, 500),
            product_details: {
              productName, niche, description, platform, style, price, promotionalPrice, benefits,
              modelUsed, attempts, estimatedCostUsd: Number(costUsd.toFixed(4)),
            },
          });
        } catch (e) {
          console.warn("Database save failed:", e);
        }
      }

      // Seul le moteur de secours gratuit a répondu : l'image est livrée mais d'une qualité moindre, le crédit est rendu.
      await finishGeneration(gen.logId, degraded && !paidEngineUsed
        ? { status: "cancelled", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: "degraded_fallback" }
        : { status: "succeeded", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime });

      return json({ success: true, imageUrl: stored.url, freeGenerationsRemaining: await freeLeft() });
    } catch (genErr) {
      // Erreur inattendue après la réservation : clôture en échec, ce qui rembourse.
      await finishGeneration(gen.logId, {
        status: "failed", attempts, model: modelUsed, costUsd, durationMs: Date.now() - startTime, errorCode: "internal_error",
      });
      throw genErr;
    }
  } catch (error) {
    // Le détail reste dans les logs : on ne renvoie pas au navigateur le texte brut d'une erreur interne ou fournisseur.
    console.error('Error in generate-feature-image:', error);
    return json({ success: false, error: userMessageForFailure("internal_error"), code: "internal_error" });
  }
});
