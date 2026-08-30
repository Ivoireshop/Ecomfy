import { OPENAI_CONFIG, getOpenAiApiKey } from "./openai-config.ts";

export interface PromptEngineInput {
  userPrompt: string;
  mode?: string; // One of the 10 E-commerce modes
  style?: string;
  sourceImageAnalysis?: string; // High precision Vision audit of reference image
  aspectRatio?: string;
  productName?: string;
  niche?: string;
}

export const ECOMMERCE_MODES: Record<string, { name: string; compositionRules: string }> = {
  "photo-produit": {
    name: "Photo Produit Studio",
    compositionRules: "Pure commercial e-commerce studio photography. The product is placed on a pristine marble or polished wooden pedestal, soft reflections, neutral background with subtle gradient lighting, sharp focus on every packaging detail, no distracting elements."
  },
  "publicite-produit": {
    name: "Publicité Produit High-Conversion",
    compositionRules: "High-impact social media commercial advertisement. Vibrant color harmony, dynamic lighting contrast, clear visual hierarchy with the product prominently featured in the focal sweet spot, commercial grade advertising aesthetic."
  },
  "lifestyle": {
    name: "Lifestyle & Situation",
    compositionRules: "Real-world luxury lifestyle context. Elegant indoor or outdoor setting (modern sunlit African villa, sleek marble kitchen, or executive lounge), natural soft lighting, aesthetic depth of field with creamy background bokeh."
  },
  "temoignage-client": {
    name: "Témoignage Client Authentique",
    compositionRules: "Authentic customer satisfaction scene. A delighted, relatable customer smiling warmly while showcasing the product, natural ambient lighting, genuine emotion of trust and happiness."
  },
  "ugc": {
    name: "User Generated Content (UGC)",
    compositionRules: "Native smartphone camera aesthetic for TikTok and Instagram. Authentic lighting, casual real-world setting, relatable lifestyle backdrop, organic non-overprocessed feel while preserving product clarity."
  },
  "avant-apres": {
    name: "Avant / Après (Transformation)",
    compositionRules: "Side-by-side split visual composition. Left side shows initial state/need, right side shows stunning radiant result delivered by the product, clear high-contrast visual demonstration."
  },
  "produit-en-main": {
    name: "Produit Tenu en Main",
    compositionRules: "Close-up shot of model's hands holding the product product hero. Perfect manicured hands holding the container securely, crisp detail on label text and packaging, soft blurred background."
  },
  "produit-utilise": {
    name: "Produit en Cours d'Utilisation",
    compositionRules: "Active in-use product demonstration. Model actively applying or demonstrating the product in action, capturing the texture, serum droplets, cream spread, or functional usage in real time."
  },
  "affiche-publicitaire": {
    name: "Affiche Publicitaire Premium",
    compositionRules: "High-end magazine billboard poster layout. Dramatic commercial key lighting, high contrast, cinematic depth, magazine cover aesthetic, luxury brand feel."
  },
  "reseaux-sociaux": {
    name: "Contenu Réseaux Sociaux (Instagram/TikTok)",
    compositionRules: "Modern social media aesthetic. Vibrant colors, trendy arrangement, warm natural lighting, high engagement visual framing optimized for mobile screens."
  }
};

export class PromptEngine {
  /**
   * Transforms raw user input + vision audit into a comprehensive 23-point commercial ad prompt
   */
  public static async generateProfessionalPrompt(input: PromptEngineInput): Promise<string> {
    const apiKey = getOpenAiApiKey();
    const rawUserPrompt = (input.userPrompt || "").trim();
    const modeKey = input.mode || "publicite-produit";
    const modeInfo = ECOMMERCE_MODES[modeKey] || ECOMMERCE_MODES["publicite-produit"];
    const visionAudit = input.sourceImageAnalysis || "";

    // If no OpenAI API Key available, fallback to structured template construction
    if (!apiKey) {
      return this.buildFallbackPrompt(rawUserPrompt, modeInfo, visionAudit, input.style);
    }

    const systemInstructions = `You are PromptEngine, an elite Creative Director and Commercial Advertising Photographer specializing in E-Commerce product visuals.

CRITICAL NON-NEGOTIABLE DIRECTIVES:
1. STRICT USER INTENT PRESERVATION: Preserve 100% of the user's explicit request. NEVER remove or alter requested human models (e.g. African man/woman, age, clothing), product details, colors, background elements, or core message.
2. AFRICAN E-COMMERCE ACCURACY: If the prompt requests an African model, person, or context, strictly maintain authentic African representation (skin tone, elegance, modern African fashion or executive attire, cultural authenticity).
3. PRODUCT FIDELITY: If a product visual audit is provided, treat it as the SACRED REFERENCE. Do NOT change logo, container shape, color, typography, or packaging proportions.
4. COMMERCIAL ADVERTISING PHOTOGRAPHY: Output MUST specify professional camera gear (85mm f/1.4 lens, Hasselblad/Canon EOS R5 quality, softbox studio lights, shallow depth of field, sharp textures, natural skin pores, 8k resolution, no AI plastic gloss).

Structure the final prompt in English by systematically covering these 23 Commercial Pillars:
1. Product Visual Identity & Container Type
2. Commercial Ad Goal (High Conversion)
3. Target Audience & Cultural Context
4. African / Regional Demographics (if requested)
5. Scene Setting & Environment
6. Model / Character Identity & Ethnicity
7. Model Approximate Age & Gender
8. Model Appearance & Vibe
9. Clothing & Attire Style
10. Facial Expression & Warmth
11. Body Pose & Gesture
12. Interaction with Product
13. Background Environment & Atmosphere
14. Visual Composition & Rule of Thirds
15. Camera Framing (Medium Shot / Close-up / Hero)
16. Angle & Perspective
17. Lighting Setup (Softbox / Golden Hour / Rim Light)
18. Depth of Field & Bokeh (f/1.4)
19. Art Direction & Mood
20. Photorealism Level & Textures (Natural Skin & Glass/Metal)
21. Hero Product Placement (Centerstage, un-obscured)
22. Brand & Packaging Consistency
23. Aspect Ratio & Commercial Formatting

Output ONLY the final expanded commercial prompt in plain English, with no meta-commentary or conversational intro.`;

    const userContent = `[USER REQUEST]:
${rawUserPrompt || "High-end commercial product advertisement"}

[MODE & COMPOSITION STYLE]:
${modeInfo.name} - ${modeInfo.compositionRules}
Selected Style: ${input.style || "Professional Commercial Studio"}

${visionAudit ? `[REFERENCE PRODUCT VISUAL AUDIT - MUST REPRODUCE FAITHFULLY]:\n${visionAudit}` : "[NOTE]: No image reference provided. Create hero product based on user text."}`;

    try {
      console.log(`[PromptEngine] Synthesizing prompt with ${OPENAI_CONFIG.TEXT_MODEL}...`);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_CONFIG.TEXT_MODEL,
          messages: [
            { role: "system", content: systemInstructions },
            { role: "user", content: userContent },
          ],
          max_tokens: OPENAI_CONFIG.PROMPT_ENGINE_MAX_TOKENS,
          temperature: OPENAI_CONFIG.PROMPT_ENGINE_TEMPERATURE,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const generatedPrompt = data.choices?.[0]?.message?.content?.trim();
        if (generatedPrompt && generatedPrompt.length > 50) {
          console.log("[PromptEngine] Successfully generated 23-pillar commercial prompt.");
          return generatedPrompt;
        }
      } else {
        console.warn("[PromptEngine] API response not OK:", res.status, await res.text());
      }
    } catch (err) {
      console.error("[PromptEngine] Exception during prompt synthesis:", err);
    }

    return this.buildFallbackPrompt(rawUserPrompt, modeInfo, visionAudit, input.style);
  }

  private static buildFallbackPrompt(
    userPrompt: string,
    modeInfo: { name: string; compositionRules: string },
    visionAudit: string,
    style?: string
  ): string {
    let prompt = `Commercial advertising photography for e-commerce. ${modeInfo.compositionRules} `;
    if (userPrompt) prompt += `\n\nUser Brief: ${userPrompt}. `;
    if (visionAudit) prompt += `\n\nExact Hero Product Visual Specs: ${visionAudit}. `;
    prompt += `\n\nArt Direction: ${style || "Professional Studio"}. Shot on 85mm f/1.4 lens, soft commercial studio lights, shallow depth of field, photorealistic, sharp focus, 8k resolution.`;
    return prompt;
  }
}
