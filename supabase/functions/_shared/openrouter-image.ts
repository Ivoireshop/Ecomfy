// Shared OpenRouter image generation helper.
// Tries OpenRouter first (auto-routes to the best image model), with optional fallback.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Models OpenRouter routes to for image generation, in order of preference.
const OPENROUTER_IMAGE_MODELS = [
  "google/gemini-1.5-flash",
];

export interface OpenRouterImageOptions {
  prompt: string;
  referenceImages?: string[]; // data URLs or http URLs
  timeoutMs?: number;
}

/**
 * Generate an image via OpenRouter. Returns a data URL or http URL.
 * Throws on hard failure so caller can fallback.
 */
export async function generateImageWithOpenRouter(
  apiKey: string,
  opts: OpenRouterImageOptions,
): Promise<string> {
  const { prompt, referenceImages = [], timeoutMs = 90000 } = opts;

  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of referenceImages) {
    content.push({ type: "image_url", image_url: { url } });
  }

  let lastError: string = "";
  for (const model of OPENROUTER_IMAGE_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      console.log(`[OpenRouter] Trying image model: ${model}`);
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://visuelpro.cloud",
          "X-Title": "VisuelPro",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        lastError = `${resp.status}: ${errText}`;
        console.warn(`[OpenRouter] ${model} failed:`, lastError);
        continue;
      }

      const data = await resp.json();
      const imageUrl =
        data.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        data.choices?.[0]?.message?.images?.[0]?.url;

      if (imageUrl) {
        console.log(`[OpenRouter] Image generated via ${model}`);
        return imageUrl;
      }
      lastError = "No image in response";
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[OpenRouter] ${model} threw:`, lastError);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`OpenRouter image generation failed: ${lastError}`);
}

export function getOpenRouterKey(): string | undefined {
  return Deno.env.get("OPENROUTER_API_KEY");
}