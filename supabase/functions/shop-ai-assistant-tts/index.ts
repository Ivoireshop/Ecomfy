import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeShopOwnerCredit } from "../_shared/credits-gate.ts";

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

    // IP-based rate limit: 30 req / min / IP to prevent credit drain abuse
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: rl } = await supabase.rpc("check_rate_limit", {
        _bucket: "shop-ai-tts",
        _key: `${ip}:${shopId || "anon"}`,
        _max: 30,
        _window_seconds: 60,
      });
      if (rl && (rl as any).allowed === false) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Trop de requêtes. Réessayez dans une minute." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (_) {
      // fail-open on rate-limit infra errors; downstream credit check still protects
    }

    // 1 free trial per shop owner, then 2 credits per voice message
    if (shopId) {
      const charge = await consumeShopOwnerCredit(shopId, "voice", 2);
      if (!charge.success) {
        return new Response(
          JSON.stringify({
            error: "credits_required",
            message:
              "Le propriétaire de la boutique doit acheter un pack de crédits IA pour activer l'assistant vocal.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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