export function getOpenAiApiKey(): string {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey && envKey.trim().length > 0) return envKey.trim();
  return "";
}

/**
 * Analyse une image de produit avec GPT-4o (Vision haute précision) pour en extraire l'identité visuelle exacte
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
    // Try gpt-4o flagship model first for vision precision, with gpt-4o-mini fallback
    for (const model of ["gpt-4o", "gpt-4o-mini"]) {
      console.log(`[Vision Audit] Analyzing image with ${model}...`);
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
          max_tokens: 800,
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Vision Audit] Successfully analyzed with ${model}`);
          return content;
        }
      } else {
        console.warn(`[Vision Audit] ${model} error:`, res.status, await res.text());
      }
    }
  } catch (err) {
    console.warn("[Vision Audit] Exception:", err);
  }
  return "";
}

/**
 * Optimise un prompt utilisateur avec GPT-4o tout en préservant 100% de la demande et des détails fournis
 */
export async function optimizePromptWithGpt4oMini(userPrompt: string): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !userPrompt) return userPrompt;

  try {
    for (const model of ["gpt-4o", "gpt-4o-mini"]) {
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
              role: "system",
              content: `You are an elite master prompt engineer and creative director for commercial advertising photography in e-commerce.

CRITICAL DIRECTIVE: You MUST preserve 100% of the user's explicit instructions, subjects, specific product descriptions, human models, colors, style choices, and visual requirements.
DO NOT remove, alter, or ignore any subject, model, person, or specific product detail provided by the user.

Your goal is to ENHANCE and EXPAND the prompt by adding photorealistic studio photography specs (85mm f/1.4 lens, soft studio lights, warm golden hour tones, depth of field, sharp textures) and high-converting commercial photography composition.
Output a single, rich, highly-detailed DALL-E 3 prompt in English that strictly fulfills all user requirements.`,
            },
            {
              role: "user",
              content: userPrompt,
            },
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
    }
  } catch (err) {
    console.warn("Prompt optimization failed:", err);
  }
  return userPrompt;
}
