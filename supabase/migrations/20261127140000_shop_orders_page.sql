-- Pagination des commandes, étape C : la liste des commandes de la boutique est lue page par page.
--
-- shop_orders_page(boutique, recherche, filtre de livraison, jour du marchand, limite, décalage) renvoie :
--   restricted : boutique restreinte (aucune ligne : l'écran affiche le verrouillage)
--   total      : commandes correspondant à la recherche et au filtre
--   shop_total : toutes les commandes de la boutique
--   counts     : aujourd'hui, demain, planifiées, non planifiées (sur toute la boutique)
--   rows       : commandes de la page, de la plus récente à la plus ancienne, avec leurs articles et leur numéro
--                d'ordre (la plus ancienne de la boutique = 1)
--
-- La date de livraison prévue est la colonne dédiée, sinon la balise « [LIVRAISON PRÉVUE: AAAA-MM-JJ] » des notes
-- (mêmes règles que getOrderScheduleInfo). La recherche ignore les majuscules et les accents.
--
-- SECURITY INVOKER : mêmes droits que la lecture actuelle (RLS).
-- Idempotente. À appliquer À LA MAIN (jamais `supabase db push`), APRÈS 20261127100000 (normalize_product_label) et
-- AVANT le front.
-- Tests : supabase/tests/shop_orders_page.sql (base jetable).

CREATE OR REPLACE FUNCTION public.shop_orders_page(
  _shop_id uuid,
  _search text DEFAULT '',
  _delivery text DEFAULT 'all',
  _today date DEFAULT CURRENT_DATE,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_query text := public.normalize_product_label(COALESCE(_search, ''));
  v_today text := to_char(COALESCE(_today, CURRENT_DATE), 'YYYY-MM-DD');
  v_tomorrow text := to_char(COALESCE(_today, CURRENT_DATE) + 1, 'YYYY-MM-DD');
  v_result jsonb;
BEGIN
  IF public.is_shop_restricted(_shop_id) THEN
    RETURN jsonb_build_object('restricted', true, 'total', 0, 'shop_total', 0,
      'counts', jsonb_build_object('today', 0, 'tomorrow', 0, 'scheduled', 0, 'unscheduled', 0), 'rows', '[]'::jsonb);
  END IF;

  WITH base AS MATERIALIZED (
    SELECT o.id, o.created_at,
           row_number() OVER (ORDER BY o.created_at, o.id) AS sequence,
           COALESCE(to_char(o.scheduled_delivery_date, 'YYYY-MM-DD'),
                    substring(o.notes FROM '(?i)\[LIVRAISON PRÉVUE:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\]')) AS due,
           CASE WHEN v_query = '' THEN true
                ELSE position(v_query IN public.normalize_product_label(concat_ws(' | ',
                       o.order_number, o.customer_name, o.customer_phone, o.customer_email,
                       o.customer_city, o.customer_address, o.internal_delivery_note, o.notes))) > 0
           END AS found
      FROM public.orders o
     WHERE o.shop_id = _shop_id
  ),
  filtered AS MATERIALIZED (
    SELECT b.id, b.created_at, b.sequence FROM base b
     WHERE b.found
       AND CASE _delivery
             WHEN 'today' THEN b.due IS NOT DISTINCT FROM v_today
             WHEN 'tomorrow' THEN b.due IS NOT DISTINCT FROM v_tomorrow
             WHEN 'scheduled' THEN b.due IS NOT NULL
             WHEN 'unscheduled' THEN b.due IS NULL
             ELSE true
           END
  ),
  page AS MATERIALIZED (
    SELECT f.* FROM filtered f
     ORDER BY f.created_at DESC, f.id DESC
     LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 1000)
    OFFSET GREATEST(COALESCE(_offset, 0), 0)
  ),
  -- MATERIALIZED : sinon la lecture des articles (et ses contrôles d'accès) est refaite pour chaque commande du lot.
  items AS MATERIALIZED (
    SELECT i.order_id, jsonb_agg(to_jsonb(i) ORDER BY i.id) AS list
      FROM public.order_items i
     WHERE i.order_id = ANY (ARRAY(SELECT p.id FROM page p))
     GROUP BY i.order_id
  ),
  full_orders AS MATERIALIZED (
    SELECT o.* FROM public.orders o WHERE o.id = ANY (ARRAY(SELECT p.id FROM page p))
  )
  SELECT jsonb_build_object(
    'restricted', false,
    'total', (SELECT count(*) FROM filtered),
    'shop_total', (SELECT count(*) FROM base),
    'counts', (SELECT jsonb_build_object(
                 'today', count(*) FILTER (WHERE due = v_today),
                 'tomorrow', count(*) FILTER (WHERE due = v_tomorrow),
                 'scheduled', count(*) FILTER (WHERE due IS NOT NULL),
                 'unscheduled', count(*) FILTER (WHERE due IS NULL))
                 FROM base),
    'rows', (SELECT COALESCE(jsonb_agg(
                 to_jsonb(o) || jsonb_build_object('sequence', p.sequence, 'order_items', COALESCE(i.list, '[]'::jsonb))
                 ORDER BY p.created_at DESC, p.id DESC), '[]'::jsonb)
               FROM page p
               JOIN full_orders o ON o.id = p.id
               LEFT JOIN items i ON i.order_id = p.id)
  ) INTO v_result;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.shop_orders_page(uuid, text, text, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_orders_page(uuid, text, text, date, integer, integer) TO authenticated;
