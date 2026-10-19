import { getClientIp, takeRateLimit } from "../_shared/rate-limit.ts";

// Public UI translation endpoint.
// - No JWT required (used on public shop/product/landing pages and pre-login screens).
// - No per-user quota; capped via payload size and database-backed throttling (per IP + global, H9).
// - Calls the Lovable AI Gateway (Gemini Flash) and returns a {key: translation} map.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  fr: "French",
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  ar: "Arabic",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  tr: "Turkish",
  hi: "Hindi",
  sw: "Swahili",
  dioula: "Dioula (Mande language of Côte d'Ivoire)",
  baoule: "Baoulé (Akan language of Côte d'Ivoire)",
  bete: "Bété (Kru language of Côte d'Ivoire)",
  attie: "Attié (Kwa language of Côte d'Ivoire)",
};

interface Body {
  texts: Record<string, string>;
  target_lang: string;
  source_lang?: string;
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Plafonds (H9) : endpoint public sans authentification, chaque appel coûte un appel de modèle.
// Le compteur global borne le coût total même si l'attaquant change d'adresse IP.
const IP_PER_MINUTE = 20;
const IP_PER_HOUR = 200;
const GLOBAL_PER_HOUR = 3000;
const MAX_TOTAL_CHARS = 30_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip = getClientIp(req);
    const allowed =
      (await takeRateLimit("translate-ui:ip:min", ip, IP_PER_MINUTE, 60)) &&
      (await takeRateLimit("translate-ui:ip:hour", ip, IP_PER_HOUR, 3600)) &&
      (await takeRateLimit("translate-ui:global", "all", GLOBAL_PER_HOUR, 3600));
    if (!allowed) {
      return json({ success: false, error: "rate_limited", translations: {} });
    }

    const body = (await req.json()) as Body;
    const { texts, target_lang, source_lang = "fr" } = body ?? {};

    if (!texts || typeof texts !== "object" || Array.isArray(texts)) {
      return json({ success: false, error: "invalid_params" });
    }
    // Langues connues uniquement : ces valeurs sont recopiées dans la consigne envoyée au modèle.
    if (!Object.hasOwn(LANG_NAMES, target_lang) || !Object.hasOwn(LANG_NAMES, source_lang)) {
      return json({ success: false, error: "invalid_params" });
    }

    const entries = Object.entries(texts).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0 && v.length < 2000,
    );
    if (entries.length === 0) {
      return json({ success: true, translations: {} });
    }
    if (entries.length > 120) entries.length = 120;
    if (entries.reduce((n, [, v]) => n + v.length, 0) > MAX_TOTAL_CHARS) {
      return json({ success: false, error: "payload_too_large" });
    }

    if (target_lang === source_lang) {
      return json({ success: true, translations: Object.fromEntries(entries) });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ success: false, error: "missing_api_key" });
    }

    const targetName = LANG_NAMES[target_lang];
    const sourceName = LANG_NAMES[source_lang];

    const payload = Object.fromEntries(entries);
    const systemPrompt =
      `You are a professional UI translator. Translate the JSON string values from ${sourceName} to ${targetName}. ` +
      `Preserve HTML tags, line breaks, emojis, placeholders (e.g. {{name}}, %s, $1), brand/product names and numbers. ` +
      `Keep punctuation and casing natural for the target language. ` +
      `Return ONLY a JSON object with the SAME keys and translated string values. No commentary.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({
        success: false,
        error: `ai_failed_${aiRes.status}`,
        detail: errText.slice(0, 200),
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let translations: Record<string, string> = {};
    try {
      translations = JSON.parse(content);
    } catch {
      return json({ success: false, error: "parse_failed" });
    }

    return json({ success: true, translations });
  } catch (e) {
    return json({ success: false, error: (e as Error).message });
  }
});