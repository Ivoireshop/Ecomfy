
CREATE OR REPLACE FUNCTION public.get_community_profiles(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

CREATE OR REPLACE FUNCTION public.search_community_profiles(_query text, _limit int DEFAULT 6)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.full_name IS NOT NULL
    AND (_query IS NULL OR _query = '' OR p.full_name ILIKE '%' || _query || '%')
  ORDER BY p.full_name ASC
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.get_community_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_community_profiles(text, int) TO authenticated;
