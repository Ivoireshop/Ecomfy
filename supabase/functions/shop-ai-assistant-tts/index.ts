import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default: Sarah (warm, friendly female), multilingual_v2 supports FR/EN
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voiceId, language } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.35,
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