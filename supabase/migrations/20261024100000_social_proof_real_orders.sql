-- Preuve sociale : uniquement de vraies commandes récentes.
-- Avant : toutes les commandes, même annulées/retournées ou vieilles de plusieurs mois, étaient proposées.
-- Maintenant : commandes des 7 derniers jours, hors annulées et retournées. Même signature, même format de retour.
CREATE OR REPLACE FUNCTION public.get_shop_social_proof_orders(_shop_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(customer_name text, product_name text, product_image_url text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(trim(o.customer_name), ' ', 1) AS customer_name,
    COALESCE((
      SELECT oi.product_name
      FROM public.order_items oi
      WHERE oi.order_id = o.id
      ORDER BY oi.created_at ASC
      LIMIT 1
    ), 'un article') AS product_name,
    (
      SELECT oi.product_image_url
      FROM public.order_items oi
      WHERE oi.order_id = o.id
      ORDER BY oi.created_at ASC
      LIMIT 1
    ) AS product_image_url,
    o.created_at
  FROM public.orders o
  WHERE o.shop_id = _shop_id
    AND public.is_shop_publicly_visible(o.shop_id)
    AND o.created_at >= now() - interval '7 days'
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND COALESCE(split_part(trim(o.customer_name), ' ', 1), '') <> ''
  ORDER BY o.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_social_proof_orders(uuid, integer) TO anon, authenticated;
