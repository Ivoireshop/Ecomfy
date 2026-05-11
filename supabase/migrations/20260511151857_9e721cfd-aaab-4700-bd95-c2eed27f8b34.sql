CREATE OR REPLACE VIEW public.shop_social_proof_orders
WITH (security_invoker = false)
AS
SELECT
  o.shop_id,
  split_part(trim(o.customer_name), ' ', 1) AS customer_name,
  COALESCE((
    SELECT oi.product_name
    FROM public.order_items oi
    WHERE oi.order_id = o.id
    ORDER BY oi.created_at ASC
    LIMIT 1
  ), 'un article') AS product_name,
  o.created_at
FROM public.orders o
WHERE public.is_shop_publicly_visible(o.shop_id)
  AND COALESCE(split_part(trim(o.customer_name), ' ', 1), '') <> ''
ORDER BY o.created_at DESC;

GRANT SELECT ON public.shop_social_proof_orders TO anon, authenticated;