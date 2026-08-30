// @ts-nocheck
import { OPENAI_CONFIG, getOpenAiApiKey } from "./openai-config.ts";

export { getOpenAiApiKey };

/**
 * Analyses an uploaded product photo with GPT-4o Vision to extract exact visual identity (packaging, logo, colors, materials)
 */
export async function analyzeImageWithGpt4oMini(imageUrl: string, instruction?: string): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !imageUrl) return "";

  const visionPrompt = instruction || `Perform an ultra-high precision commercial product visual audit of this uploaded reference image.
Describe in detail (in English) so OpenAI DALL-E 3 can recreate this EXACT product faithfully:
1. EXACT PRODUCT IDENTITY: Product type, container/packaging shape (bottle, box, jar, tube, bag, etc.), materials (glass, matte plastic, gold metal, leather, fabric), cap/closure style.
2. COLOR PALETTE: Primary, secondary, and accent colors, gradients, metallic foils, label colors.
3. BRANDING & TEXT: Logo placement, label design, typography style, key visible branding elements.
4. TEXTURE & FINISH: Glossy, reflective, matte, embossed, woven, transparent.
Format as a clear, structured prompt fragment designed for DALL-E 3 to faithfully recreate this exact product hero element in a professional ad background.`;

  try {
    for (const model of [OPENAI_CONFIG.VISION_MODEL, "gpt-4o-mini"]) {
      console.log(`[Vision Audit] Auditing reference image with ${model}...`);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          max_tokens: OPENAI_CONFIG.VISION_MAX_TOKENS,
          temperature: OPENAI_CONFIG.VISION_TEMPERATURE,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Vision Audit] Successfully extracted visual identity with ${model}`);
          return content;
        }
      } else {
        console.warn(`[Vision Audit] ${model} warning:`, res.status, await res.text());
      }
    }
  } catch (err) {
    console.warn("[Vision Audit] Exception:", err);
  }
  return "";
}

/**
 * Legacy prompt optimizer wrapper (delegates to PromptEngine or gpt-4o)
 */
export async function optimizePromptWithGpt4oMini(userPrompt: string): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !userPrompt) return userPrompt;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a master creative director for e-commerce advertising photography. Preserve 100% of user instructions (character, ethnicity, age, product specs). Expand with photorealistic studio specs.",
          },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const result = data.choices?.[0]?.message?.content?.trim();
      if (result) return result;
    }
  } catch (err) {
    console.warn("[Prompt Optimizer] Exception:", err);
  }
  return userPrompt;
}
