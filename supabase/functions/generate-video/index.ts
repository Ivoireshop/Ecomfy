import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getOpenAiApiKey } from "../_shared/openai-key.ts";
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
    console.log("Auth header present:", !!authHeader);

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

    // Validate JWT using getUser with explicit token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    console.log("Auth result:", { hasUser: !!userData?.user, error: userError?.message });

    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Non authentifié - session invalide", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log("User authenticated:", userId);

    // Check founder/co-founder role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["founder", "co_founder"]);

    const isFounder = Array.isArray(roleData) && roleData.length > 0;

    // Check subscription
    const { data: subData } = await supabaseClient
      .from("subscriptions")
      .select("status, video_generations_remaining")
      .eq("user_id", userId)
      .single();

    const hasActiveSubscription = subData?.status === "active";

    /* TEMPORARILY DISABLED
    if (!isFounder && !hasActiveSubscription) {
      return new Response(
        JSON.stringify({ error: "La génération de vidéos nécessite un abonnement actif." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoGenerationsRemaining = typeof subData?.video_generations_remaining === "number"
      ? subData.video_generations_remaining : 5;

    if (!isFounder && videoGenerationsRemaining <= 0) {
      return new Response(
        JSON.stringify({ error: "Vous avez épuisé vos générations de vidéos pour ce mois.", videoGenerationsRemaining: 0 }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    */
    const videoGenerationsRemaining = 999;


    const { productName, niche, description, benefits, platform, style, price, personDescription, duration, template, referenceImages } = await req.json();

    const requestedDuration = Number(duration) || 10;
    const safeDuration = Math.max(5, Math.min(15, requestedDuration));

    console.log("Generating video for:", { productName, niche, platform, safeDuration, hasTemplate: !!template, referenceImages: referenceImages?.length || 0 });

    // Build prompt
    let imagePrompt: string;

    if (template?.prompt_template) {
      imagePrompt = template.prompt_template
        .replace(/\{productName\}/g, productName)
        .replace(/\{niche\}/g, niche)
        .replace(/\{description\}/g, description)
        .replace(/\{benefits\}/g, benefits || "")
        .replace(/\{platform\}/g, platform)
        .replace(/\{style\}/g, style || template.style_preset)
        .replace(/\{price\}/g, price || "")
        .replace(/\{personDescription\}/g, personDescription || "");
    } else {
      imagePrompt = `Créez un visuel publicitaire professionnel et dynamique pour ${platform} :
Produit: ${productName}
Niche: ${niche}
Description: ${description}
${benefits ? `Avantages: ${benefits}` : ""}
${price ? `Prix: ${price}` : ""}
${personDescription ? `Mise en scène: ${personDescription}` : ""}
Style: ${style}

Le visuel doit être:
- Adapté au marché africain avec des couleurs vibrantes
- Professionnel et captivant pour ${platform}
- Optimisé pour le format vidéo vertical (9:16)
- Avec du texte en français si pertinent`;
    }

    // Use service role client for DB updates (avoids RLS issues on generated_videos)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create video record
    const { data: videoData, error: insertError } = await serviceClient
      .from("generated_videos")
      .insert({
        user_id: userId,
        video_url: "processing",
        prompt: imagePrompt.substring(0, 500),
        product_details: { productName, niche, description, platform, style, price },
        status: "processing",
        progress_step: "initializing",
        progress_percentage: 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Decrement video generations
    if (!isFounder && hasActiveSubscription) {
      await serviceClient
        .from("subscriptions")
        .update({ video_generations_remaining: Math.max(0, videoGenerationsRemaining - 1) })
        .eq("user_id", userId);
    }

    console.log("Starting video generation for video ID:", videoData.id);

    // Kick off the heavy work in the background so the HTTP response
    // returns immediately. This avoids the 150s edge-function timeout
    // that was causing the client to hang ("loader infini").
    // The client subscribes to realtime updates on `generated_videos`
    // (filter id=videoData.id) to display progress and the final URL.
    const backgroundWork = async () => {
    try {
      const runwayApiKey = Deno.env.get("RUNWAY_API_KEY");
      const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
      const OPENAI_API_KEY = getOpenAiApiKey();

      // Step 1: Get base image (either from reference images or generate one)
      let baseImageUrl: string | null = null;

      // If user provided reference images, use the first one as the base
      if (referenceImages && referenceImages.length > 0) {
        baseImageUrl = referenceImages[0];
        console.log("Using user-provided reference image as base");
      }

      // Update progress
      await serviceClient.from("generated_videos").update({ progress_step: "generating_image", progress_percentage: 20 }).eq("id", videoData.id);

      // Generate image if no reference provided
      if (!baseImageUrl && OPENAI_API_KEY) {
        try {
          console.log("Generating base image with OpenAI...");
          const openaiResp = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "dall-e-3", prompt: imagePrompt, size: "1024x1024", quality: "hd", n: 1 }),
          });

          if (openaiResp.ok) {
            const openaiData = await openaiResp.json();
            baseImageUrl = openaiData.data?.[0]?.url || null;
            if (baseImageUrl) console.log("OpenAI image generated successfully");
          } else {
            console.error("OpenAI image error:", openaiResp.status, await openaiResp.text());
          }
        } catch (e) {
          console.error("OpenAI image failed:", e);
        }
      }

      // Fallback: use Lovable AI for image generation
      if (!baseImageUrl) {
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableApiKey) {
          console.log("Fallback to Lovable AI for image...");
          const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-1.5-flash",
              messages: [{ role: "user", content: imagePrompt }],
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            baseImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url
              || imageData.choices?.[0]?.message?.images?.[0]?.url
              || null;
          }
        }
      }

      if (!baseImageUrl) throw new Error("Échec de la génération d'image. Veuillez réessayer.");

      console.log("Base image ready");

      // Upload image to storage if it's a remote URL
      let imagePublicUrl = baseImageUrl;
      if (baseImageUrl.startsWith("http") && !baseImageUrl.includes(Deno.env.get("SUPABASE_URL") || "")) {
        const imgResp = await fetch(baseImageUrl);
        if (!imgResp.ok) throw new Error(`Failed to download image: ${imgResp.status}`);
        const imgBuffer = await imgResp.arrayBuffer();
        const contentType = imgResp.headers.get("content-type") || "image/png";

        const imageFileName = `${userId}/images/${videoData.id}.png`;
        await serviceClient.storage.from("generated-content").upload(imageFileName, imgBuffer, { contentType, upsert: true });
        const { data: urlData } = serviceClient.storage.from("generated-content").getPublicUrl(imageFileName);
        imagePublicUrl = urlData.publicUrl;
      }

      await serviceClient.from("generated_videos").update({ progress_step: "image_generated", progress_percentage: 40 }).eq("id", videoData.id);

      // Step 2: Generate video using Replicate (Minimax video-01-live for fast generation)
      console.log("Step 2: Generating video...");
      await serviceClient.from("generated_videos").update({ progress_step: "animating_video", progress_percentage: 50 }).eq("id", videoData.id);

      let enhancedPrompt: string;
      if (template?.animation_prompt_template) {
        enhancedPrompt = template.animation_prompt_template
          .replace(/\{productName\}/g, productName)
          .replace(/\{niche\}/g, niche)
          .replace(/\{platform\}/g, platform)
          .replace(/\{style\}/g, style || template.style_preset)
          .replace(/\{personDescription\}/g, personDescription || "");
      } else {
        enhancedPrompt = `Professional ${niche} advertisement for ${platform}. Style: ${style}. Cinematic camera movement, smooth zoom, professional lighting, captivating atmosphere. ${personDescription ? `Scene: ${personDescription}.` : ""} High quality animation with depth and visual impact.`;
      }

      let videoUrl: string | null = null;

      // Try Replicate first (minimax/video-01-live)
      if (replicateApiKey) {
        try {
          console.log("Using Replicate wavespeedai/wan-2.1-i2v-480p...");
          const replicateResp = await fetch("https://api.replicate.com/v1/models/wavespeedai/wan-2.1-i2v-480p/predictions", {
            method: "POST",
            headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json", Prefer: "wait=60" },
            body: JSON.stringify({
              input: {
                prompt: enhancedPrompt,
                image: imagePublicUrl,
              },
            }),
          });

          if (replicateResp.ok) {
            const repData = await replicateResp.json();
            console.log("Replicate initial status:", repData.status);

            if (repData.status === "succeeded" && repData.output) {
              videoUrl = typeof repData.output === "string" ? repData.output : repData.output[0] || null;
              console.log("Replicate video done immediately!");
            } else if (repData.id && (repData.status === "processing" || repData.status === "starting")) {
              // Poll briefly, then fall back so users are not left waiting beyond ~2 minutes.
              const predictionId = repData.id;
              const pollEnd = Date.now() + 300000; // 5 minutes max polling
              while (Date.now() < pollEnd) {
                await new Promise((r) => setTimeout(r, 5000));
                const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                  headers: { Authorization: `Bearer ${replicateApiKey}` },
                });
                if (pollResp.ok) {
                  const pollData = await pollResp.json();
                  console.log("Replicate poll:", pollData.status);
                  if (pollData.status === "succeeded" && pollData.output) {
                    videoUrl = typeof pollData.output === "string" ? pollData.output : pollData.output[0] || null;
                    break;
                  } else if (pollData.status === "failed" || pollData.status === "canceled") {
                    console.error("Replicate failed:", pollData.error);
                    break;
                  }
                }
              }
            }
          } else {
            const errText = await replicateResp.text();
            console.error("Replicate error:", replicateResp.status, errText);
          }
        } catch (e) {
          console.error("Replicate request failed:", e);
        }
      }

      // Fallback: Runway Gen-3
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
              promptText: enhancedPrompt,
              duration: safeDuration,
              ratio: "9:16",
              watermark: false,
            }),
          });

          if (runwayResponse.ok) {
            const runwayData = await runwayResponse.json();
            const taskId = runwayData.id;
            const pollEnd = Date.now() + 300000; // 5 minutes max polling
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
                  console.error("Runway failed");
                  break;
                }
              }
            }
          } else {
            console.error("Runway error:", runwayResponse.status, await runwayResponse.text());
          }
        } catch (e) {
          console.error("Runway request failed:", e);
        }
      }

      if (!videoUrl) {
        console.error("All video generation methods failed. Refunding credit if applicable.");
        
        // Refund the user if they spent a credit (and are not a founder)
        if (!isFounder) {
          await serviceClient.rpc('increment_video_generations', {
            user_id: userId,
            amount: 1
          }).catch(e => console.error("Could not refund user via RPC:", e));
          
          // Alternatively, since we might not have the RPC, just update directly
          await serviceClient.from("profiles").update({
            video_generations_remaining: Math.max(0, videoGenerationsRemaining), // restored
          }).eq("id", userId);
        }

        // Mark as failed instead of saving the image as completed
        await serviceClient.from("generated_videos").update({
          status: "failed",
          progress_step: "failed",
          progress_percentage: 0,
        }).eq("id", videoData.id);

        return; // Exit background work early
      }


      // Upload video to storage
      await serviceClient.from("generated_videos").update({ progress_step: "finalizing", progress_percentage: 90 }).eq("id", videoData.id);

      const videoResp = await fetch(videoUrl);
      if (!videoResp.ok) {
        throw new Error(`Failed to download video from provider: ${videoResp.status} ${videoResp.statusText}`);
      }
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

      console.log("Video generation completed:", videoData.id);
    } catch (genError) {
      console.error("Video generation error:", genError);
      await serviceClient.from("generated_videos").update({
        status: "failed",
        progress_step: "failed",
      }).eq("id", videoData.id);
    }
    }; // end backgroundWork

    // @ts-ignore - EdgeRuntime is provided by Supabase Edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundWork());
    } else {
      // Fallback: fire and forget (local dev / non-edge runtimes)
      backgroundWork().catch((e) => console.error("background error:", e));
    }

    // Respond immediately so the client can subscribe to realtime updates
    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoData.id,
        status: "processing",
        message: "Génération démarrée. Suivez la progression en direct.",
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
