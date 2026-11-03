import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { estimateImageCostUsd, estimateTextCallCostUsd, estimateVideoAnimationCostUsd } from "../_shared/ai-cost.ts";
import { finishGeneration, startGeneration } from "../_shared/ai-generation-log.ts";
import { classifyOpenAiFailure, classifyProviderFailure, fetchWithTimeout, isOperatorAlertCode, runWithRetry } from "../_shared/ai-retry.ts";
import type { Failure } from "../_shared/ai-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "generate-video");
  if (!__quota.allowed) return __quota.response;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Non authentifié - token manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié - session invalide", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Réservation AVANT tout appel payant : exemption fondateur / abonné, sinon essai gratuit puis crédits, et plafond
    // de coût du jour. Avant, aucun solde n'était exigé (compteur codé en dur à 999) : toute personne connectée
    // pouvait lancer des vidéos facturées par Replicate / Runway. Le crédit est rendu si la vidéo échoue.
    const gen = await startGeneration(userId, "video");
    if (!gen.allowed) return gen.response;

    // Dépense engagée (estimée) et état final, clôturés une seule fois quelle que soit la sortie.
    let costUsd = 0;
    let providerCalls = 0;
    let finalModel: string | null = null;
    const startedAt = Date.now();
    let closed = false;
    const close = async (status: "succeeded" | "failed", errorCode?: string) => {
      if (closed) return;
      closed = true;
      await finishGeneration(gen.logId, {
        status, attempts: providerCalls, model: finalModel, costUsd, durationMs: Date.now() - startedAt, errorCode,
      });
    };

    try {
      const body = await req.json().catch(() => ({}));
      const { 
        prompt = "", 
        userPrompt = "", 
        customInstructions = "", 
        productName = "", 
        niche = "général", 
        description = "", 
        benefits = "", 
        platform = "tiktok", 
        style = "moderne", 
        price = "", 
        personDescription = "", 
        duration = 10, 
        template = null, 
        productImage = null, 
        referenceImages = [] 
      } = body;

      const requestedDuration = Number(duration) || 10;
      const safeDuration = Math.max(5, Math.min(15, requestedDuration));

      const userExplicitDemand = (prompt || userPrompt || customInstructions || personDescription || description || "").trim();

      let masterPrompt = "";
      if (userExplicitDemand) {
        masterPrompt += `[PRIMARY USER VIDEO DIRECTIVE - STRICT REQUIREMENT]:\n${userExplicitDemand}\n\n`;
      }

      if (template?.prompt_template) {
        masterPrompt += `[TEMPLATE GUIDANCE]: ${template.prompt_template}\n`;
      }

      masterPrompt += `[PRODUCT SPECIFICATIONS]:\nProduct Name: ${productName || "Ecomfy Product"}\nNiche: ${niche}\nStyle: ${style}\nTarget Platform: ${platform}\n`;
      if (benefits) masterPrompt += `Key Benefits: ${benefits}\n`;
      if (price) masterPrompt += `Price: ${price}\n`;
      if (personDescription && personDescription !== userExplicitDemand) masterPrompt += `Model Staging: ${personDescription}\n`;

      const productRefPhoto = (referenceImages && referenceImages.length > 0 ? referenceImages[0] : null) || productImage;
      if (productRefPhoto) {
        try {
          console.log("Analyzing video product image with GPT-4o-mini Vision...");
          const visionFeatures = await analyzeImageWithGpt4oMini(
            productRefPhoto,
            `Perform a high-precision commercial product visual audit of this uploaded image for video generation.
  Describe in detail (in English):
  1. EXACT PRODUCT IDENTITY: Product type, container/packaging shape, materials (glass, matte plastic, metal, wood, leather, fabric), cap/closure style.
  2. COLOR PALETTE: Primary, secondary, and accent colors, metallic foils, label colors.
  3. BRANDING & TEXT: Logo placement, label design, typography style, key visible branding elements.
  Format as a clear prompt fragment for DALL-E 3 to faithfully recreate this exact product hero element.`
          );
          costUsd += estimateTextCallCostUsd();
          if (visionFeatures) {
            masterPrompt += `\n[EXACT PRODUCT REPRODUCTION - MUST REPRODUCE FAITHFULLY]:\n${visionFeatures}\n`;
          }
        } catch (e) {
          console.warn("Video vision audit skipped:", e);
        }
      }

      masterPrompt += `\n[VIDEO KEYFRAME PHOTOGRAPHY DIRECTIVES]:\nVertical 9:16 format, high definition advertising video frame, 8k quality, cinematic lighting, sharp hero product shot, vibrant colors.`;

      let finalImagePrompt = masterPrompt;
      try {
        finalImagePrompt = await optimizePromptWithGpt4oMini(masterPrompt);
        costUsd += estimateTextCallCostUsd();
      } catch (e) {
        console.warn("Video prompt optimization fallback:", e);
      }

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: videoData, error: insertError } = await serviceClient
        .from("generated_videos")
        .insert({
          user_id: userId,
          video_url: "processing",
          prompt: finalImagePrompt.substring(0, 500),
          product_details: { productName, niche, description, platform, style, price, userExplicitDemand },
          status: "processing",
          progress_step: "initializing",
          progress_percentage: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const backgroundWork = async () => {
        // Issue par défaut : toute sortie qui n'a pas posé "succeeded" est un échec (et rembourse le crédit).
        let outcome: { status: "succeeded" | "failed"; errorCode?: string } = { status: "failed", errorCode: "unknown" };
        try {
          const runwayApiKey = Deno.env.get("RUNWAY_API_KEY");
          const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
          const OPENAI_API_KEY = getOpenAiApiKey();

          let baseImageUrl: string | null = null;

          await serviceClient.from("generated_videos").update({ progress_step: "generating_image", progress_percentage: 20 }).eq("id", videoData.id);

          if (OPENAI_API_KEY) {
            // Image de départ : une nouvelle tentative au plus, et seulement pour une panne passagère. Un refus définitif
            // (filtre de sécurité, clé) ne se rejoue pas ; on retombe alors sur la photo fournie par l'utilisateur.
            console.log("Generating video base keyframe image with OpenAI DALL-E 3...");
            const keyframe = await runWithRetry<string>(
              ["dall-e-3"],
              async () => {
                const res = await fetchWithTimeout(
                  "https://api.openai.com/v1/images/generations",
                  {
                    method: "POST",
                    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "dall-e-3", prompt: finalImagePrompt.substring(0, 3800), size: "1024x1792", quality: "standard", n: 1 }),
                  },
                  90_000,
                );
                if (res.ok) {
                  const d = res.json();
                  const url = d?.data?.[0]?.url || (d?.data?.[0]?.b64_json ? `data:image/png;base64,${d.data[0].b64_json}` : null);
                  if (url) return { ok: true as const, value: url };
                  return { ok: false as const, failure: { kind: "retryable" as const, code: "empty_response", status: res.status, detail: "aucune image" } };
                }
                return { ok: false as const, failure: classifyOpenAiFailure(res.status, res.text) };
              },
              { maxAttempts: 2 },
            );
            providerCalls += keyframe.attempts;
            if (keyframe.ok) {
              baseImageUrl = keyframe.value as string;
              costUsd += estimateImageCostUsd("dall-e-3", "standard", "1024x1792");
              console.log("OpenAI DALL-E 3 video keyframe generated successfully");
            } else {
              console.error("OpenAI DALL-E 3 video keyframe error:", keyframe.failure?.code, keyframe.failure?.detail);
            }
          }

          if (!baseImageUrl && productRefPhoto) {
            baseImageUrl = productRefPhoto;
            console.log("Fallback to direct uploaded product photo as base keyframe");
          }

          if (!baseImageUrl) {
            outcome = { status: "failed", errorCode: "keyframe_failed" };
            throw new Error("Échec de la génération de l'image de base pour la vidéo.");
          }

          let imagePublicUrl = baseImageUrl;
          if (baseImageUrl.startsWith("http") && !baseImageUrl.includes(Deno.env.get("SUPABASE_URL") || "")) {
            const imgResp = await fetch(baseImageUrl);
            if (imgResp.ok) {
              const imgBuffer = await imgResp.arrayBuffer();
              const contentType = imgResp.headers.get("content-type") || "image/png";
              const imageFileName = `${userId}/images/${videoData.id}.png`;
              await serviceClient.storage.from("generated-content").upload(imageFileName, imgBuffer, { contentType, upsert: true });
              const { data: urlData } = serviceClient.storage.from("generated-content").getPublicUrl(imageFileName);
              imagePublicUrl = urlData.publicUrl;
            }
          }

          await serviceClient.from("generated_videos").update({ progress_step: "image_generated", progress_percentage: 40 }).eq("id", videoData.id);

          console.log("Step 2: Animating video with Replicate / Runway...");
          await serviceClient.from("generated_videos").update({ progress_step: "animating_video", progress_percentage: 50 }).eq("id", videoData.id);

          let animationPrompt = `Professional ${niche} commercial video advert. Style: ${style}. ${userExplicitDemand ? `Scene Directive: ${userExplicitDemand}.` : ""} Smooth fluid motion, cinematic camera pan, high quality animation.`;

          let videoUrl: string | null = null;
          // Dernier échec classé des fournisseurs d'animation : code stable pour le journal, corps tronqué pour les logs.
          // Avant, une réponse refusée (solde, clé, modèle, contenu) était avalée sans trace : impossible de dire pourquoi.
          let animationFailure: Failure | null = null;
          const noteAnimationFailure = (provider: string, status: number, bodyText: string) => {
            animationFailure = classifyProviderFailure(status, bodyText);
            console.error(`[video-provider] ${provider} HTTP ${status} -> ${animationFailure.code}: ${animationFailure.detail}`);
          };

          if (replicateApiKey) {
            try {
              console.log("Calling Replicate wan-2.1-i2v-480p...");
              providerCalls++;
              const replicateResp = await fetch("https://api.replicate.com/v1/models/wavespeedai/wan-2.1-i2v-480p/predictions", {
                method: "POST",
                headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json", Prefer: "wait=60" },
                body: JSON.stringify({
                  input: { prompt: animationPrompt, image: imagePublicUrl },
                }),
              });

              if (replicateResp.ok) {
                const repData = await replicateResp.json();
                if (repData.status === "succeeded" && repData.output) {
                  videoUrl = typeof repData.output === "string" ? repData.output : repData.output[0] || null;
                } else if (repData.status === "failed" || repData.status === "canceled") {
                  noteAnimationFailure("replicate", 422, String(repData.error ?? repData.status));
                } else if (repData.id && (repData.status === "processing" || repData.status === "starting")) {
                  const predictionId = repData.id;
                  const pollEnd = Date.now() + 300000;
                  while (Date.now() < pollEnd) {
                    await new Promise((r) => setTimeout(r, 5000));
                    const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                      headers: { Authorization: `Bearer ${replicateApiKey}` },
                    });
                    if (pollResp.ok) {
                      const pollData = await pollResp.json();
                      if (pollData.status === "succeeded" && pollData.output) {
                        videoUrl = typeof pollData.output === "string" ? pollData.output : pollData.output[0] || null;
                        break;
                      } else if (pollData.status === "failed" || pollData.status === "canceled") {
                        noteAnimationFailure("replicate", 422, String(pollData.error ?? pollData.status));
                        break;
                      }
                    }
                  }
                }
              } else {
                noteAnimationFailure("replicate", replicateResp.status, await replicateResp.text().catch(() => ""));
              }
            } catch (e) {
              console.error("Replicate request failed:", e);
              noteAnimationFailure("replicate", 0, String((e as any)?.message || e));
            }
          }

          if (videoUrl) {
            costUsd += estimateVideoAnimationCostUsd("replicate", safeDuration);
            finalModel = "replicate:wan-2.1-i2v-480p";
          }

          if (!videoUrl && runwayApiKey) {
            try {
              console.log("Fallback to Runway Gen-3...");
              providerCalls++;
              const runwayResponse = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${runwayApiKey}`,
                  "Content-Type": "application/json",
                  "X-Runway-Version": "2024-11-06",
                },
                body: JSON.stringify({
                  model: "gen3a_turbo",
                  promptImage: imagePublicUrl,
                  promptText: animationPrompt,
                  duration: safeDuration,
                  ratio: "9:16",
                  watermark: false,
                }),
              });

              if (runwayResponse.ok) {
                const runwayData = await runwayResponse.json();
                const taskId = runwayData.id;
                const pollEnd = Date.now() + 300000;
                while (Date.now() < pollEnd) {
                  await new Promise((r) => setTimeout(r, 5000));
                  const statusResp = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
                    headers: { Authorization: `Bearer ${runwayApiKey}`, "X-Runway-Version": "2024-11-06" },
                  });
                  if (statusResp.ok) {
                    const statusData = await statusResp.json();
                    if (statusData.status === "SUCCEEDED") {
                      videoUrl = statusData.output?.[0] || null;
                      break;
                    } else if (statusData.status === "FAILED" || statusData.status === "CANCELLED") {
                      noteAnimationFailure("runway", 422, `${statusData.failureCode ?? ""} ${statusData.failure ?? statusData.status}`);
                      break;
                    }
                  }
                }
              } else {
                noteAnimationFailure("runway", runwayResponse.status, await runwayResponse.text().catch(() => ""));
              }
            } catch (e) {
              console.error("Runway request failed:", e);
              noteAnimationFailure("runway", 0, String((e as any)?.message || e));
            }
          }

          if (videoUrl && !finalModel) {
            costUsd += estimateVideoAnimationCostUsd("runway", safeDuration);
            finalModel = "runway:gen3a_turbo";
          }

          if (!videoUrl) {
            // Code précis dans le journal (provider_quota, provider_auth, content_policy…), sinon « animation_failed ».
            const failure = animationFailure as Failure | null;
            outcome = { status: "failed", errorCode: failure?.code ?? "animation_failed" };
            if (failure && isOperatorAlertCode(failure.code)) {
              console.error(`[AI-OPERATOR-ALERT] generate-video : ${failure.code} (HTTP ${failure.status})`);
            }
            await serviceClient.from("generated_videos").update({
              status: "failed",
              progress_step: "failed",
              progress_percentage: 0,
            }).eq("id", videoData.id);
            return;
          }

          await serviceClient.from("generated_videos").update({ progress_step: "finalizing", progress_percentage: 90 }).eq("id", videoData.id);

          const videoResp = await fetch(videoUrl);
          if (videoResp.ok) {
            const videoBlob = await videoResp.arrayBuffer();
            const videoFileName = `${userId}/videos/${videoData.id}.mp4`;
            await serviceClient.storage.from("generated-content").upload(videoFileName, videoBlob, { contentType: "video/mp4", upsert: true });
            const { data: videoUrlData } = serviceClient.storage.from("generated-content").getPublicUrl(videoFileName);
            const videoPublicUrl = videoUrlData.publicUrl;

            await serviceClient.from("generated_videos").update({
              video_url: videoPublicUrl,
              status: "completed",
              progress_step: "completed",
              progress_percentage: 100,
            }).eq("id", videoData.id);
            outcome = { status: "succeeded" };
            console.log("Video generation completed successfully:", videoData.id);
          } else {
            // Sans ce statut, la ligne restait « processing » à jamais (spinner infini dans le Studio et la Bibliothèque).
            // Le fournisseur a déjà facturé la vidéo (coût conservé dans le journal), mais l'utilisateur ne l'a pas : remboursé.
            console.error("Video download failed:", videoResp.status, videoData.id);
            outcome = { status: "failed", errorCode: "download_failed" };
            await serviceClient.from("generated_videos").update({
              status: "failed",
              progress_step: "failed",
              progress_percentage: 0,
            }).eq("id", videoData.id);
          }
        } catch (genError) {
          console.error("Video generation error:", genError);
          outcome = { status: "failed", errorCode: "internal_error" };
          await serviceClient.from("generated_videos").update({
            status: "failed",
            progress_step: "failed",
          }).eq("id", videoData.id);
        } finally {
          // Une seule clôture, quelle que soit la sortie : succès = crédit consommé, échec = crédit rendu.
          await close(outcome.status, outcome.errorCode);
        }
      };

      // @ts-ignore - EdgeRuntime is provided by Supabase Edge runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(backgroundWork());
      } else {
        backgroundWork().catch((e) => console.error("background error:", e));
      }

      return new Response(
        JSON.stringify({
          success: true,
          videoId: videoData.id,
          status: "processing",
          message: "Génération vidéo démarrée avec respect strict du prompt.",
          charged: gen.charged,
          chargeSource: gen.source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (reserved) {
      // Erreur avant le départ du travail en arrière-plan (insertion de la ligne vidéo…) : clôture en échec, ce qui rembourse.
      await close("failed", "internal_error");
      throw reserved;
    }
  } catch (error: any) {
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || error?.details || String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
