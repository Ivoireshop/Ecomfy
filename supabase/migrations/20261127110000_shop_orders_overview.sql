-- Pagination des commandes, étape A : les indicateurs de la boutique sont calculés par la base.
--
-- Jusqu'ici le navigateur lisait jusqu'à 5 000 commandes avec leurs articles pour compter et additionner : au-delà,
-- chiffre d'affaires, pastille « nouvelles commandes » et compteur de facturation étaient faux.
--
-- shop_orders_overview(boutique, fuseau) renvoie :
--   total_count   : toutes les commandes de la boutique
--   unread_count  : commandes non lues
--   revenue_total : chiffre d'affaires cumulé (hors annulées et retournées)
--   days          : ventes par jour (fuseau du marchand) depuis le début du mois ou les 7 derniers jours
--   recent        : les 4 dernières commandes
--
-- SECURITY INVOKER : mêmes droits que la lecture actuelle (RLS). Une boutique restreinte ne peut pas lire `orders` :
-- comme le front, la fonction passe alors par get_shop_orders_secure (coordonnées masquées, accès contrôlé).
-- Idempotente. À appliquer À LA MAIN (jamais `supabase db push`), AVANT le front.
-- Tests : supabase/tests/shop_orders_overview.sql (base jetable).

CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON public.orders (shop_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

CREATE OR REPLACE FUNCTION public.shop_orders_overview(_shop_id uuid, _tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(_tz, ''), 'UTC');
  v_restricted boolean := public.is_shop_restricted(_shop_id);
  v_today date;
  v_since date;
  v_result jsonb;
BEGIN
  BEGIN
    v_today := (now() AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := 'UTC';
    v_today := (now() AT TIME ZONE v_tz)::date;
  END;
  -- Le plus ancien des deux : 1er du mois (« Ce mois ») ou J-6 (« Cette semaine », courbe sur 7 jours, « Hier »).
  v_since := LEAST(date_trunc('month', v_today)::date, v_today - 6);

  WITH o AS MATERIALIZED (
    SELECT d.id, d.order_number, d.customer_name, d.total, d.order_status, d.is_read, d.created_at
      FROM public.orders d
     WHERE d.shop_id = _shop_id AND NOT v_restricted
    UNION ALL
    SELECT s.id, s.order_number, s.customer_name, s.total, s.order_status, s.is_read, s.created_at
      FROM public.get_shop_orders_secure(_shop_id) s
     WHERE v_restricted
  ),
  daily AS (
    SELECT (o.created_at AT TIME ZONE v_tz)::date AS day, count(*) AS n, COALESCE(sum(o.total), 0) AS total
      FROM o
     WHERE o.order_status IS DISTINCT FROM 'cancelled' AND o.order_status IS DISTINCT FROM 'returned'
       AND (o.created_at AT TIME ZONE v_tz)::date >= v_since
     GROUP BY 1
  ),
  recent AS (
    SELECT o.* FROM o ORDER BY o.created_at DESC, o.id DESC LIMIT 4
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT count(*) FROM o),
    'unread_count', (SELECT count(*) FROM o WHERE o.is_read IS NOT TRUE),
    'revenue_total', (SELECT COALESCE(sum(o.total), 0) FROM o
                       WHERE o.order_status IS DISTINCT FROM 'cancelled' AND o.order_status IS DISTINCT FROM 'returned'),
    'days', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'count', n, 'total', total) ORDER BY day), '[]'::jsonb) FROM daily),
    'recent', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC, r.id DESC), '[]'::jsonb) FROM recent r)
  ) INTO v_result;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.shop_orders_overview(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_orders_overview(uuid, text) TO authenticated;
