DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

CREATE POLICY "Insert items only for fresh public orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > now() - interval '15 minutes'
      AND public.is_shop_publicly_visible(o.shop_id)
  )
);