
-- 1) Catalogue global des thèmes
CREATE TABLE IF NOT EXISTS public.shop_themes_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  author text DEFAULT 'VisualPro',
  preview_desktop_url text,
  preview_mobile_url text,
  is_free boolean NOT NULL DEFAULT true,
  is_premium boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  version text NOT NULL DEFAULT '1.0.0',
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active_catalog boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_themes_catalog TO anon, authenticated;
GRANT ALL ON public.shop_themes_catalog TO service_role;

ALTER TABLE public.shop_themes_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_themes_catalog_public_read"
  ON public.shop_themes_catalog
  FOR SELECT
  USING (is_active_catalog = true);

CREATE TRIGGER trg_shop_themes_catalog_updated_at
  BEFORE UPDATE ON public.shop_themes_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Thèmes installés par boutique
CREATE TABLE IF NOT EXISTS public.shop_installed_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.shop_themes_catalog(id) ON DELETE CASCADE,
  customized_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, theme_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_installed_themes TO authenticated;
GRANT SELECT ON public.shop_installed_themes TO anon;
GRANT ALL ON public.shop_installed_themes TO service_role;

ALTER TABLE public.shop_installed_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installed_themes_public_read_active"
  ON public.shop_installed_themes
  FOR SELECT
  USING (true);

CREATE POLICY "installed_themes_owner_manage"
  ON public.shop_installed_themes
  FOR ALL
  USING (
    public.is_shop_owner(shop_id, auth.uid())
    OR public.is_shop_collaborator(shop_id, auth.uid())
  )
  WITH CHECK (
    public.is_shop_owner(shop_id, auth.uid())
    OR public.is_shop_collaborator(shop_id, auth.uid())
  );

CREATE TRIGGER trg_shop_installed_themes_updated_at
  BEFORE UPDATE ON public.shop_installed_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shop_installed_themes_shop ON public.shop_installed_themes(shop_id);

-- 3) Thème actif sur shops (nullable, défaut NULL => rendu classique inchangé)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS active_shop_theme_id uuid REFERENCES public.shop_themes_catalog(id) ON DELETE SET NULL;

-- 4) Catalogue initial
INSERT INTO public.shop_themes_catalog (slug, name, description, category, is_new, sort_order, default_config)
VALUES
  ('classic-shop', 'Classique', 'Le thème actuel de VisualPro : simple, fiable, polyvalent.', 'general', false, 10, '{"primary_color":"#EC4899"}'::jsonb),
  ('fashion-shop', 'Mode & Lifestyle', 'Élégant et visuel, adapté aux vêtements, sacs et accessoires.', 'fashion', true, 20, '{"primary_color":"#111827"}'::jsonb),
  ('beauty-shop', 'Beauté & Bien-être', 'Doux et rassurant pour cosmétiques, soins et produits naturels.', 'beauty', true, 30, '{"primary_color":"#DB2777"}'::jsonb),
  ('tech-shop', 'Tech & Electronique', 'Moderne et structuré pour produits technologiques.', 'tech', false, 40, '{"primary_color":"#2563EB"}'::jsonb),
  ('luxury-shop', 'Luxe Premium', 'Sombre, raffiné, espaces larges pour produits haut de gamme.', 'luxury', false, 50, '{"primary_color":"#C9A84C"}'::jsonb),
  ('mobile-first-shop', 'Mobile First', 'Pensé d''abord pour téléphone : rapide, CTA toujours visible.', 'mobile', true, 60, '{"primary_color":"#0EA5E9"}'::jsonb),
  ('landing-shop', 'Landing Conversion', 'Orienté publicité Facebook, TikTok, Snapchat : appels à l''action forts.', 'conversion', false, 70, '{"primary_color":"#F97316"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
