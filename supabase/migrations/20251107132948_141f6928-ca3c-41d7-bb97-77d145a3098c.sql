-- Create ad_templates table for predefined advertising templates
CREATE TABLE public.ad_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  style_preset TEXT NOT NULL,
  animation_preset TEXT NOT NULL,
  color_palette JSONB DEFAULT '{"primary": "#2563eb", "secondary": "#7c3aed", "accent": "#f59e0b"}'::jsonb,
  prompt_template TEXT NOT NULL,
  animation_prompt_template TEXT NOT NULL,
  recommended_duration INTEGER DEFAULT 10,
  recommended_platforms TEXT[] DEFAULT ARRAY['Facebook', 'Instagram', 'TikTok'],
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_ad_templates_category ON public.ad_templates(category);
CREATE INDEX idx_ad_templates_is_active ON public.ad_templates(is_active);

-- Enable RLS
ALTER TABLE public.ad_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active templates"
  ON public.ad_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Founders can manage templates"
  ON public.ad_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('founder', 'co_founder')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('founder', 'co_founder')
    )
  );

-- Insert predefined templates
INSERT INTO public.ad_templates (name, category, description, style_preset, animation_preset, color_palette, prompt_template, animation_prompt_template, recommended_duration, recommended_platforms, created_by) VALUES
(
  'E-commerce Dynamique',
  'e-commerce',
  'Template optimisé pour boutiques en ligne et produits physiques',
  'modern-ecommerce',
  'product-showcase',
  '{"primary": "#ff6b6b", "secondary": "#4ecdc4", "accent": "#ffe66d"}',
  'Visuel publicitaire e-commerce professionnel pour {platform} : Produit {productName} - {niche}. Mise en scène produit sur fond {style} avec éclairage studio. Couleurs vives et attrayantes. Texte promotionnel visible : "{description}". Prix "{price}" mis en avant. Style moderne e-commerce avec call-to-action clair.',
  'Animation e-commerce dynamique : zoom produit progressif, rotation 360° subtile, apparition prix avec effet lumineux, transitions fluides. Mouvements caméra professionnels pour mettre en valeur {productName}. Effets de brillance et de profondeur. Animation engageante pour conversion maximale.',
  10,
  ARRAY['Facebook', 'Instagram', 'TikTok'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Immobilier Premium',
  'immobilier',
  'Template pour biens immobiliers et propriétés de luxe',
  'luxury-real-estate',
  'property-tour',
  '{"primary": "#2c3e50", "secondary": "#c0a062", "accent": "#ecf0f1"}',
  'Visuel publicitaire immobilier haut de gamme pour {platform} : Bien immobilier {productName} - {niche}. Architecture moderne et élégante, vue extérieure impressionnante avec éclairage naturel doré. Ambiance luxueuse et professionnelle. Texte : "{description}". Prix "{price}" discret mais visible. Style sophistiqué immobilier avec photos de qualité magazine.',
  'Animation immobilier cinématographique : travelling aérien smooth, zoom avant majestueux vers la propriété, transitions élégantes entre vues. Mouvements caméra professionnels type documentaire immobilier. Effets de parallaxe subtils, éclairage changeant du jour au crépuscule. Animation prestigieuse pour vente immobilière premium.',
  15,
  ARRAY['Facebook', 'Instagram', 'LinkedIn'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Beauté & Cosmétiques',
  'beaute',
  'Template pour produits de beauté et cosmétiques',
  'beauty-glow',
  'beauty-reveal',
  '{"primary": "#ff69b4", "secondary": "#ffd700", "accent": "#ffb6c1"}',
  'Visuel publicitaire beauté pour {platform} : Produit cosmétique {productName} - {niche}. Packaging élégant sur fond dégradé pastel lumineux. Effets de brillance et de glow. Ambiance douce et féminine. Texte : "{description}". Prix "{price}" élégant. Style beauté Instagram avec éclairage flattering et couleurs douces.',
  'Animation beauté glamour : apparition magique du produit avec particules dorées, rotation lente et élégante, effets de lumière scintillante. Zoom sur texture et détails du produit. Transitions douces et féminines. Animation type publicité L''Oréal/Dior pour impact beauté maximal.',
  10,
  ARRAY['Instagram', 'TikTok', 'Pinterest'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Food & Restaurant',
  'alimentation',
  'Template pour restaurants, plats et produits alimentaires',
  'food-appetizing',
  'food-reveal',
  '{"primary": "#ff6347", "secondary": "#ffa500", "accent": "#32cd32"}',
  'Visuel publicitaire culinaire appétissant pour {platform} : Plat/Produit {productName} - {niche}. Présentation gastronomique professionnelle avec éclairage chaud. Couleurs vibrantes et naturelles. Composition food photography avec décor élégant. Texte : "{description}". Prix "{price}" attractif. Style food Instagram avec mise en scène appétissante.',
  'Animation culinaire dynamique : zoom rapproché sur le plat fumant, mouvements circulaires autour du produit, effets de vapeur ou de fraîcheur. Transitions gourmandes avec ingrédients qui apparaissent. Animation type publicité McDonald''s/KFC pour donner faim instantanément.',
  10,
  ARRAY['Facebook', 'Instagram', 'TikTok'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Fitness & Sport',
  'fitness',
  'Template pour salles de sport, équipements fitness et coaching',
  'energetic-fitness',
  'dynamic-motion',
  '{"primary": "#ff4500", "secondary": "#1e90ff", "accent": "#32cd32"}',
  'Visuel publicitaire fitness motivant pour {platform} : Programme/Produit {productName} - {niche}. Ambiance énergétique avec personne en action sportive. Éclairage dramatique et contrasté. Couleurs vives et dynamiques. Texte : "{description}". Prix "{price}" visible. Style fitness motivation avec typographie bold et impact visuel fort.',
  'Animation fitness explosive : mouvements rapides et dynamiques, effets de vitesse et de puissance, transitions énergiques. Zoom sur l''action avec ralenti dramatique. Animation type publicité Nike/Adidas pour motivation maximale et appel à l''action.',
  10,
  ARRAY['Facebook', 'Instagram', 'YouTube'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Mode & Fashion',
  'mode',
  'Template pour vêtements, accessoires et mode',
  'fashion-editorial',
  'fashion-runway',
  '{"primary": "#000000", "secondary": "#ffffff", "accent": "#c0a062"}',
  'Visuel publicitaire mode éditorial pour {platform} : Article {productName} - {niche}. Présentation fashion élégante avec mannequin/produit sur fond minimaliste. Éclairage studio professionnel. Style éditorial magazine. Texte : "{description}". Prix "{price}" discret. Esthétique Vogue/Elle avec composition artistique.',
  'Animation mode élégante : défilé virtuel avec mouvements fluides, zoom sur détails et textures du vêtement, transitions chic et sophistiquées. Effets de parallaxe subtils. Animation type défilé Chanel/Dior pour prestige et désirabilité maximale.',
  12,
  ARRAY['Instagram', 'Pinterest', 'TikTok'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Tech & Gadgets',
  'technologie',
  'Template pour produits technologiques et électroniques',
  'tech-futuristic',
  'tech-reveal',
  '{"primary": "#0066ff", "secondary": "#00ffff", "accent": "#ff00ff"}',
  'Visuel publicitaire tech futuriste pour {platform} : Gadget {productName} - {niche}. Présentation high-tech sur fond sombre avec effets néon. Éclairage bleu/cyan dramatique. Style Apple/Samsung avec design minimaliste. Texte : "{description}". Prix "{price}" moderne. Esthétique tech innovante avec reflets métalliques.',
  'Animation tech impressionnante : apparition holographique du produit, rotation 360° avec effets de lumière néon, zoom sur features technologiques. Transitions futuristes avec particules digitales. Animation type présentation Apple pour wow-effect technologique maximal.',
  12,
  ARRAY['Facebook', 'Instagram', 'YouTube'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
),
(
  'Services Professionnels',
  'services',
  'Template pour services B2B et professionnels',
  'professional-corporate',
  'corporate-elegant',
  '{"primary": "#1e3a8a", "secondary": "#059669", "accent": "#f59e0b"}',
  'Visuel publicitaire corporate professionnel pour {platform} : Service {productName} - {niche}. Design sobre et professionnel avec iconographie claire. Couleurs corporate rassurantes. Composition équilibrée. Texte : "{description}". Tarif "{price}" professionnel. Style LinkedIn/corporate avec typographie lisible et crédible.',
  'Animation corporate élégante : transitions professionnelles fluides, apparition progressive des éléments, mouvements subtils et sophistiqués. Effets de profondeur discrets. Animation type présentation Microsoft/IBM pour confiance et crédibilité maximale.',
  15,
  ARRAY['LinkedIn', 'Facebook', 'YouTube'],
  (SELECT id FROM auth.users WHERE email = 'djateulrich@gmail.com')
);

-- Trigger pour updated_at
CREATE TRIGGER update_ad_templates_updated_at
BEFORE UPDATE ON public.ad_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();