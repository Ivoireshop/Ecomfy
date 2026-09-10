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

export interface EcomfyCommandDef {
  command: string;
  category: string;
  description: string;
  priority: number;
  conflicts_with?: string[];
  instructions: {
    creative_mode?: string;
    advertising_goal?: string;
    quality_level?: string;
    lighting?: string;
    environment?: string;
    camera?: string;
    human_style?: string;
    product_staging?: string;
    composition?: string;
    notes?: string;
  };
}

// Embedded Command Registry for Edge Runtime
export const EMBEDDED_COMMANDS: EcomfyCommandDef[] = [
  {
    command: "/UGCmodel",
    category: "UGC",
    description: "Visuel UGC haut de gamme, modèle soigné, éclairage propre et esthétique commercial.",
    priority: 85,
    conflicts_with: ["/UGCnaturel"],
    instructions: {
      creative_mode: "Controlled High-End Commercial UGC",
      human_style: "Polished, stylish African creator/model with natural warm smile, elegant casual attire, perfectly groomed, engaging holding posture",
      lighting: "Soft diffusion studio-quality ambient light, natural eye catchlights",
      environment: "Sleek modern sunlit interior or upscale lifestyle location",
      camera: "85mm f/1.8 lens, sharp focus on face and product, soft background bokeh",
      composition: "Professional commercial framing, hero model presenting product with high aesthetic appeal",
      quality_level: "Premium commercial UGC, photorealistic"
    }
  },
  {
    command: "/UGCnaturel",
    category: "UGC",
    description: "Rendu 100% authentique, lumière naturelle, atmosphère smartphone et vie quotidienne.",
    priority: 85,
    conflicts_with: ["/UGCmodel", "/Luxury", "/Studio"],
    instructions: {
      creative_mode: "Authentic Spontaneous Everyday Organic UGC",
      human_style: "Relatable, authentic everyday African individual showing spontaneous expression, minimal makeup/natural look, comfortable home attire",
      lighting: "Natural daylight from window, organic soft shadows",
      environment: "Cozy realistic apartment, kitchen counter, or casual everyday setting",
      camera: "Mobile smartphone camera aesthetic (iPhone 15 Pro photo vibe), natural depth",
      composition: "Organic casual framing, non-staged appearance, product held naturally in hand",
      quality_level: "Ultra-authentic organic social media content"
    }
  },
  {
    command: "/UGCcreator",
    category: "UGC",
    description: "Créateur captivant présentant le produit face caméra avec énergie.",
    priority: 80,
    instructions: {
      creative_mode: "Content Creator UGC Presentation",
      human_style: "Dynamic charismatic African digital creator pointing or gesturing excitedly at the hero product",
      lighting: "Ring light or soft daylight glow",
      environment: "Content creator studio set, modern aesthetic room with warm ambient glow",
      composition: "Direct eye contact, active product demonstration, mobile-optimized framing"
    }
  },
  {
    command: "/UGCtestimonial",
    category: "UGC",
    description: "Client très satisfait recommandant chaleureusement le produit avec le produit en main.",
    priority: 80,
    instructions: {
      creative_mode: "Delighted Customer Testimonial",
      human_style: "Happy, beaming African customer holding up the product with genuine emotion and trust",
      environment: "Authentic living room or bedroom vanity mirror background",
      composition: "Warm personal angle, medium close-up shot emphasizing delight and product clarity"
    }
  },
  {
    command: "/Ads",
    category: "Publicité",
    description: "Composition publicitaire percutante orientée conversion.",
    priority: 75,
    instructions: {
      advertising_goal: "High-Conversion E-commerce Ad Visual",
      composition: "Strong visual hierarchy, prominent hero product, bold contrast, mobile-first design"
    }
  },
  {
    command: "/FacebookAds",
    category: "Publicité",
    description: "Format publicitaire optimisé pour le fil d'actualité Facebook.",
    priority: 80,
    instructions: {
      advertising_goal: "Facebook Feed & Stories Performance Advertising",
      composition: "High contrast stopping power, eye-catching color pop, hero product centered in upper two-thirds, optimized for mobile feed scrolling"
    }
  },
  {
    command: "/InstagramAds",
    category: "Publicité",
    description: "Visuel élégant et vibrant adapté au fil Instagram.",
    priority: 80,
    instructions: {
      advertising_goal: "Instagram High-Engagement Aesthetic Visual",
      composition: "Trendy modern framing, harmonious color palette, high aesthetic refinement"
    }
  },
  {
    command: "/TikTokAds",
    category: "Publicité",
    description: "Visuel dynamique et captivant pensé pour TikTok.",
    priority: 80,
    instructions: {
      advertising_goal: "TikTok Native High-Engagement Ad",
      composition: "Vertical portrait orientation (9:16 default), vibrant dynamic energy, bold focal point"
    }
  },
  {
    command: "/WhatsAppAds",
    category: "Publicité",
    description: "Visuel net, clair et ultra-lisible pour partage direct.",
    priority: 75,
    instructions: {
      advertising_goal: "WhatsApp Direct Marketing & Catalog Visual",
      composition: "Clean background, razor-sharp product details, maximum readability"
    }
  },
  {
    command: "/Product",
    category: "Produit",
    description: "Focus absolu sur le produit de référence.",
    priority: 70,
    instructions: {
      creative_mode: "Ultra-Sharp Commercial Studio Product Photography",
      product_staging: "Hero product isolated on a clean elegant surface with razor-sharp label typography",
      lighting: "Softbox studio lighting with subtle rim highlight"
    }
  },
  {
    command: "/ProductHero",
    category: "Produit",
    description: "Mise en scène spectaculaire avec piédestal et éclairage dramatique.",
    priority: 75,
    instructions: {
      creative_mode: "Dramatic Hero Product Showcase",
      product_staging: "Hero product elevated on a polished marble or dark satin pedestal, soft dramatic spotlight"
    }
  },
  {
    command: "/Catalogue",
    category: "Produit",
    description: "Rendu catalogue professionnel sur fond neutre studio.",
    priority: 70,
    instructions: {
      creative_mode: "Clean Neutral Catalog Product Shot",
      product_staging: "Product centered on a seamless light grey/off-white studio gradient backdrop"
    }
  },
  {
    command: "/Ecommerce",
    category: "Produit",
    description: "Visuel e-commerce optimisé pour la conversion.",
    priority: 70,
    instructions: {
      creative_mode: "High-Converting E-commerce Product Presentation",
      product_staging: "Product staged with contextual elements (ingredients, packaging box, quality seal)"
    }
  },
  {
    command: "/Premium",
    category: "Style Visuel",
    description: "Finition commercial haut de gamme.",
    priority: 65,
    instructions: {
      quality_level: "Masterpiece Commercial Quality",
      lighting: "Flawless studio lighting with subtle specular highlights"
    }
  },
  {
    command: "/Cinematic",
    category: "Style Visuel",
    description: "Éclairage dramatique inspiré du cinéma.",
    priority: 65,
    instructions: {
      lighting: "Cinematic moody lighting, dramatic volumetric light shafts, warm/cool teal & orange tone contrast",
      camera: "Anamorphic lens rendering, shallow depth of field"
    }
  },
  {
    command: "/Luxury",
    category: "Style Visuel",
    description: "Accents dorés, marbre, soie et atmosphère exclusive.",
    priority: 65,
    conflicts_with: ["/UGCnaturel"],
    instructions: {
      environment: "Opulent luxury setting with polished gold, white marble, dark walnut wood, or silk textures",
      quality_level: "High-end luxury brand aesthetic"
    }
  },
  {
    command: "/Natural",
    category: "Style Visuel",
    description: "Lumière du soleil et feuillages doux.",
    priority: 60,
    instructions: {
      lighting: "Soft warm morning sunlight filtering through leaves, gentle natural shadows",
      environment: "Organic natural backdrop with botanical green accents"
    }
  },
  {
    command: "/Minimal",
    category: "Style Visuel",
    description: "Composition épurée et espace négatif élégant.",
    priority: 60,
    instructions: {
      composition: "Clean minimal layout, generous negative space, sophisticated balance"
    }
  },
  {
    command: "/Studio",
    category: "Style Visuel",
    description: "Éclairage studio maître.",
    priority: 60,
    instructions: {
      lighting: "Controlled dual-softbox studio lighting with optical snoot highlight"
    }
  },
  {
    command: "/Lifestyle",
    category: "Style Visuel",
    description: "Mise en scène lifestyle chic.",
    priority: 65,
    instructions: {
      environment: "Aspirational contemporary African home, luxury bathroom vanity, or sleek modern office"
    }
  },
  {
    command: "/Storytelling",
    category: "Storytelling",
    description: "Raconte une histoire visuelle forte.",
    priority: 70,
    instructions: {
      creative_mode: "Emotional Brand Storytelling",
      human_style: "Expressive model conveying authentic emotions of anticipation, joy, or relief"
    }
  },
  {
    command: "/Testimonial",
    category: "Storytelling",
    description: "Focus réassurance client.",
    priority: 70,
    instructions: {
      creative_mode: "Authentic Client Trust & Review",
      human_style: "Warm approachable African model smiling with direct eye contact"
    }
  },
  {
    command: "/BeforeAfter",
    category: "Storytelling",
    description: "Mise en scène Avant / Après.",
    priority: 75,
    instructions: {
      creative_mode: "Side-by-Side Problem vs. Radiant Solution Transformation",
      composition: "Split-screen or dual composition showing initial concern on the left and glowing radiant results on the right"
    }
  },
  {
    command: "/Promo",
    category: "Storytelling",
    description: "Visuel promo et urgence.",
    priority: 75,
    instructions: {
      advertising_goal: "Urgent Promotional Flash Offer",
      composition: "Vibrant high-contrast banner overlays, promotional badges ('OFFRE SPÉCIALE', 'STOCK LIMITÉ')"
    }
  },
  {
    command: "/Offer",
    category: "Storytelling",
    description: "Mise en avant du packaging et bonus.",
    priority: 70,
    instructions: {
      advertising_goal: "Special Package Offer Bundle",
      product_staging: "Hero product staged along with its luxurious gift box or bonus items"
    }
  },
  {
    command: "/ProblemSolution",
    category: "Storytelling",
    description: "Problème → Solution.",
    priority: 75,
    instructions: {
      creative_mode: "Problem-to-Solution Transformation Journey",
      composition: "Visual contrast showing relief and satisfaction provided by the hero product"
    }
  }
];

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
   * Helper to parse slash commands inside prompt string
   */
  private static parseSlashCommands(inputPrompt: string) {
    if (!inputPrompt) return { cleanPrompt: "", activeCommands: [], briefDetails: null };

    const slashRegex = /(?:^|\s)(\/([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?)(?=\s|$|[.,!?;])/g;
    let match: RegExpExecArray | null;
    const foundCmds: { def: EcomfyCommandDef; raw: string; param?: string }[] = [];
    const matchedTokens: string[] = [];

    while ((match = slashRegex.exec(inputPrompt)) !== null) {
      const fullToken = match[1];
      const cmdName = match[2];
      const param = match[3];
      const baseToken = `/${cmdName}`;

      matchedTokens.push(fullToken);

      const foundDef = EMBEDDED_COMMANDS.find(c => c.command.toLowerCase() === baseToken.toLowerCase());
      if (foundDef) {
        foundCmds.push({ def: foundDef, raw: fullToken, param });
      }
    }

    if (foundCmds.length === 0) {
      return { cleanPrompt: inputPrompt, activeCommands: [], briefDetails: null };
    }

    // Strip commands from clean prompt
    let cleanPrompt = inputPrompt;
    for (const token of matchedTokens) {
      const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      cleanPrompt = cleanPrompt.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$|[.,!?;])`, "g"), " ");
    }
    cleanPrompt = cleanPrompt.replace(/\s+/g, " ").trim();

    // Sort by priority
    foundCmds.sort((a, b) => b.def.priority - a.def.priority);

    // Build Brief
    let creativeMode = "";
    let advertisingGoal = "";
    let qualityLevel = "";
    let lighting = "";
    let environment = "";
    let camera = "";
    let composition = "";
    let humanStyle = "";
    let productStaging = "";
    let paramGender: string | undefined;
    let paramAge: string | undefined;
    const commandList: string[] = [];
    const excluded = new Set<string>();

    for (const item of foundCmds) {
      if (excluded.has(item.def.command)) continue;
      if (item.def.conflicts_with) {
        for (const conf of item.def.conflicts_with) excluded.add(conf);
      }

      commandList.push(item.raw);

      if (item.param) {
        if (["woman", "man", "couple"].includes(item.param)) paramGender = item.param;
        if (["young", "adult", "senior"].includes(item.param)) paramAge = item.param;
      }

      const inst = item.def.instructions;
      if (!creativeMode && inst.creative_mode) creativeMode = inst.creative_mode;
      if (!advertisingGoal && inst.advertising_goal) advertisingGoal = inst.advertising_goal;
      if (!qualityLevel && inst.quality_level) qualityLevel = inst.quality_level;
      if (!lighting && inst.lighting) lighting = inst.lighting;
      if (!environment && inst.environment) environment = inst.environment;
      if (!camera && inst.camera) camera = inst.camera;
      if (!composition && inst.composition) composition = inst.composition;
      if (!humanStyle && inst.human_style) humanStyle = inst.human_style;
      if (!productStaging && inst.product_staging) productStaging = inst.product_staging;
    }

    return {
      cleanPrompt,
      activeCommands: commandList,
      briefDetails: {
        creativeMode,
        advertisingGoal,
        qualityLevel,
        lighting,
        environment,
        camera,
        composition,
        humanStyle,
        productStaging,
        paramGender,
        paramAge
      }
    };
  }

  /**
   * Transforms raw user input + vision audit into an ultra-expanded, professional commercial ad prompt
   */
  public static async generateProfessionalPrompt(input: PromptEngineInput): Promise<string> {
    const apiKey = getOpenAiApiKey();
    const rawUserPrompt = (input.userPrompt || "").trim();
    const modeKey = input.mode || "publicite-produit";
    const modeInfo = ECOMMERCE_MODES[modeKey] || ECOMMERCE_MODES["publicite-produit"];
    const visionAudit = input.sourceImageAnalysis || "";

    // Parse slash commands if present
    const parsedCmds = this.parseSlashCommands(rawUserPrompt);
    const cleanUserPrompt = parsedCmds.cleanPrompt || rawUserPrompt;

    if (parsedCmds.activeCommands.length > 0) {
      console.log(`[PromptEngine SlashCommand Engine] Active Slash Commands: ${parsedCmds.activeCommands.join(", ")}`);
    }

    // If no OpenAI API Key available, fallback to structured template construction
    if (!apiKey) {
      return this.buildFallbackPrompt(cleanUserPrompt, modeInfo, visionAudit, input.style, parsedCmds.briefDetails);
    }

    let slashBriefDirective = "";
    if (parsedCmds.briefDetails && parsedCmds.activeCommands.length > 0) {
      const b = parsedCmds.briefDetails;
      slashBriefDirective = `
[ECOMFY SLASH COMMAND CREATIVE BRIEF DIRECTIVE]:
Active Creative Commands: ${parsedCmds.activeCommands.join(", ")}
${b.creativeMode ? `- Creative Mode Direction: ${b.creativeMode}` : ""}
${b.advertisingGoal ? `- Advertising Context & Objective: ${b.advertisingGoal}` : ""}
${b.qualityLevel ? `- Target Visual Quality Level: ${b.qualityLevel}` : ""}
${b.humanStyle ? `- Human Subject Style (AFRICAN DEFAULT): ${b.humanStyle}${b.paramGender ? ` (Gender: ${b.paramGender})` : ""}${b.paramAge ? ` (Age: ${b.paramAge})` : ""}` : ""}
${b.lighting ? `- Lighting Direction: ${b.lighting}` : ""}
${b.environment ? `- Environmental Scene Setting: ${b.environment}` : ""}
${b.camera ? `- Camera & Lens Setup: ${b.camera}` : ""}
${b.composition ? `- Composition & Framing Rules: ${b.composition}` : ""}
${b.productStaging ? `- Hero Product Staging: ${b.productStaging}` : ""}
- Strict Rule: Incorporate all the above creative brief directives seamlessly into ONE single unified art direction.`;
    }

    const systemInstructions = `You are Ecomfy PromptEngine, an elite Art Director, Commercial Photographer, and Senior Advertising Designer specializing in high-conversion e-commerce visuals.

CORE OPERATIONAL PHILOSOPHY:
"The user provides the raw idea. Ecomfy provides creative expertise and flawless execution."
Even if the user prompt is extremely short (e.g. "Un homme avec ce produit" or "/UGCmodel /FacebookAds"), YOU MUST ENRICH IT AUTOMATICALLY into a complete, professional, studio-grade creative brief.

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
3. Slash Command Creative Brief Directive (if provided).
4. Aspect ratio and composition layout.
5. French language rule for ad text.
6. African ethnicity default rule for human models.
7. Ecomfy Art Direction & Photorealism enrichment.

Structure your final prompt in clear, vivid English containing:
- Full scene composition & environment
- Model description (African default unless specified otherwise), attire, emotion, and interaction
- Hero product placement & fidelity
- Studio lighting, camera gear (85mm f/1.4), depth of field, and photorealistic textures
- French text callouts & badges (if commercial ad visual mode)

Output ONLY the expanded prompt in plain English, with no meta-commentary.`;

    const userContent = `[USER BRIEF]:
${cleanUserPrompt || "Visuel publicitaire professionnel pour e-commerce"}
${slashBriefDirective}

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

    return this.buildFallbackPrompt(cleanUserPrompt, modeInfo, visionAudit, input.style, parsedCmds.briefDetails);
  }

  private static buildFallbackPrompt(
    userPrompt: string,
    modeInfo: { name: string; compositionRules: string },
    visionAudit: string,
    style?: string,
    slashBrief?: any
  ): string {
    let prompt = `Ultra-photorealistic commercial e-commerce advertising visual. ${modeInfo.compositionRules} `;
    
    if (slashBrief) {
      if (slashBrief.creativeMode) prompt += `Creative Mode: ${slashBrief.creativeMode}. `;
      if (slashBrief.advertisingGoal) prompt += `Ad Objective: ${slashBrief.advertisingGoal}. `;
      if (slashBrief.humanStyle) prompt += `Model Style: ${slashBrief.humanStyle}. `;
      if (slashBrief.lighting) prompt += `Lighting: ${slashBrief.lighting}. `;
      if (slashBrief.environment) prompt += `Environment: ${slashBrief.environment}. `;
    }

    // Default to African model if prompt implies human but no ethnicity specified
    const lower = userPrompt.toLowerCase();
    const hasHuman = lower.includes("homme") || lower.includes("femme") || lower.includes("personne") || lower.includes("man") || lower.includes("woman") || lower.includes("model") || lower.includes("client");
    const hasExplicitEthnicity = lower.includes("japonais") || lower.includes("européen") || lower.includes("asiatique") || lower.includes("caucasian") || lower.includes("white") || lower.includes("asian") || lower.includes("chinois");
    
    if (hasHuman && !hasExplicitEthnicity && !slashBrief?.humanStyle) {
      prompt += "Featuring a handsome, elegant African model with warm smiling expression, realistic skin pores, natural hair texture, and perfectly formed hands. ";
    }

    if (userPrompt) prompt += `\n\nUser Brief: ${userPrompt}. `;
    if (visionAudit) prompt += `\n\nExact Hero Product Visual Specs: ${visionAudit}. `;
    
    prompt += `\n\nArt Direction: ${style || "Studio Commercial Premium"}. Photographed on 85mm f/1.4 lens, softbox studio lights, shallow depth of field, crisp focus, photorealistic 8k, natural lighting, professional ad visual layout with text elements in French if applicable.`;
    return prompt;
  }
}
