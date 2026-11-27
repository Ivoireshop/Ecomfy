-- Pagination des clients fidèles : les commandes sont regroupées par client dans la base, lues page par page.
--
-- shop_loyal_customers(boutique, recherche, niveau, limite, décalage) renvoie :
--   restricted : boutique restreinte (aucune ligne)
--   total      : clients correspondant à la recherche et au niveau
--   stats      : sur toute la boutique — clients, fidèles (2 commandes ou plus), platine, or, argent, bronze,
--                chiffre d'affaires des fidèles
--   rows       : clients de la page, par nombre de commandes puis montant dépensé
--
-- Règles reprises du calcul fait jusqu'ici dans le navigateur :
--   - les commandes annulées ou retournées ne comptent pas ;
--   - un client = les 8 derniers chiffres du téléphone, à défaut l'e-mail ; sans les deux, la commande est ignorée ;
--   - nom de la commande la plus récente ; téléphone, e-mail et ville : la dernière valeur renseignée ;
--   - niveaux : platine 5+, or 3-4, argent 2, bronze 1.
-- La recherche ignore les majuscules et les accents ; une saisie faite de chiffres cherche aussi dans le numéro sans
-- sa mise en forme.
--
-- SECURITY INVOKER : mêmes droits que la lecture actuelle (RLS).
-- Idempotente. À appliquer À LA MAIN (jamais `supabase db push`), APRÈS 20261127100000 (normalize_product_label) et
-- AVANT le front.
-- Tests : supabase/tests/shop_loyal_customers.sql (base jetable).

CREATE OR REPLACE FUNCTION public.shop_loyal_customers(
  _shop_id uuid,
  _search text DEFAULT '',
  _tier text DEFAULT 'all',
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_query text := public.normalize_product_label(COALESCE(_search, ''));
  v_digits text := '';
  v_result jsonb;
BEGIN
  IF public.is_shop_restricted(_shop_id) THEN
    RETURN jsonb_build_object('restricted', true, 'total', 0,
      'stats', jsonb_build_object('customers', 0, 'repeating', 0, 'platine', 0, 'or', 0, 'argent', 0, 'bronze', 0, 'repeat_revenue', 0),
      'rows', '[]'::jsonb);
  END IF;

  -- « 07 00 00 » doit retrouver « 0700000000 » ; « jean #7 » n'est pas un numéro.
  IF v_query ~ '^[0-9[:space:]+().-]+$' THEN
    v_digits := regexp_replace(v_query, '[^0-9]', '', 'g');
  END IF;

  WITH sales AS MATERIALIZED (
    SELECT o.id, o.created_at, COALESCE(o.total, 0) AS total,
           btrim(COALESCE(o.customer_name, ''), E' \t\r\n') AS name,
           btrim(COALESCE(o.customer_phone, ''), E' \t\r\n') AS phone,
           COALESCE(o.customer_email, '') AS email,
           COALESCE(o.customer_city, '') AS city
      FROM public.orders o
     WHERE o.shop_id = _shop_id
       AND COALESCE(o.order_status::text, '') NOT IN ('cancelled', 'returned')
  ),
  keyed AS (
    SELECT s.*,
           COALESCE(NULLIF(right(regexp_replace(s.phone, '[^0-9]', '', 'g'), 8), ''),
                    NULLIF(lower(btrim(s.email, E' \t\r\n')), '')) AS key
      FROM sales s
  ),
  grouped AS (
    SELECT k.key,
           COALESCE(NULLIF((array_agg(k.name ORDER BY k.created_at DESC, k.id DESC))[1], ''), 'Client') AS customer_name,
           COALESCE((array_agg(k.phone ORDER BY k.created_at DESC, k.id DESC) FILTER (WHERE k.phone <> ''))[1], '') AS customer_phone,
           (array_agg(k.email ORDER BY k.created_at DESC, k.id DESC) FILTER (WHERE k.email <> ''))[1] AS customer_email,
           (array_agg(k.city ORDER BY k.created_at DESC, k.id DESC) FILTER (WHERE k.city <> ''))[1] AS delivery_city,
           count(*) AS order_count,
           sum(k.total) AS total_spent,
           max(k.created_at) AS last_order_date,
           min(k.created_at) AS first_order_date
      FROM keyed k
     WHERE k.key IS NOT NULL
     GROUP BY k.key
  ),
  customers AS MATERIALIZED (
    SELECT g.*,
           CASE WHEN g.order_count >= 5 THEN 'platine'
                WHEN g.order_count >= 3 THEN 'or'
                WHEN g.order_count = 2 THEN 'argent'
                ELSE 'bronze' END AS tier
      FROM grouped g
  ),
  filtered AS MATERIALIZED (
    SELECT c.* FROM customers c
     WHERE CASE COALESCE(_tier, 'all')
             WHEN 'all' THEN true
             WHEN 'repeating' THEN c.order_count >= 2
             ELSE c.tier = _tier
           END
       AND (v_query = ''
            OR position(v_query IN public.normalize_product_label(c.customer_name)) > 0
            OR position(v_query IN public.normalize_product_label(c.customer_phone)) > 0
            OR position(v_query IN public.normalize_product_label(c.customer_email)) > 0
            OR position(v_query IN public.normalize_product_label(c.delivery_city)) > 0
            OR (v_digits <> '' AND position(v_digits IN regexp_replace(c.customer_phone, '[^0-9]', '', 'g')) > 0))
  ),
  page AS (
    SELECT f.* FROM filtered f
     ORDER BY f.order_count DESC, f.total_spent DESC, f.last_order_date DESC, f.key
     LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 1000)
    OFFSET GREATEST(COALESCE(_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'restricted', false,
    'total', (SELECT count(*) FROM filtered),
    'stats', (SELECT jsonb_build_object(
                'customers', count(*),
                'repeating', count(*) FILTER (WHERE order_count >= 2),
                'platine', count(*) FILTER (WHERE tier = 'platine'),
                'or', count(*) FILTER (WHERE tier = 'or'),
                'argent', count(*) FILTER (WHERE tier = 'argent'),
                'bronze', count(*) FILTER (WHERE tier = 'bronze'),
                'repeat_revenue', COALESCE(sum(total_spent) FILTER (WHERE order_count >= 2), 0))
                FROM customers),
    'rows', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', p.key,
                 'customer_name', p.customer_name,
                 'customer_phone', p.customer_phone,
                 'customer_email', p.customer_email,
                 'delivery_city', p.delivery_city,
                 'order_count', p.order_count,
                 'total_spent', p.total_spent,
                 'last_order_date', p.last_order_date,
                 'first_order_date', p.first_order_date,
                 'tier', p.tier)
                 ORDER BY p.order_count DESC, p.total_spent DESC, p.last_order_date DESC, p.key), '[]'::jsonb)
               FROM page p)
  ) INTO v_result;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.shop_loyal_customers(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_loyal_customers(uuid, text, text, integer, integer) TO authenticated;
