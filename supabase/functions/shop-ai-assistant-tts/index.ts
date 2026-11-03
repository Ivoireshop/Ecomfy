import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeShopOwnerCredit, userHasCredits } from "../_shared/credits-gate.ts";
import { getClientIp, takeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default: Charlotte (warm, natural, very expressive female — better for FR)
const DEFAULT_VOICE = "XB0fDUnXU5powFXDhCwa";

// Un identifiant de voix ElevenLabs est alphanumérique ; il est inséré dans l'URL de l'API.
const VOICE_ID_RE = /^[A-Za-z0-9]{10,40}$/;

// Les échecs restent en HTTP 200 : le widget lit `error` et reste silencieux.
const reply = (payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const creditsRequired = () =>
  reply({
    error: "credits_required",
    message: "Le propriétaire de la boutique doit acheter un pack de crédits IA pour activer l'assistant vocal.",
  });

/**
 * Le propriétaire peut-il payer une voix ? Crédits utilisables, ou essai gratuit vocal pas encore
 * consommé. Vérifié AVANT l'appel ElevenLabs (payant) ; le débit a lieu APRÈS la réponse.
 */
async function ownerCanPayVoice(shopOwnerId: string): Promise<boolean> {
  if (await userHasCredits(shopOwnerId)) return true;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await admin.from("profiles").select("free_voice_used").eq("id", shopOwnerId).maybeSingle();
  return !!data && data.free_voice_used !== true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const text = body?.text;
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";
    const shopId = typeof body?.shopId === "string" ? body.shopId : "";
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = getClientIp(req);

    let shopOwnerId = "";
    if (shopId) {
      // Voix d'une vitrine : plafonds par visiteur et par boutique (chaque voix coûte 2 crédits au propriétaire).
      const allowed =
        (await takeRateLimit("shop-ai-tts:ip:min", `${ip}:${shopId}`, 10, 60)) &&
        (await takeRateLimit("shop-ai-tts:shop", shopId, 300, 3600)) &&
        (await takeRateLimit("shop-ai-tts:global", "all", 3000, 3600));
      if (!allowed) {
        return reply({ error: "rate_limited", message: "Trop de requêtes. Réessayez dans une minute." });
      }

      const { data: shop } = await admin.from("shops").select("user_id").eq("id", shopId).maybeSingle();
      const { data: cfg } = await admin.from("shop_ai_assistants").select("enabled, voice_enabled").eq("shop_id", shopId).maybeSingle();
      if (!shop?.user_id || !cfg?.enabled || !cfg?.voice_enabled) {
        return reply({ error: "assistant_unavailable" });
      }
      shopOwnerId = shop.user_id;
      if (!(await ownerCanPayVoice(shopOwnerId))) return creditsRequired();
    } else {
      // Aperçu depuis les réglages : sans boutique, rien n'est débité, donc il faut un vrai utilisateur
      // (avant, n'importe qui avec la clé publique faisait parler ElevenLabs gratuitement).
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
      const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
      if (!userData?.user) return reply({ error: "not_authenticated", message: "Connectez-vous pour écouter l'aperçu." });
      if (!(await takeRateLimit("shop-ai-tts:preview", userData.user.id, 10, 3600))) {
        return reply({ error: "rate_limited", message: "Trop d'aperçus. Réessayez plus tard." });
      }
    }

    const apiKey = Deno.env.get("ELEVEN_LABS_API_KEY");
    if (!apiKey) {
      console.error("shop-ai-assistant-tts: ELEVEN_LABS_API_KEY not configured");
      return reply({ error: "tts_unavailable", message: "La voix n'est pas disponible pour le moment." });
    }

    const voice = VOICE_ID_RE.test(voiceId) ? voiceId : DEFAULT_VOICE;
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
      return reply({ error: "tts_failed", message: "La voix n'est pas disponible pour le moment." });
    }

    // Débit après une voix réellement produite : un échec ElevenLabs ne coûte rien au propriétaire.
    if (shopOwnerId) {
      const charge = await consumeShopOwnerCredit(shopId, "voice", 2);
      if (!charge.success) return creditsRequired();
    }

    const buf = await response.arrayBuffer();
    const audioBase64 = base64Encode(new Uint8Array(buf));
    return new Response(JSON.stringify({ audioBase64, mime: "audio/mpeg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shop-ai-assistant-tts error:", e);
    return reply({ error: "tts_failed", message: "La voix n'est pas disponible pour le moment." });
  }
});
