
-- ============= PRODUCT AUDIOS =============
CREATE TABLE IF NOT EXISTS public.product_audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  audio_url text NOT NULL,
  storage_path text,
  title text,
  description text,
  customer_name text,
  duration_seconds numeric,
  file_type text,
  file_size bigint,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_audios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_audios TO authenticated;
GRANT ALL ON public.product_audios TO service_role;

ALTER TABLE public.product_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_audios public read"
  ON public.product_audios FOR SELECT
  USING (is_active = true AND public.is_shop_publicly_visible(shop_id));

CREATE POLICY "product_audios owner select"
  ON public.product_audios FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_audios owner insert"
  ON public.product_audios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()))
  );

CREATE POLICY "product_audios owner update"
  ON public.product_audios FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()))
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_audios owner delete"
  ON public.product_audios FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE INDEX IF NOT EXISTS product_audios_product_idx ON public.product_audios(product_id, sort_order);
CREATE INDEX IF NOT EXISTS product_audios_shop_idx ON public.product_audios(shop_id);

CREATE TRIGGER product_audios_updated_at
  BEFORE UPDATE ON public.product_audios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= PRODUCT THEMES (catalog) =============
CREATE TABLE IF NOT EXISTS public.product_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  preview_image text,
  theme_type text NOT NULL DEFAULT 'standard',
  is_premium boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  configuration_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_themes TO anon, authenticated;
GRANT ALL ON public.product_themes TO service_role;

ALTER TABLE public.product_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_themes public read"
  ON public.product_themes FOR SELECT
  USING (is_active = true);

CREATE POLICY "product_themes founder manage"
  ON public.product_themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE TRIGGER product_themes_updated_at
  BEFORE UPDATE ON public.product_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= PRODUCT THEME SETTINGS (per product) =============
CREATE TABLE IF NOT EXISTS public.product_theme_settings (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  theme_slug text,
  background_color text,
  section_bg_color text,
  card_bg_color text,
  text_color text,
  title_color text,
  button_color text,
  button_text_color text,
  border_color text,
  badge_color text,
  background_mode text NOT NULL DEFAULT 'solid',
  gradient_from text,
  gradient_to text,
  background_image_url text,
  visible_sections text[],
  section_order text[],
  custom_css_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_theme_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_theme_settings TO authenticated;
GRANT ALL ON public.product_theme_settings TO service_role;

ALTER TABLE public.product_theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_theme_settings public read"
  ON public.product_theme_settings FOR SELECT
  USING (public.is_shop_publicly_visible(shop_id));

CREATE POLICY "product_theme_settings owner select"
  ON public.product_theme_settings FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_theme_settings owner upsert"
  ON public.product_theme_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_theme_settings owner update"
  ON public.product_theme_settings FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()))
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_theme_settings owner delete"
  ON public.product_theme_settings FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE TRIGGER product_theme_settings_updated_at
  BEFORE UPDATE ON public.product_theme_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= SEED THEMES =============
INSERT INTO public.product_themes (slug, name, description, theme_type, is_premium, price, sort_order, configuration_json) VALUES
('classic-premium','Classique Premium','Fond clair, mise en page propre, produit au centre','standard',false,0,1,
  '{"background_color":"#FFFFFF","section_bg_color":"#F8FAFC","card_bg_color":"#FFFFFF","text_color":"#1F2937","title_color":"#0F172A","button_color":"#EC4899","button_text_color":"#FFFFFF","border_color":"#E5E7EB","badge_color":"#F59E0B"}'),
('health-wellness','Santé & Bien-être','Couleurs douces et rassurantes','wellness',false,0,2,
  '{"background_color":"#F0FDF4","section_bg_color":"#ECFDF5","card_bg_color":"#FFFFFF","text_color":"#14532D","title_color":"#064E3B","button_color":"#10B981","button_text_color":"#FFFFFF","border_color":"#A7F3D0","badge_color":"#F59E0B"}'),
('luxury-dark','Luxe','Design sombre et élégant haut de gamme','luxury',false,0,3,
  '{"background_color":"#0B0B0F","section_bg_color":"#111118","card_bg_color":"#17171F","text_color":"#E5E7EB","title_color":"#FFFFFF","button_color":"#D4AF37","button_text_color":"#0B0B0F","border_color":"#2A2A33","badge_color":"#D4AF37"}'),
('direct-conversion','Conversion Directe','Boutons d''achat très visibles, orienté vente rapide','conversion',false,0,4,
  '{"background_color":"#FFFFFF","section_bg_color":"#FFF7ED","card_bg_color":"#FFFFFF","text_color":"#1F2937","title_color":"#7C2D12","button_color":"#EA580C","button_text_color":"#FFFFFF","border_color":"#FED7AA","badge_color":"#DC2626"}'),
('storytelling','Storytelling Produit','Raconte l''histoire du produit (avant/après)','storytelling',false,0,5,
  '{"background_color":"#FAF5FF","section_bg_color":"#F3E8FF","card_bg_color":"#FFFFFF","text_color":"#312E81","title_color":"#4C1D95","button_color":"#7C3AED","button_text_color":"#FFFFFF","border_color":"#DDD6FE","badge_color":"#F59E0B"}'),
('mobile-first','Mobile First','Optimisé pour téléphone et publicités sociales','mobile',false,0,6,
  '{"background_color":"#F9FAFB","section_bg_color":"#FFFFFF","card_bg_color":"#FFFFFF","text_color":"#111827","title_color":"#111827","button_color":"#2563EB","button_text_color":"#FFFFFF","border_color":"#E5E7EB","badge_color":"#EF4444"}'),
('landing-ad','Landing Page Publicitaire','Structure persuasive pour campagnes Meta/TikTok','landing',false,0,7,
  '{"background_color":"#FFFBEB","section_bg_color":"#FEF3C7","card_bg_color":"#FFFFFF","text_color":"#1F2937","title_color":"#92400E","button_color":"#DC2626","button_text_color":"#FFFFFF","border_color":"#FDE68A","badge_color":"#DC2626"}')
ON CONFLICT (slug) DO NOTHING;
