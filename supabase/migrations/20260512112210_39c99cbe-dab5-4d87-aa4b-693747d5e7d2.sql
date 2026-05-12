CREATE TABLE IF NOT EXISTS public.shop_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  product_id uuid,
  session_id text,
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_visits_shop_id_visited_at_idx ON public.shop_visits (shop_id, visited_at DESC);
ALTER TABLE public.shop_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert shop visits" ON public.shop_visits;
CREATE POLICY "Anyone can insert shop visits" ON public.shop_visits FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Shop owners can read their visits" ON public.shop_visits;
CREATE POLICY "Shop owners can read their visits" ON public.shop_visits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_visits.shop_id AND s.user_id = auth.uid()));