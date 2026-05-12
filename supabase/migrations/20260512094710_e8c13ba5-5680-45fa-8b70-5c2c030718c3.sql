-- Bundles/lots offers on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bundle_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bundle_position text NOT NULL DEFAULT 'after_price';

-- Reviews table with moderation workflow
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  product_id uuid,
  reviewer_name text NOT NULL,
  reviewer_email text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review for a publicly visible shop
CREATE POLICY "Anyone can submit a review"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (public.is_shop_publicly_visible(shop_id));

-- Anyone can read approved reviews of public shops
CREATE POLICY "Anyone can view approved reviews"
  ON public.product_reviews
  FOR SELECT
  USING (status = 'approved' AND public.is_shop_publicly_visible(shop_id));

-- Shop owners can manage all their reviews
CREATE POLICY "Shop owners manage their reviews"
  ON public.product_reviews
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = product_reviews.shop_id AND shops.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = product_reviews.shop_id AND shops.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_product_reviews_shop ON public.product_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews(status);

CREATE TRIGGER trg_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();