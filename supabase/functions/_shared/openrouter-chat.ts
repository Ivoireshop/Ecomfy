// Shared OpenRouter chat helper with Lovable Cloud fallback.
// Primary: Gemini via OpenRouter (uses OPENROUTER_API_KEY).
// Fallback: Lovable AI Gateway (uses LOVABLE_API_KEY) when OpenRouter
// returns no credits / auth / rate-limit / server errors.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Gemini model order (OpenRouter first, then Lovable Cloud).
const OPENROUTER_TEXT_MODEL = "google/gemini-1.5-flash";
const LOVABLE_TEXT_MODEL = "google/gemini-1.5-flash";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: any;
}

export interface ChatOptions {
  messages: ChatMessage[];
  jsonMode?: boolean;
  timeoutMs?: number;
  model?: string; // override (used for both, must be Gemini-compatible)
}

export interface ChatResult {
  content: string;
  provider: "openrouter" | "lovable";
  status: number;
}

function shouldFallback(status: number): boolean {
  // 401 invalid key, 402 no credits, 403 forbidden, 404 model gone,
  // 429 rate-limited, 5xx upstream — fall back to Lovable Cloud.
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429 || status >= 500;
}

/**
 * Try OpenRouter Gemini first; on failure or no-credit, fall back to Lovable Cloud Gemini.
 * Throws only if BOTH providers fail.
 */
export async function geminiChat(opts: ChatOptions): Promise<ChatResult> {
  const { messages, jsonMode = false, timeoutMs = 60000, model } = opts;
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  // 1) Try OpenRouter
  if (openRouterKey) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://visuelpro.cloud",
          "X-Title": "VisuelPro",
        },
        body: JSON.stringify({
          model: model || OPENROUTER_TEXT_MODEL,
          messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content ?? "";
        if (content) return { content, provider: "openrouter", status: 200 };
        console.warn("[geminiChat] OpenRouter returned empty content, falling back");
      } else {
        const errText = await resp.text();
        console.warn(`[geminiChat] OpenRouter ${resp.status}:`, errText.slice(0, 300));
        if (!shouldFallback(resp.status)) {
          throw new Error(`OpenRouter ${resp.status}: ${errText.slice(0, 200)}`);
        }
      }
    } catch (e) {
      console.warn("[geminiChat] OpenRouter exception:", e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(t);
    }
  }

  // 2) Fallback to Lovable Cloud
  if (!lovableKey) {
    throw new Error("Aucun fournisseur IA disponible (OpenRouter et Lovable Cloud)");
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(LOVABLE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || LOVABLE_TEXT_MODEL,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      const err: any = new Error(`Lovable Cloud ${resp.status}: ${errText.slice(0, 200)}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return { content, provider: "lovable", status: 200 };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Gemini image generation: OpenRouter first, Lovable Cloud fallback.
 * Returns a data URL or http URL.
 */
export async function geminiImage(
  prompt: string,
  referenceImages: string[] = [],
  timeoutMs = 90000,
): Promise<{ url: string; provider: "openrouter" | "lovable" }> {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of referenceImages) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const body = {
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
  };

  // 1) OpenRouter
  if (openRouterKey) {
    const models = ["google/gemini-1.5-flash", "google/gemini-1.5-flash"];
    for (const model of models) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(OPENROUTER_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://visuelpro.cloud",
            "X-Title": "VisuelPro",
          },
          body: JSON.stringify({ model, ...body }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const url =
            data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
            data?.choices?.[0]?.message?.images?.[0]?.url;
          if (url) return { url, provider: "openrouter" };
        } else {
          const errText = await resp.text();
          console.warn(`[geminiImage] OpenRouter ${model} ${resp.status}:`, errText.slice(0, 200));
          if (!shouldFallback(resp.status)) break;
        }
      } catch (e) {
        console.warn(`[geminiImage] OpenRouter ${model} exception:`, e);
      } finally {
        clearTimeout(t);
      }
    }
  }

  // 2) Fallback to Lovable Cloud
  if (!lovableKey) throw new Error("Aucun fournisseur image disponible");
  const resp = await fetch(LOVABLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-1.5-flash", ...body }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Lovable Cloud image ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = await resp.json();
  const url =
    data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
    data?.choices?.[0]?.message?.content;
  if (typeof url !== "string" || !url) throw new Error("Lovable Cloud: pas d'image retournée");
  return { url, provider: "lovable" };
}