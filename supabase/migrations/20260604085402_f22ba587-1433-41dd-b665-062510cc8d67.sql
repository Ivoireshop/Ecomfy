-- 1) Allow students to view their own enrollment via their auth email
CREATE POLICY "Students can view their own enrollments"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
  lower(student_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

-- 2) Tighten orders SELECT: remove broad edit_shop access to customer PII
DROP POLICY IF EXISTS "Collaborators can view shop orders" ON public.orders;
CREATE POLICY "Collaborators can view shop orders"
ON public.orders
FOR SELECT
USING (
  public.has_shop_role(shop_id, auth.uid(), 'view_orders'::shop_collab_role)
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'::shop_collab_role)
);