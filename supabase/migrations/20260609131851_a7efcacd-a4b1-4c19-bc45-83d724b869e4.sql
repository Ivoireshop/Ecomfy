ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

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
  SELECT
    s.id,
    NULLIF(trim(COALESCE(p.full_name, '')), '') AS full_name,
    s.slug,
    p.avatar_url,
    COALESCE(s.total_sales, 0)::numeric,
    COALESCE(s.total_orders, 0)::integer
  FROM public.shops s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE COALESCE(s.is_published, false) = true
    AND COALESCE(s.is_activated, false) = true
    AND COALESCE(s.is_suspended, false) = false
    AND COALESCE(s.total_sales, 0) > 0
  ORDER BY COALESCE(s.total_sales, 0) DESC, COALESCE(s.total_orders, 0) DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_sellers(integer) TO anon, authenticated;