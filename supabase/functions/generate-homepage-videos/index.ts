import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY');
    if (!RUNWAY_API_KEY) {
      throw new Error('RUNWAY_API_KEY is not configured');
    }

    const { videoType } = await req.json();
    
    console.log("Generating homepage video:", videoType);

    // Define prompts for the two homepage videos
    const prompts = {
      entrepreneur: `Professional African entrepreneur in modern business attire presenting his company with confidence and enthusiasm. High quality corporate setting with natural lighting. The entrepreneur is gesturing professionally, speaking to camera with engaging body language. Background shows a modern office or startup space with African art and design elements. Camera slowly zooms in on the presenter. Dynamic, professional, inspiring atmosphere. 4K quality, cinematic lighting, shallow depth of field. Duration: 30 seconds.`,
      
      handbag: `Elegant African woman showcasing a luxury leather handbag in studio setting. She gracefully rotates the bag 360 degrees, showing front, back, sides, top and bottom views. Close-up shots of quality stitching, hardware details, and texture. The bag is a premium modern design with African-inspired patterns. Professional studio lighting with soft shadows. Woman's hands elegantly present each angle of the bag. Smooth camera movements following the bag rotation. Luxury product photography aesthetic. 4K quality, professional color grading. Duration: 30 seconds.`
    };

    const prompt = prompts[videoType as keyof typeof prompts];
    
    if (!prompt) {
      throw new Error('Invalid video type. Use "entrepreneur" or "handbag"');
    }

    console.log("Using Runway ML with prompt:", prompt);

    // Generate video with Runway ML Gen-3 Alpha
    const runwayResponse = await fetch("https://api.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen3a_turbo",
        prompt_text: prompt,
        duration: 10,
        ratio: "16:9",
        watermark: false,
      })
    });

    if (!runwayResponse.ok) {
      const errorText = await runwayResponse.text();
      console.error("Runway ML API error:", runwayResponse.status, errorText);
      throw new Error(`Runway ML API error: ${runwayResponse.status}`);
    }

    const runwayData = await runwayResponse.json();
    const taskId = runwayData.id;

    console.log("Runway ML task created:", taskId);

    // Poll for video completion
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 48; // 4 minutes with 5 second intervals

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "X-Runway-Version": "2024-11-06",
        }
      });

      if (!statusResponse.ok) {
        console.error("Error checking task status:", statusResponse.status);
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`Task status (attempt ${attempts + 1}/${maxAttempts}):`, statusData.status);

      if (statusData.status === "SUCCEEDED") {
        videoUrl = statusData.output?.[0];
        console.log("Video generated successfully:", videoUrl);
      } else if (statusData.status === "FAILED") {
        throw new Error("Video generation failed");
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error("Video generation timeout - the video may still be processing");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        videoUrl: videoUrl,
        videoType: videoType,
        message: `Vidéo ${videoType} générée avec succès!`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-homepage-videos function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
