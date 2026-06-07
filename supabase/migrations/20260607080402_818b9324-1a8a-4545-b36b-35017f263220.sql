-- Partial index to speed up the public shop product listing.
-- The existing idx_products_shop_display_order covers all rows; this one
-- targets only published products which is what visitors see, keeping the
-- index small and hot in memory.
CREATE INDEX IF NOT EXISTS idx_products_shop_published_display
  ON public.products (shop_id, display_order)
  WHERE is_published = true;