// @ts-nocheck
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
    name: "Photo Produit Studio Ultra-Pro",
    compositionRules: "High-end commercial product studio photography. Hero product centered on a premium pedestal (marble, polished dark wood, or satin silk). Softbox lighting with subtle rim lights, crystal clear glass/plastic reflections, razor-sharp packaging textures, zero distractions."
  },
  "publicite-produit": {
    name: "Publicité Produit High-Conversion",
    compositionRules: "High-impact commercial social media ad visual. Vibrant harmonious background, bold visual hierarchy, hero product prominently presented in the sweet spot. Includes French advertising callouts if text is requested, golden seal badges ('SATISFAIT OU REMBOURSÉ', '100% NATUREL'), professional art direction."
  },
  "lifestyle": {
    name: "Lifestyle & Situation",
    compositionRules: "Authentic luxury lifestyle context. Modern sunlit African villa, sleek marble kitchen, or upscale lounge setting. Natural soft sunlight, creamy depth-of-field bokeh, elegant model interaction."
  },
  "temoignage-client": {
    name: "Témoignage Client Authentique",
    compositionRules: "Authentic client recommendation scene. A delighted, elegant African customer smiling warmly and holding/pointing at the product with genuine satisfaction, realistic skin pores, natural lighting, trustworthy atmosphere."
  },
  "ugc": {
    name: "User Generated Content (UGC)",
    compositionRules: "Native smartphone camera aesthetic for Instagram & TikTok. Authentic lighting, casual real-world setting, relatable lifestyle backdrop, organic non-overprocessed feel while preserving high product clarity."
  },
  "avant-apres": {
    name: "Avant / Après (Transformation)",
    compositionRules: "Side-by-side split visual composition. Left side demonstrates initial need/problem, right side displays radiant radiant result delivered by the product. High contrast visual storytelling."
  },
  "produit-en-main": {
    name: "Produit Tenu en Main",
    compositionRules: "Close-up hero shot of model's hands holding or presenting the product bottle/packaging. Anatomically accurate fingers, manicured hands, crisp label typography and packaging details, soft blurred background."
  },
  "produit-utilise": {
    name: "Produit en Cours d'Utilisation",
    compositionRules: "Active in-use product demonstration. Model applying serum droplets, spreading cream, or actively using the item with realistic texture details and natural expressions."
  },
  "affiche-publicitaire": {
    name: "Affiche Publicitaire Premium",
    compositionRules: "Luxury magazine cover & billboard poster visual. Dramatic commercial key lighting, high contrast color grade, bold French advertising typography headers, luxury brand finish."
  },
  "reseaux-sociaux": {
    name: "Contenu Réseaux Sociaux (Instagram/TikTok)",
    compositionRules: "Modern high-engagement social media visual. Vibrant colors, trendy framing, warm studio lighting, optimized for mobile feed scrolling."
  }
};

export class PromptEngine {
  /**
   * Transforms raw user input + vision audit into an ultra-expanded, professional commercial ad prompt
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

    const systemInstructions = `You are Ecomfy PromptEngine, an elite Art Director, Commercial Photographer, and Senior Advertising Designer specializing in high-conversion e-commerce visuals.

CORE OPERATIONAL PHILOSOPHY:
"The user provides the raw idea. Ecomfy provides creative expertise and flawless execution."
Even if the user prompt is extremely short (e.g. "Un homme avec ce produit" or "Publicité pour ce produit"), YOU MUST ENRICH IT AUTOMATICALLY into a complete, professional, studio-grade creative brief.

NON-NEGOTIABLE ECOMFY DIRECTIVES:

1. DEFAULT ETHNICITY RULE (AFRICAN DEFAULT):
   - Whenever human characters (models, customers, doctors, entrepreneurs, families) are requested or implied AND NO explicit ethnicity is specified by the user -> DEFAULT TO ELEGANT, AUTHENTIC AFRICAN CHARACTERS (e.g., handsome African man, stunning African woman, joyful African couple, respected senior African elder).
   - EXCEPTION: If the user explicitly requests another ethnicity ("Un homme japonais", "Une femme européenne"), STRICTLY follow the user's explicit request.

2. DEFAULT LANGUAGE FOR TEXT IN VISUALS (FRENCH DEFAULT):
   - If the visual includes graphic text, banners, titles, callouts, or badges, ALL TEXT MUST BE IN NATURAL FRENCH UNLESS THE USER EXPLICITLY REQUESTS ANOTHER LANGUAGE (e.g. English).
   - If the user explicitly requests English, format all text callouts and slogans in English (e.g., "BUY NOW", "SPECIAL OFFER").
   - If no language is specified, use professional French copy: "ACHETEZ MAINTENANT", "OFFRE SPÉCIALE", "NOUVEAUTÉ", "SATISFAIT OU REMBOURSÉ", "100% NATUREL", "LIVRAISON DISPONIBLE".

3. PRODUCT FIDELITY & PACKAGING PRESERVATION:
   - If a reference image vision audit is provided, preserve 100% of the original product packaging, logo, colors, shape, container type, and labeling. Do not invent a different packaging or brand.

4. EXTREME PHOTOREALISM & HUMAN QUALITY:
   - Eliminate plastic AI skin gloss and uncanny faces.
   - Require realistic skin texture with visible pores, natural hair strands, anatomically flawless hands with 5 fingers, realistic eye reflections, natural warm smiles.
   - Use studio camera specs: Hasselblad H6D-100c / Canon EOS R5, 85mm f/1.4 lens, softbox studio lighting, shallow depth of field, 8K resolution sharp focus.

5. ADVERTISING vs. SIMPLE VISUAL ADAPTATION:
   - Simple Visual: Focus on pristine photography, depth, light, composition, photorealism.
   - Advertising Visual: Include commercial visual hierarchy, high-contrast banner overlays, product benefits callouts in French, gold quality trust badges ("SATISFAIT OU REMBOURSÉ", "100% NATUREL").

HIERARCHY OF PRIORITIES IN CASE OF CONFLICT:
1. Explicit user request details (e.g. specific ethnicity or language if explicitly named).
2. Product fidelity from reference image vision audit.
3. Aspect ratio and composition layout.
4. French language rule for ad text.
5. African ethnicity default rule for human models.
6. Ecomfy Art Direction & Photorealism enrichment.

Structure your final prompt in clear, vivid English containing:
- Full scene composition & environment
- Model description (African default unless specified otherwise), attire, emotion, and interaction
- Hero product placement & fidelity
- Studio lighting, camera gear (85mm f/1.4), depth of field, and photorealistic textures
- French text callouts & badges (if commercial ad visual mode)

Output ONLY the expanded prompt in plain English, with no meta-commentary.`;

    const userContent = `[USER BRIEF]:
${rawUserPrompt || "Visuel publicitaire professionnel pour e-commerce"}

[MODE & STYLE]:
Mode: ${modeInfo.name} (${modeInfo.compositionRules})
Selected Style: ${input.style || "Studio Commercial Premium"}
${input.productName ? `Product Name: ${input.productName}` : ""}
${input.niche ? `Niche/Category: ${input.niche}` : ""}

${visionAudit ? `[EXACT PRODUCT VISUAL REFERENCE AUDIT - REPRODUCE FAITHFULLY]:\n${visionAudit}` : "[NOTE]: No product reference photo attached. Generate hero product according to brief."}`;

    try {
      console.log(`[PromptEngine] Synthesizing ultra-rich prompt with ${OPENAI_CONFIG.TEXT_MODEL}...`);
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
          console.log("[PromptEngine] Successfully generated ultra-enhanced Ecomfy commercial prompt.");
          return generatedPrompt;
        }
      } else {
        console.warn("[PromptEngine] API response error:", res.status, await res.text());
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
    let prompt = `Ultra-photorealistic commercial e-commerce advertising visual. ${modeInfo.compositionRules} `;
    
    // Default to African model if prompt implies human but no ethnicity specified
    const lower = userPrompt.toLowerCase();
    const hasHuman = lower.includes("homme") || lower.includes("femme") || lower.includes("personne") || lower.includes("man") || lower.includes("woman") || lower.includes("model") || lower.includes("client");
    const hasExplicitEthnicity = lower.includes("japonais") || lower.includes("européen") || lower.includes("asiatique") || lower.includes("caucasian") || lower.includes("white") || lower.includes("asian") || lower.includes("chinois");
    
    if (hasHuman && !hasExplicitEthnicity) {
      prompt += "Featuring a handsome, elegant African model with warm smiling expression, realistic skin pores, natural hair texture, and perfectly formed hands. ";
    }

    if (userPrompt) prompt += `\n\nUser Brief: ${userPrompt}. `;
    if (visionAudit) prompt += `\n\nExact Hero Product Visual Specs: ${visionAudit}. `;
    
    prompt += `\n\nArt Direction: ${style || "Studio Commercial Premium"}. Photographed on 85mm f/1.4 lens, softbox studio lights, shallow depth of field, crisp focus, photorealistic 8k, natural lighting, professional ad visual layout with text elements in French if applicable.`;
    return prompt;
  }
}

