
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  session_id text NOT NULL,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_city text,
  customer_address text,
  payment_method text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_count integer NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  converted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, session_id)
);

CREATE INDEX idx_abandoned_carts_shop ON public.abandoned_carts (shop_id, created_at DESC);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create abandoned carts on public shops"
ON public.abandoned_carts FOR INSERT
TO anon, authenticated
WITH CHECK (is_shop_publicly_visible(shop_id));

CREATE POLICY "Anyone can update their abandoned cart on public shops"
ON public.abandoned_carts FOR UPDATE
TO anon, authenticated
USING (is_shop_publicly_visible(shop_id) AND created_at > now() - interval '24 hours')
WITH CHECK (is_shop_publicly_visible(shop_id));

CREATE POLICY "Shop owners can view their abandoned carts"
ON public.abandoned_carts FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = abandoned_carts.shop_id AND shops.user_id = auth.uid()));

CREATE POLICY "Shop owners can delete their abandoned carts"
ON public.abandoned_carts FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = abandoned_carts.shop_id AND shops.user_id = auth.uid()));

CREATE TRIGGER update_abandoned_carts_updated_at
BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
