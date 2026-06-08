
-- Replace PERMISSIVE deny policy with RESTRICTIVE on email_send_state
DROP POLICY IF EXISTS "Deny all client access" ON public.email_send_state;
CREATE POLICY "Deny all client access"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Restrict orders INSERT to publicly visible shops
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders for visible shops"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_shop_publicly_visible(shop_id));
