export interface CommandParameter {
  name: string;
  type: "string" | "enum";
  options?: string[];
  description: string;
}

export interface EcomfyCommand {
  command: string;
  name: string;
  category: "UGC" | "Publicité" | "Produit" | "Style Visuel" | "Storytelling";
  description: string;
  priority: number; // Higher number = higher priority in conflict resolution
  enabled: boolean;
  aliases: string[];
  compatible_with?: string[];
  conflicts_with?: string[];
  parameters?: CommandParameter[];
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

export const ECOMFY_AI_COMMANDS: EcomfyCommand[] = [
  // ============================================================
  // A. MODES UGC
  // ============================================================
  {
    command: "/UGCmodel",
    name: "UGC Model Commercial",
    category: "UGC",
    description: "Visuel UGC haut de gamme, modèle soigné, éclairage propre et esthétique commercial.",
    priority: 85,
    enabled: true,
    aliases: ["/ugcmodel", "/ugc-model", "/ugcpro"],
    conflicts_with: ["/UGCnaturel"],
    parameters: [
      { name: "gender", type: "enum", options: ["woman", "man", "couple"], description: "Genre du modèle" },
      { name: "age", type: "enum", options: ["young", "adult", "senior"], description: "Tranche d'âge" }
    ],
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
    name: "UGC Spontané & Organique",
    category: "UGC",
    description: "Rendu 100% authentique, lumière naturelle, atmosphère smartphone et vie quotidienne.",
    priority: 85,
    enabled: true,
    aliases: ["/ugcnaturel", "/ugcorganic", "/ugc-real"],
    conflicts_with: ["/UGCmodel", "/Luxury", "/Studio"],
    parameters: [
      { name: "gender", type: "enum", options: ["woman", "man", "couple"], description: "Genre du modèle" }
    ],
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
    name: "Créateur de Contenu UGC",
    category: "UGC",
    description: "Créateur captivant présentant le produit face caméra avec énergie et sympathie.",
    priority: 80,
    enabled: true,
    aliases: ["/ugccreator", "/creator"],
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
    name: "Témoignage UGC Client",
    category: "UGC",
    description: "Client très satisfait recommandant chaleureusement le produit avec le produit en main.",
    priority: 80,
    enabled: true,
    aliases: ["/ugctestimonial", "/customer-review"],
    instructions: {
      creative_mode: "Delighted Customer Testimonial",
      human_style: "Happy, beaming African customer holding up the product with genuine emotion and trust",
      environment: "Authentic living room or bedroom vanity mirror background",
      composition: "Warm personal angle, medium close-up shot emphasizing delight and product clarity"
    }
  },

  // ============================================================
  // B. PUBLICITÉ
  // ============================================================
  {
    command: "/Ads",
    name: "Publicité Générale High-Conversion",
    category: "Publicité",
    description: "Composition publicitaire percutante orientée conversion avec hiérarchie claire.",
    priority: 75,
    enabled: true,
    aliases: ["/ads", "/publicite", "/ad"],
    instructions: {
      advertising_goal: "High-Conversion E-commerce Ad Visual",
      composition: "Strong visual hierarchy, prominent hero product, bold contrast, mobile-first design",
      notes: "Include French advertising callouts if text is enabled"
    }
  },
  {
    command: "/FacebookAds",
    name: "Publicité Facebook Feed & Stories",
    category: "Publicité",
    description: "Format publicitaire optimisé pour susciter le clic sur le fil d'actualité Facebook.",
    priority: 80,
    enabled: true,
    aliases: ["/facebookads", "/fbads", "/facebook"],
    parameters: [
      { name: "goal", type: "enum", options: ["conversion", "retargeting", "brand"], description: "Objectif pub" }
    ],
    instructions: {
      advertising_goal: "Facebook Feed & Stories Performance Advertising",
      composition: "High contrast stopping power, eye-catching color pop, hero product centered in upper two-thirds, optimized for mobile feed scrolling",
      notes: "Designed for immediate comprehension within 1.5 seconds on Facebook mobile app"
    }
  },
  {
    command: "/InstagramAds",
    name: "Publicité Instagram Aesthetic",
    category: "Publicité",
    description: "Visuel élégant et vibrant parfaitement adapté au style visuel d'Instagram.",
    priority: 80,
    enabled: true,
    aliases: ["/instagramads", "/igads", "/instagram"],
    instructions: {
      advertising_goal: "Instagram High-Engagement Aesthetic Visual",
      composition: "Trendy modern framing, harmonious color palette, high aesthetic refinement, ideal for 4:5 and 9:16 aspect ratios",
      lighting: "Soft flattering illumination with clean background contrast"
    }
  },
  {
    command: "/TikTokAds",
    name: "Publicité TikTok Dynamique",
    category: "Publicité",
    description: "Visuel dynamique et captivant pensé pour les utilisateurs TikTok.",
    priority: 80,
    enabled: true,
    aliases: ["/tiktokads", "/tiktok"],
    instructions: {
      advertising_goal: "TikTok Native High-Engagement Ad",
      composition: "Vertical portrait orientation (9:16 default), vibrant dynamic energy, bold focal point, immediate hook visual",
      human_style: "Expressive youthful energy"
    }
  },
  {
    command: "/WhatsAppAds",
    name: "Publicité WhatsApp & Catalogue",
    category: "Publicité",
    description: "Visuel net, clair et ultra-lisible adapté au partage direct sur WhatsApp.",
    priority: 75,
    enabled: true,
    aliases: ["/whatsappads", "/whatsapp"],
    instructions: {
      advertising_goal: "WhatsApp Direct Marketing & Catalog Visual",
      composition: "Clean background, razor-sharp product details, maximum readability, high trust visual elements"
    }
  },

  // ============================================================
  // C. PRODUIT / E-COMMERCE
  // ============================================================
  {
    command: "/Product",
    name: "Photo Produit Studio",
    category: "Produit",
    description: "Focus absolu sur le produit de référence avec éclairage et détails studio crisp.",
    priority: 70,
    enabled: true,
    aliases: ["/product", "/photo-produit"],
    instructions: {
      creative_mode: "Ultra-Sharp Commercial Studio Product Photography",
      product_staging: "Hero product isolated on a clean elegant surface with razor-sharp label typography, zero clutter",
      lighting: "Softbox studio lighting with subtle rim highlight",
      camera: "100mm macro studio lens, crisp focus on packaging textures"
    }
  },
  {
    command: "/ProductHero",
    name: "Produit Vedette (Hero Shot)",
    category: "Produit",
    description: "Mise en scène spectaculaire avec piédestal, éclairage dramatique et reflets.",
    priority: 75,
    enabled: true,
    aliases: ["/producthero", "/hero"],
    instructions: {
      creative_mode: "Dramatic Hero Product Showcase",
      product_staging: "Hero product elevated on a polished marble or dark satin pedestal, soft dramatic spotlight",
      lighting: "High-end commercial key light with elegant backlight and subtle glass/plastic reflections"
    }
  },
  {
    command: "/Catalogue",
    name: "Fiche Catalogue Épurée",
    category: "Produit",
    description: "Rendu catalogue professionnel sur fond neutre studio sans distraction.",
    priority: 70,
    enabled: true,
    aliases: ["/catalogue", "/catalog"],
    instructions: {
      creative_mode: "Clean Neutral Catalog Product Shot",
      product_staging: "Product centered on a seamless light grey/off-white studio gradient backdrop",
      lighting: "Uniform studio soft light, subtle natural ground shadow"
    }
  },
  {
    command: "/Ecommerce",
    name: "Visuel E-commerce Conversion",
    category: "Produit",
    description: "Visuel e-commerce optimisé mettant en avant les caractéristiques clé du produit.",
    priority: 70,
    enabled: true,
    aliases: ["/ecommerce", "/shop"],
    instructions: {
      creative_mode: "High-Converting E-commerce Product Presentation",
      product_staging: "Product staged with contextual elements (ingredients, packaging box, quality seal)",
      notes: "Optimized for product detail page (PDP) conversion"
    }
  },

  // ============================================================
  // D. STYLE VISUEL
  // ============================================================
  {
    command: "/Premium",
    name: "Rendu Commercial Premium",
    category: "Style Visuel",
    description: "Finition haut de gamme, étalonnage des couleurs luxueux et détails immaculés.",
    priority: 65,
    enabled: true,
    aliases: ["/premium", "/pro"],
    instructions: {
      quality_level: "Masterpiece Commercial Quality",
      lighting: "Flawless studio lighting with subtle specular highlights",
      camera: "Hasselblad H6D-100c medium format camera rendering"
    }
  },
  {
    command: "/Cinematic",
    name: "Ambiance Cinématographique",
    category: "Style Visuel",
    description: "Éclairage dramatique inspiré du cinéma, profondeur de champ et étalonnage riche.",
    priority: 65,
    enabled: true,
    aliases: ["/cinematic", "/cinema"],
    instructions: {
      lighting: "Cinematic moody lighting, dramatic volumetric light shafts, warm/cool teal & orange tone contrast",
      camera: "Anamorphic lens rendering, shallow depth of field, subtle film grain"
    }
  },
  {
    command: "/Luxury",
    name: "Style Luxe & Élégance",
    category: "Style Visuel",
    description: "Accents dorés, marbre, soie et atmosphère exclusive pour marques haut de gamme.",
    priority: 65,
    enabled: true,
    aliases: ["/luxury", "/luxe"],
    conflicts_with: ["/UGCnaturel"],
    instructions: {
      environment: "Opulent luxury setting with polished gold, white marble, dark walnut wood, or silk textures",
      lighting: "Warm rich golden hour glow or sophisticated dramatic spotlight",
      quality_level: "High-end luxury brand aesthetic"
    }
  },
  {
    command: "/Natural",
    name: "Lumière & Ambiance Naturelle",
    category: "Style Visuel",
    description: "Lumière du soleil, textures organiques, feuillages doux et atmosphère fraîche.",
    priority: 60,
    enabled: true,
    aliases: ["/natural", "/naturel"],
    instructions: {
      lighting: "Soft warm morning sunlight filtering through leaves, gentle natural shadows",
      environment: "Organic natural backdrop with botanical green accents, linen, or raw wood"
    }
  },
  {
    command: "/Minimal",
    name: "Design Minimaliste Clean",
    category: "Style Visuel",
    description: "Composition épurée, espace négatif élégant et contraste équilibré.",
    priority: 60,
    enabled: true,
    aliases: ["/minimal", "/minimalist"],
    instructions: {
      composition: "Clean minimal layout, generous negative space, sophisticated mathematical balance",
      environment: "Monochromatic micro-cement, smooth pastel clay, or minimalist architectural geometry"
    }
  },
  {
    command: "/Studio",
    name: "Éclairage Studio Softbox",
    category: "Style Visuel",
    description: "Eclairage maître contrôlé en studio avec boîte à lumière et réflecteurs.",
    priority: 60,
    enabled: true,
    aliases: ["/studio"],
    instructions: {
      lighting: "Controlled dual-softbox studio lighting with optical snoot highlight and white fill card"
    }
  },
  {
    command: "/Lifestyle",
    name: "Mise en Scène Lifestyle",
    category: "Style Visuel",
    description: "Produit intégré dans un environnement de vie chic et aspirationnel.",
    priority: 65,
    enabled: true,
    aliases: ["/lifestyle"],
    instructions: {
      environment: "Aspirational contemporary African home, luxury bathroom vanity, or sleek modern office",
      composition: "Contextual lifestyle setting showing natural interaction with everyday surroundings"
    }
  },

  // ============================================================
  // E. CRÉATIVITÉ / STORYTELLING
  // ============================================================
  {
    command: "/Storytelling",
    name: "Narratif & Émotion",
    category: "Storytelling",
    description: "Raconte une histoire visuelle forte qui suscite l'émotion et la connexion de marque.",
    priority: 70,
    enabled: true,
    aliases: ["/storytelling", "/story"],
    instructions: {
      creative_mode: "Emotional Brand Storytelling",
      human_style: "Expressive model conveying authentic emotions of anticipation, joy, or relief",
      composition: "Cinematic visual narrative layout that communicates transformation and value"
    }
  },
  {
    command: "/Testimonial",
    name: "Focus Témoignage Client",
    category: "Storytelling",
    description: "Confiance et réassurance maximale grâce à une posture de recommandation naturelle.",
    priority: 70,
    enabled: true,
    aliases: ["/testimonial", "/review"],
    instructions: {
      creative_mode: "Authentic Client Trust & Review",
      human_style: "Warm approachable African model smiling with direct eye contact, holding product reassuringly"
    }
  },
  {
    command: "/BeforeAfter",
    name: "Mise en Scène Avant / Après",
    category: "Storytelling",
    description: "Comparaison visuelle côte à côte de la transformation apportée par le produit.",
    priority: 75,
    enabled: true,
    aliases: ["/beforeafter", "/avant-apres", "/transformation"],
    instructions: {
      creative_mode: "Side-by-Side Problem vs. Radiant Solution Transformation",
      composition: "Split-screen or dual composition showing initial concern on the left and glowing radiant results with product on the right"
    }
  },
  {
    command: "/Promo",
    name: "Offre Promotionnelle & Urgence",
    category: "Storytelling",
    description: "Visuel orienté vente flash, promotion et opportunité à saisir immédiatement.",
    priority: 75,
    enabled: true,
    aliases: ["/promo", "/promotion", "/sale"],
    instructions: {
      advertising_goal: "Urgent Promotional Flash Offer",
      composition: "Vibrant high-contrast banner overlays, promotional badges ('OFFRE SPÉCIALE', 'STOCK LIMITÉ'), high visual impact"
    }
  },
  {
    command: "/Offer",
    name: "Mise en Avant de l'Offre",
    category: "Storytelling",
    description: "Mise en scène valorisante du produit avec packaging et accessoires offerts.",
    priority: 70,
    enabled: true,
    aliases: ["/offer", "/bundle"],
    instructions: {
      advertising_goal: "Special Package Offer Bundle",
      product_staging: "Hero product staged along with its luxurious gift box or bonus items"
    }
  },
  {
    command: "/ProblemSolution",
    name: "Problème → Solution",
    category: "Storytelling",
    description: "Illustration claire du besoin ou problème du client résolu par le produit.",
    priority: 75,
    enabled: true,
    aliases: ["/problemsolution", "/solution"],
    instructions: {
      creative_mode: "Problem-to-Solution Transformation Journey",
      composition: "Visual contrast showing relief and satisfaction provided by the hero product"
    }
  }
];

export function findCommandByToken(token: string): EcomfyCommand | undefined {
  const cleanToken = token.trim().toLowerCase();
  // Strip optional parameters (e.g. /UGCmodel:woman -> /UGCmodel)
  const baseToken = cleanToken.split(":")[0];

  return ECOMFY_AI_COMMANDS.find(cmd => 
    cmd.command.toLowerCase() === baseToken ||
    cmd.aliases.some(alias => alias.toLowerCase() === baseToken)
  );
}
