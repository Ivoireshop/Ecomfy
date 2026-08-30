export function getOpenAiApiKey(): string {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey && envKey.trim().length > 0) return envKey.trim();
  return "";
}

/**
 * Analyse une image de produit avec GPT-4o-mini (Vision) pour en extraire les caractéristiques visuelles
 */
export async function analyzeImageWithGpt4oMini(imageUrl: string, instruction?: string): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !imageUrl) return "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: instruction || "Analyse cette image de produit en détail (couleurs, emballage, catégorie, style) et décris le décor de fond publicitaire idéal pour une campagne commerciale haut de gamme. Réponds en anglais sous forme de prompt concis.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } else {
      console.warn("GPT-4o-mini Vision error:", res.status, await res.text());
    }
  } catch (err) {
    console.warn("GPT-4o-mini Vision call exception:", err);
  }
  return "";
}

/**
 * Optimise un prompt utilisateur avec GPT-4o-mini pour créer des prompts d'images ultra-détaillés
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
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert advertising photographer and art director for the African e-commerce market. Turn simple prompts into vivid, high-converting commercial photography background prompts (in English). Absolutely NO text, letters, or words in the image.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || userPrompt;
    }
  } catch (err) {
    console.warn("GPT-4o-mini prompt optimization failed:", err);
  }
  return userPrompt;
}
