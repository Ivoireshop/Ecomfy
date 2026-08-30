import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getOpenAiApiKey, analyzeImageWithGpt4oMini, optimizePromptWithGpt4oMini } from "../_shared/openai-key.ts";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

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

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);

    const isFounder = Array.isArray(roleData) && roleData.length > 0;

    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status, video_generations_remaining")
      .eq("user_id", userId)
      .single();

    const hasActiveSubscription = subData?.status === "active";
    const videoGenerationsRemaining = 999;

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

    if (!isFounder && hasActiveSubscription) {
      await serviceClient
        .from("subscriptions")
        .update({ video_generations_remaining: Math.max(0, videoGenerationsRemaining - 1) })
        .eq("user_id", userId);
    }

    const backgroundWork = async () => {
      try {
        const runwayApiKey = Deno.env.get("RUNWAY_API_KEY");
        const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
        const OPENAI_API_KEY = getOpenAiApiKey();

        let baseImageUrl: string | null = null;

        await serviceClient.from("generated_videos").update({ progress_step: "generating_image", progress_percentage: 20 }).eq("id", videoData.id);

        if (OPENAI_API_KEY) {
          try {
            console.log("Generating video base keyframe image with OpenAI DALL-E 3...");
            const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "dall-e-3", prompt: finalImagePrompt.substring(0, 3800), size: "1024x1792", quality: "standard", n: 1 }),
            });

            if (openaiResp.ok) {
              const openaiData = await openaiResp.json();
              baseImageUrl = openaiData.data?.[0]?.url || (openaiData.data?.[0]?.b64_json ? `data:image/png;base64,${openaiData.data[0].b64_json}` : null);
              if (baseImageUrl) console.log("OpenAI DALL-E 3 video keyframe generated successfully");
            } else {
              console.error("OpenAI DALL-E 3 video keyframe error:", openaiResp.status, await openaiResp.text());
            }
          } catch (e) {
            console.error("OpenAI DALL-E 3 image generation failed:", e);
          }
        }

        if (!baseImageUrl && productRefPhoto) {
          baseImageUrl = productRefPhoto;
          console.log("Fallback to direct uploaded product photo as base keyframe");
        }

        if (!baseImageUrl) throw new Error("Échec de la génération de l'image de base pour la vidéo.");

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

        if (replicateApiKey) {
          try {
            console.log("Calling Replicate wan-2.1-i2v-480p...");
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
                      break;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("Replicate request failed:", e);
          }
        }

        if (!videoUrl && runwayApiKey) {
          try {
            console.log("Fallback to Runway Gen-3...");
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
                  } else if (statusData.status === "FAILED") {
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.error("Runway request failed:", e);
          }
        }

        if (!videoUrl) {
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
          console.log("Video generation completed successfully:", videoData.id);
        }
      } catch (genError) {
        console.error("Video generation error:", genError);
        await serviceClient.from("generated_videos").update({
          status: "failed",
          progress_step: "failed",
        }).eq("id", videoData.id);
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
        videoGenerationsRemaining: isFounder ? null : Math.max(0, videoGenerationsRemaining - 1),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || error?.details || String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
