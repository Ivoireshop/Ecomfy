import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { shopOwnerHasCredits } from "../_shared/credits-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default: Charlotte (warm, natural, very expressive female — better for FR)
const DEFAULT_VOICE = "XB0fDUnXU5powFXDhCwa";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voiceId, language, shopId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If a shopId is provided, gate audio on the owner's IA credit balance
    if (shopId) {
      const ownerOk = await shopOwnerHasCredits(shopId);
      if (!ownerOk) {
        return new Response(JSON.stringify({ error: "credits_required" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const apiKey = Deno.env.get("ELEVEN_LABS_API_KEY");
    if (!apiKey) throw new Error("ELEVEN_LABS_API_KEY not configured");

    const voice = voiceId || DEFAULT_VOICE;
    // Trim long inputs to keep latency reasonable
    const safeText = text.length > 1200 ? text.slice(0, 1200) : text;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: safeText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.85,
            style: 0.55,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs TTS error:", response.status, err);
      return new Response(JSON.stringify({ error: "tts_failed", detail: err.slice(0, 200) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = await response.arrayBuffer();
    const audioBase64 = base64Encode(new Uint8Array(buf));
    return new Response(JSON.stringify({ audioBase64, mime: "audio/mpeg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shop-ai-assistant-tts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});