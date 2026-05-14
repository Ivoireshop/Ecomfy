ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS ai_optimizer_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.product_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  framework text NOT NULL DEFAULT 'hormozi',
  visitors_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  diagnosis text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  rewritten_copy jsonb,
  raw_markdown text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_ai_analyses_shop_idx ON public.product_ai_analyses(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_ai_analyses_product_idx ON public.product_ai_analyses(product_id, created_at DESC);

ALTER TABLE public.product_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage their AI analyses"
  ON public.product_ai_analyses
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = product_ai_analyses.shop_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = product_ai_analyses.shop_id AND s.user_id = auth.uid()));