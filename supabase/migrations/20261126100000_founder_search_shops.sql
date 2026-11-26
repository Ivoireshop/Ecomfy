-- Pagination côté serveur : boutiques du tableau de bord fondateur.
-- La recherche porte aussi sur l'e-mail du propriétaire (table profiles, sans clé étrangère depuis shops),
-- ce que PostgREST ne sait pas filtrer en une requête.
-- SECURITY INVOKER : les politiques RLS de shops et profiles s'appliquent à l'appelant.

CREATE OR REPLACE FUNCTION public.founder_search_shops(
  _query  text    DEFAULT NULL,
  _limit  integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matching AS (
    SELECT s.id, s.business_name, s.slug, s.city, s.country, s.whatsapp_number, s.is_published, s.is_activated,
           s.commission_balance_due, s.total_orders, s.total_sales, s.created_at, s.user_id,
           p.email AS owner_email
    FROM public.shops s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE coalesce(btrim(_query), '') = ''
       -- strpos : le texte saisi est cherché tel quel, « % » et « _ » compris.
       OR strpos(lower(coalesce(s.business_name, '')), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(s.slug, '')), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(s.city, '')), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(p.email, '')), lower(btrim(_query))) > 0
  ),
  page AS (
    SELECT * FROM matching
    ORDER BY created_at DESC, id DESC
    LIMIT least(greatest(coalesce(_limit, 25), 1), 100)
    OFFSET greatest(coalesce(_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM matching),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC, page.id DESC) FROM page), '[]'::jsonb)
  )
  -- Réservé à la direction : la lecture des boutiques publiées étant publique, la RLS seule ne suffirait pas.
  WHERE public.is_founder_or_master();
$$;

REVOKE ALL ON FUNCTION public.founder_search_shops(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_search_shops(text, integer, integer) TO authenticated;
