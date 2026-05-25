
-- Enabled languages list on shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS enabled_languages text[] NOT NULL DEFAULT ARRAY['fr']::text[];

-- Product translations
CREATE TABLE IF NOT EXISTS public.product_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text,
  short_description text,
  description text,
  category text,
  source text NOT NULL DEFAULT 'ai_auto', -- 'manual' | 'ai_auto'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, language)
);

CREATE INDEX IF NOT EXISTS idx_product_translations_product ON public.product_translations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_translations_shop_lang ON public.product_translations(shop_id, language);

ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view translations of published products"
  ON public.product_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_translations.product_id
        AND p.is_published = true
        AND public.is_shop_publicly_visible(p.shop_id)
    )
  );

CREATE POLICY "Shop owners manage product translations"
  ON public.product_translations FOR ALL
  USING (public.is_shop_owner(shop_id, auth.uid()))
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()));

CREATE POLICY "Shop edit collaborators manage product translations"
  ON public.product_translations FOR ALL
  USING (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::shop_collab_role))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::shop_collab_role));

CREATE TRIGGER trg_product_translations_updated_at
  BEFORE UPDATE ON public.product_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shop translations
CREATE TABLE IF NOT EXISTS public.shop_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  language text NOT NULL,
  business_name text,
  business_description text,
  seo_title text,
  seo_description text,
  source text NOT NULL DEFAULT 'ai_auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, language)
);

CREATE INDEX IF NOT EXISTS idx_shop_translations_shop_lang ON public.shop_translations(shop_id, language);

ALTER TABLE public.shop_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view translations of published shops"
  ON public.shop_translations FOR SELECT
  USING (public.is_shop_publicly_visible(shop_id));

CREATE POLICY "Shop owners manage shop translations"
  ON public.shop_translations FOR ALL
  USING (public.is_shop_owner(shop_id, auth.uid()))
  WITH CHECK (public.is_shop_owner(shop_id, auth.uid()));

CREATE POLICY "Shop edit collaborators manage shop translations"
  ON public.shop_translations FOR ALL
  USING (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::shop_collab_role))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::shop_collab_role));

CREATE TRIGGER trg_shop_translations_updated_at
  BEFORE UPDATE ON public.shop_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
