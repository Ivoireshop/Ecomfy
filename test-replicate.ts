import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/dotenv/load.ts";

async function run() {
  const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
  console.log("Key exists:", !!replicateApiKey);
  if (!replicateApiKey) return;
  
  const imagePublicUrl = "https://picsum.photos/1024/1024";
  const enhancedPrompt = "Test video";
  
  console.log("Using Replicate minimax/video-01-live...");
  const replicateResp = await fetch("https://api.replicate.com/v1/models/minimax/video-01-live/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({
      input: {
        prompt: enhancedPrompt,
        first_frame_image: imagePublicUrl,
        prompt_optimizer: true,
      },
    }),
  });

  if (replicateResp.ok) {
    const repData = await replicateResp.json();
    console.log("Replicate initial status:", repData.status);
    console.log("Replicate output:", repData.output);
  } else {
    const errText = await replicateResp.text();
    console.error("Replicate error:", replicateResp.status, errText);
  }
}
run();
