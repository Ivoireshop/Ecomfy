-- Update get_top_sellers function to aggregate revenue across ALL products & shops owned by each seller (user_id)

DROP FUNCTION IF EXISTS public.get_top_sellers(integer);

CREATE OR REPLACE FUNCTION public.get_top_sellers(p_limit integer DEFAULT 5)
RETURNS TABLE(
  shop_id uuid,
  full_name text,
  slug text,
  avatar_url text,
  total_sales numeric,
  total_orders integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seller_shops AS (
    SELECT
      s.user_id,
      MIN(s.id) AS primary_shop_id,
      MIN(s.slug) AS primary_slug,
      COALESCE(SUM(s.total_sales), 0) AS shop_sales,
      COALESCE(SUM(s.total_orders), 0) AS shop_orders
    FROM public.shops s
    WHERE COALESCE(s.is_published, false) = true
      AND COALESCE(s.is_activated, false) = true
      AND COALESCE(s.is_suspended, false) = false
    GROUP BY s.user_id
  ),
  seller_orders AS (
    SELECT
      s.user_id,
      COALESCE(SUM(o.total), 0) AS order_sales,
      COUNT(o.id) AS order_count
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE COALESCE(s.is_published, false) = true
      AND COALESCE(s.is_activated, false) = true
      AND COALESCE(s.is_suspended, false) = false
      AND COALESCE(o.order_status, '') != 'cancelled'
    GROUP BY s.user_id
  )
  SELECT
    ss.primary_shop_id AS shop_id,
    NULLIF(trim(COALESCE(p.full_name, '')), '') AS full_name,
    ss.primary_slug AS slug,
    p.avatar_url,
    GREATEST(ss.shop_sales, COALESCE(so.order_sales, 0))::numeric AS total_sales,
    GREATEST(ss.shop_orders, COALESCE(so.order_count, 0))::integer AS total_orders
  FROM seller_shops ss
  LEFT JOIN seller_orders so ON so.user_id = ss.user_id
  LEFT JOIN public.profiles p ON p.id = ss.user_id
  WHERE GREATEST(ss.shop_sales, COALESCE(so.order_sales, 0)) > 0
  ORDER BY total_sales DESC, total_orders DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_sellers(integer) TO anon, authenticated;
