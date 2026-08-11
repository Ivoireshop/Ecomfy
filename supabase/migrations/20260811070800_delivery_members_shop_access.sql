-- Add policy to allow shop owners to see the delivery members assigned to their orders
CREATE POLICY "Shop owners can view assigned delivery members"
  ON public.delivery_company_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_deliveries od
      JOIN public.orders o ON o.id = od.order_id
      JOIN public.shops s ON s.id = o.shop_id
      WHERE od.driver_id = delivery_company_members.id
        AND s.user_id = auth.uid()
    )
  );
