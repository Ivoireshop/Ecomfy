-- 1) Remove public read access on promo_codes; rely on SECURITY DEFINER validate_promo_code
DROP POLICY IF EXISTS "Anyone can view active promo codes" ON public.promo_codes;

-- 2) Lock down app_incidents writes (only service_role via SECURITY DEFINER RPC)
CREATE POLICY "Deny client inserts on app_incidents"
  ON public.app_incidents FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on app_incidents"
  ON public.app_incidents FOR DELETE
  TO anon, authenticated
  USING (false);

-- 3) Explicit deny on email_send_state (matches email_send_log pattern)
CREATE POLICY "Deny all client access"
  ON public.email_send_state FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);