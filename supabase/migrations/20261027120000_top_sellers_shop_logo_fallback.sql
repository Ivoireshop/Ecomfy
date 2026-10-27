-- get_top_sellers : repli sur le logo de la boutique quand l'avatar du profil est absent ou stocké en base64.
-- 20261020130000 masque les avatars « data: » (jusqu'à 3 Mo) ; le front comptait ensuite sur shops.logo_url,
-- mais il le lit depuis le navigateur et la table shops n'est plus lisible par un visiteur (RLS) : il ne recevait
-- rien et affichait les initiales. Le repli se fait donc ici, côté serveur (SECURITY DEFINER).
-- Signature et colonnes inchangées. Une image « data: » n'est conservée que si elle fait au plus 100 000 caractères
-- (environ 75 Ko) : au-delà (jusqu'à 3 Mo constatés en production) elle est écartée, comme depuis 20261020130000.

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
      (ARRAY_AGG(s.id ORDER BY COALESCE(s.total_sales, 0) DESC, s.created_at ASC))[1] AS primary_shop_id,
      (ARRAY_AGG(s.slug ORDER BY COALESCE(s.total_sales, 0) DESC, s.created_at ASC))[1] AS primary_slug,
      (ARRAY_AGG(s.business_name ORDER BY COALESCE(s.total_sales, 0) DESC, s.created_at ASC))[1] AS primary_shop_name,
      (ARRAY_AGG(s.logo_url ORDER BY COALESCE(s.total_sales, 0) DESC, s.created_at ASC))[1] AS primary_logo_url,
      COALESCE(SUM(s.total_sales), 0) AS shop_sales,
      COALESCE(SUM(s.total_orders), 0) AS shop_orders
    FROM public.shops s
    WHERE COALESCE(s.is_suspended, false) = false
    GROUP BY s.user_id
  ),
  seller_orders AS (
    SELECT
      s.user_id,
      COALESCE(SUM(o.total), 0) AS order_sales,
      COUNT(o.id) AS order_count
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE COALESCE(s.is_suspended, false) = false
      AND COALESCE(o.order_status, '') != 'cancelled'
    GROUP BY s.user_id
  )
  SELECT
    ss.primary_shop_id AS shop_id,
    COALESCE(NULLIF(trim(p.full_name), ''), ss.primary_shop_name, 'Entrepreneur Ecomfy') AS full_name,
    ss.primary_slug AS slug,
    COALESCE(
      CASE WHEN NULLIF(trim(p.avatar_url), '') IS NOT NULL
             AND (p.avatar_url NOT LIKE 'data:%' OR length(p.avatar_url) <= 100000) THEN p.avatar_url END,
      CASE WHEN NULLIF(trim(ss.primary_logo_url), '') IS NOT NULL
             AND (ss.primary_logo_url NOT LIKE 'data:%' OR length(ss.primary_logo_url) <= 100000) THEN ss.primary_logo_url END
    ) AS avatar_url,
    GREATEST(ss.shop_sales, COALESCE(so.order_sales, 0))::numeric AS total_sales,
    GREATEST(ss.shop_orders, COALESCE(so.order_count, 0))::integer AS total_orders
  FROM seller_shops ss
  LEFT JOIN seller_orders so ON so.user_id = ss.user_id
  LEFT JOIN public.profiles p ON p.id = ss.user_id
  ORDER BY total_sales DESC, total_orders DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_sellers(integer) TO anon, authenticated;
