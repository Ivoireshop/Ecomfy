
-- 1) Lock down service-role-only tables to prevent any client access
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'app_remediation_audit',
    'email_send_log',
    'email_unsubscribe_tokens',
    'suppressed_emails',
    'webhook_events'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Deny all client access" ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY "Deny all client access" ON public.%I
      AS RESTRICTIVE FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
    $f$, t);
  END LOOP;
END $$;

-- 2) order_items: allow collaborators authorized on the parent order to view items
DROP POLICY IF EXISTS "Collaborators can view order items" ON public.order_items;
CREATE POLICY "Collaborators can view order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        public.has_shop_role(o.shop_id, auth.uid(), 'view_orders'::shop_collab_role)
        OR public.has_shop_role(o.shop_id, auth.uid(), 'manage_delivered_orders'::shop_collab_role)
      )
  )
);
