// Public UI translation endpoint.
// - No JWT required (used on public shop/product/landing pages and pre-login screens).
// - No per-user quota; capped via payload-size and lightweight in-memory IP throttling.
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

// Simple in-memory IP throttle (per instance, best-effort).
const ipHits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_MIN = 60;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = ipHits.get(ip);
  if (!slot || slot.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  slot.count += 1;
  return slot.count > MAX_PER_MIN;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    if (rateLimited(ip)) {
      return json({ success: false, error: "rate_limited", translations: {} });
    }

    const body = (await req.json()) as Body;
    const { texts, target_lang, source_lang = "fr" } = body ?? {};

    if (!texts || typeof texts !== "object" || !target_lang) {
      return json({ success: false, error: "invalid_params" });
    }

    const entries = Object.entries(texts).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0 && v.length < 2000,
    );
    if (entries.length === 0) {
      return json({ success: true, translations: {} });
    }
    if (entries.length > 120) entries.length = 120;

    if (target_lang === source_lang) {
      return json({ success: true, translations: Object.fromEntries(entries) });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ success: false, error: "missing_api_key" });
    }

    const targetName = LANG_NAMES[target_lang] ?? target_lang;
    const sourceName = LANG_NAMES[source_lang] ?? source_lang;

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