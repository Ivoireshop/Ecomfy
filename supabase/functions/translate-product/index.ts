import { createClient } from "npm:@supabase/supabase-js@2";

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
  dioula: "Dioula (Mande language of Côte d'Ivoire)",
  baoule: "Baoulé (Akan language of Côte d'Ivoire)",
  bete: "Bété (Kru language of Côte d'Ivoire)",
  attie: "Attié (Kwa language of Côte d'Ivoire)",
};

interface Body {
  texts: Record<string, string>; // { key: text }
  target_lang: string;
  source_lang?: string;
  shop_id?: string;
  product_id?: string;
  persist?: boolean;
  source?: "manual" | "ai_auto";
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200, // always 200 per project convention
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(200, { success: false, error: "Authentification requise." });
    }
    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: ud, error: ue } = await sbAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !ud?.user) {
      return json(200, { success: false, error: "Authentification requise." });
    }
    const userId = ud.user.id;

    const body = (await req.json()) as Body;
    const { texts, target_lang, source_lang = "fr" } = body;

    if (!texts || typeof texts !== "object" || !target_lang) {
      return json(200, { success: false, error: "Paramètres invalides." });
    }

    // Filter empty values
    const entries = Object.entries(texts).filter(([, v]) => typeof v === "string" && v.trim().length > 0);
    if (entries.length === 0) {
      return json(200, { success: true, translations: {} });
    }

    if (target_lang === source_lang) {
      return json(200, { success: true, translations: Object.fromEntries(entries) });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json(200, { success: false, error: "LOVABLE_API_KEY manquante." });
    }

    const targetName = LANG_NAMES[target_lang] ?? target_lang;
    const sourceName = LANG_NAMES[source_lang] ?? source_lang;

    const payload = Object.fromEntries(entries);
    const systemPrompt =
      `You are a professional e-commerce translator. Translate the JSON values from ${sourceName} to ${targetName}. ` +
      `Preserve HTML tags, line breaks, emojis, brand/product names and numbers. ` +
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
      return json(200, { success: false, error: `Échec traduction IA: ${aiRes.status} ${errText.slice(0, 200)}` });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let translations: Record<string, string> = {};
    try {
      translations = JSON.parse(content);
    } catch {
      return json(200, { success: false, error: "Réponse IA non parsable." });
    }

    // Optional persistence
    if (body.persist && (body.product_id || body.shop_id)) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        // Verify caller owns the shop before any write
        if (!body.shop_id) {
          return json(200, { success: false, error: "shop_id requis pour persister." });
        }
        const { data: shopRow, error: shopErr } = await supabase
          .from("shops")
          .select("id, user_id")
          .eq("id", body.shop_id)
          .maybeSingle();
        if (shopErr || !shopRow || shopRow.user_id !== userId) {
          return json(200, { success: false, error: "Accès refusé à cette boutique." });
        }
        if (body.product_id) {
          const { data: prodRow, error: prodErr } = await supabase
            .from("products")
            .select("id, shop_id")
            .eq("id", body.product_id)
            .maybeSingle();
          if (prodErr || !prodRow || prodRow.shop_id !== body.shop_id) {
            return json(200, { success: false, error: "Produit invalide pour cette boutique." });
          }
        }
        const src = body.source ?? "ai_auto";
        if (body.product_id && body.shop_id) {
          await supabase.from("product_translations").upsert(
            {
              product_id: body.product_id,
              shop_id: body.shop_id,
              language: target_lang,
              name: translations.name ?? null,
              short_description: translations.short_description ?? null,
              description: translations.description ?? null,
              category: translations.category ?? null,
              source: src,
            },
            { onConflict: "product_id,language" },
          );
        } else if (body.shop_id) {
          await supabase.from("shop_translations").upsert(
            {
              shop_id: body.shop_id,
              language: target_lang,
              business_name: translations.business_name ?? null,
              business_description: translations.business_description ?? null,
              seo_title: translations.seo_title ?? null,
              seo_description: translations.seo_description ?? null,
              source: src,
            },
            { onConflict: "shop_id,language" },
          );
        }
      } catch (e) {
        console.error("persist error", e);
      }
    }

    return json(200, { success: true, translations });
  } catch (e) {
    return json(200, { success: false, error: (e as Error).message });
  }
});