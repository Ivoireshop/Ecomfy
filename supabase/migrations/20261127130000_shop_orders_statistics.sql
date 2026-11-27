-- Pagination des commandes, étape B : les pages Statistiques et Finances de la boutique sont calculées par la base.
--
-- Elles additionnaient la liste de commandes chargée dans le navigateur, plafonnée à 5 000 lignes.
--
--   shop_order_rows(boutique)                      : commandes lisibles par l'appelant (masquées si boutique restreinte)
--   shop_order_statistics(boutique, période, fuseau): totaux, période précédente, jours, heures, pays, produits
--   shop_finance_daily(boutique, fuseau)           : commandes et encaissements par jour, sur tout l'historique
--   shop_cashed_orders(boutique, depuis, fuseau)   : commandes encaissées, pour la fiche comptable (lue par pages)
--
-- SECURITY INVOKER : mêmes droits qu'avant (RLS ; boutique restreinte via get_shop_orders_secure, sans articles).
-- Idempotente. À appliquer À LA MAIN (jamais `supabase db push`), APRÈS 20261127110000 et AVANT le front.
-- Tests : supabase/tests/shop_orders_statistics.sql (base jetable).

CREATE OR REPLACE FUNCTION public.shop_order_rows(_shop_id uuid)
RETURNS TABLE (
  id uuid, order_number text, total numeric, order_status text, payment_status text,
  customer_country text, customer_phone text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d.id, d.order_number, d.total, d.order_status, d.payment_status, d.customer_country, d.customer_phone, d.created_at
    FROM public.orders d
   WHERE d.shop_id = _shop_id AND NOT (SELECT public.is_shop_restricted(_shop_id))
  UNION ALL
  SELECT s.id, s.order_number, s.total, s.order_status, s.payment_status, s.customer_country, s.customer_phone, s.created_at
    FROM public.get_shop_orders_secure(_shop_id) s
   WHERE (SELECT public.is_shop_restricted(_shop_id));
$$;
REVOKE ALL ON FUNCTION public.shop_order_rows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_order_rows(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_order_statistics(_shop_id uuid, _period text DEFAULT '30d', _tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(_tz, ''), 'UTC');
  v_restricted boolean := public.is_shop_restricted(_shop_id);
  v_length int := CASE _period WHEN 'today' THEN 1 WHEN '7d' THEN 7 WHEN '30d' THEN 30 END;  -- NULL : tout
  v_today date;
  v_start timestamptz;
  v_prev timestamptz;
  v_month timestamptz;
  v_result jsonb;
BEGIN
  BEGIN
    v_today := (now() AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := 'UTC';
    v_today := (now() AT TIME ZONE v_tz)::date;
  END;
  -- Minuit du premier jour, dans le fuseau du marchand.
  v_start := (v_today - (v_length - 1))::timestamp AT TIME ZONE v_tz;
  v_prev := (v_today - (2 * v_length - 1))::timestamp AT TIME ZONE v_tz;
  v_month := date_trunc('month', v_today)::timestamp AT TIME ZONE v_tz;

  -- Les commandes annulées ou retournées ne sont pas des ventes.
  WITH sales AS MATERIALIZED (
    SELECT r.* FROM public.shop_order_rows(_shop_id) r
     WHERE r.order_status IS DISTINCT FROM 'cancelled' AND r.order_status IS DISTINCT FROM 'returned'
  ),
  cur AS MATERIALIZED (
    SELECT s.*, s.created_at AT TIME ZONE v_tz AS local_at FROM sales s WHERE v_start IS NULL OR s.created_at >= v_start
  ),
  items AS MATERIALIZED (
    SELECT i.order_id, i.product_id, i.product_name, i.quantity, i.total_price
      FROM public.order_items i
     WHERE NOT v_restricted AND i.order_id = ANY (ARRAY(SELECT c.id FROM cur c))
  ),
  products AS (
    SELECT COALESCE(i.product_id::text, 'name:' || i.product_name) AS key,
           (array_agg(i.product_name ORDER BY c.created_at DESC))[1] AS name,
           sum(i.quantity) AS quantity, COALESCE(sum(i.total_price), 0) AS revenue, max(c.created_at) AS last_at
      FROM items i JOIN cur c ON c.id = i.order_id
     GROUP BY 1
  ),
  -- Le pays déduit du téléphone ne dépend que de ses 3 premiers chiffres et de sa longueur : un numéro par groupe suffit.
  countries AS (
    SELECT c.customer_country AS country, min(c.customer_phone) AS phone, count(*) AS n, COALESCE(sum(c.total), 0) AS total
      FROM cur c
     GROUP BY c.customer_country,
              left(regexp_replace(COALESCE(c.customer_phone, ''), '\D', '', 'g'), 3),
              length(regexp_replace(COALESCE(c.customer_phone, ''), '\D', '', 'g'))
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM cur),
    'revenue', (SELECT COALESCE(sum(total), 0) FROM cur),
    -- Ni livrées ni payées d'avance : pas encore encaissées.
    'awaiting_total', (SELECT COALESCE(sum(total), 0) FROM cur
                        WHERE order_status IS DISTINCT FROM 'delivered' AND payment_status IS DISTINCT FROM 'paid'),
    'first_order_at', (SELECT min(created_at) FROM cur),
    'previous_count', (SELECT count(*) FROM sales WHERE created_at >= v_prev AND created_at < v_start),
    'previous_revenue', (SELECT COALESCE(sum(total), 0) FROM sales WHERE created_at >= v_prev AND created_at < v_start),
    'month_revenue', (SELECT COALESCE(sum(total), 0) FROM sales WHERE created_at >= v_month),
    -- La courbe montre au plus 90 jours.
    'days', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', d.n, 'total', d.total) ORDER BY d.day), '[]'::jsonb)
               FROM (SELECT local_at::date AS day, count(*) AS n, COALESCE(sum(total), 0) AS total FROM cur
                      WHERE local_at::date >= v_today - 89 GROUP BY 1) d),
    'hours', (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h.hour, 'count', h.n, 'total', h.total) ORDER BY h.hour), '[]'::jsonb)
                FROM (SELECT extract(hour FROM local_at)::int AS hour, count(*) AS n, COALESCE(sum(total), 0) AS total FROM cur GROUP BY 1) h),
    'countries', (SELECT COALESCE(jsonb_agg(jsonb_build_object('country', country, 'phone', phone, 'count', n, 'total', total)
                                            ORDER BY total DESC, country, phone), '[]'::jsonb) FROM countries),
    'products', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'quantity', quantity, 'revenue', revenue)
                                           ORDER BY last_at DESC, key), '[]'::jsonb) FROM products)
  ) INTO v_result;

  RETURN v_result;
END
$$;
REVOKE ALL ON FUNCTION public.shop_order_statistics(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_order_statistics(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_finance_daily(_shop_id uuid, _tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(_tz, ''), 'UTC');
  v_result jsonb;
BEGIN
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := 'UTC';
  END;

  -- Mêmes règles que src/lib/shopFinance.ts : validée = confirmée à livrée ; encaissée = livrée, sauf paiement
  -- remboursé ou en échec.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'day', to_char(d.day, 'YYYY-MM-DD'), 'count', d.n, 'confirmed_count', d.confirmed, 'delivered_count', d.delivered,
           'revenue', d.revenue, 'cash_in', d.cash_in) ORDER BY d.day), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT (r.created_at AT TIME ZONE v_tz)::date AS day,
             count(*) AS n,
             count(*) FILTER (WHERE r.order_status IN ('confirmed', 'processing', 'shipped', 'delivered')) AS confirmed,
             count(*) FILTER (WHERE r.order_status = 'delivered') AS delivered,
             COALESCE(sum(r.total) FILTER (WHERE r.order_status IN ('confirmed', 'processing', 'shipped', 'delivered')), 0) AS revenue,
             COALESCE(sum(r.total) FILTER (WHERE r.order_status = 'delivered'
                                             AND lower(COALESCE(r.payment_status, '')) NOT IN ('refunded', 'failed')), 0) AS cash_in
        FROM public.shop_order_rows(_shop_id) r
       GROUP BY 1
    ) d;

  RETURN v_result;
END
$$;
REVOKE ALL ON FUNCTION public.shop_finance_daily(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_finance_daily(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_cashed_orders(_shop_id uuid, _since date DEFAULT NULL, _tz text DEFAULT 'UTC')
RETURNS TABLE (id uuid, order_number text, total numeric, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_tz text := COALESCE(NULLIF(_tz, ''), 'UTC');
  v_from timestamptz;
BEGIN
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := 'UTC';
  END;
  v_from := _since::timestamp AT TIME ZONE v_tz;

  RETURN QUERY
  SELECT r.id, r.order_number, r.total, r.created_at
    FROM public.shop_order_rows(_shop_id) r
   WHERE r.order_status = 'delivered' AND lower(COALESCE(r.payment_status, '')) NOT IN ('refunded', 'failed')
     AND (v_from IS NULL OR r.created_at >= v_from)
   ORDER BY r.created_at, r.id;
END
$$;
REVOKE ALL ON FUNCTION public.shop_cashed_orders(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_cashed_orders(uuid, date, text) TO authenticated;
