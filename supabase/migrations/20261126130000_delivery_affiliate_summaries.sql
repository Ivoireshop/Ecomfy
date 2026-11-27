-- Pagination côté serveur (lot 4B) : les listes des courses d'une structure et de l'espace affilié sont lues
-- page par page ; leurs totaux doivent donc être calculés par la base.
-- SECURITY INVOKER : chaque appelant ne compte que les lignes que ses droits (RLS) lui laissent lire,
-- comme lorsque le navigateur additionnait les lignes reçues.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Vue d'ensemble d'une structure de livraison (cahier §3.1)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_overview(_company_id uuid, _days integer DEFAULT 30, _timezone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(btrim(_timezone), ''), 'UTC');
  v_first_day date;
  v_result jsonb;
BEGIN
  -- Le fuseau vient du navigateur : s'il est inconnu du serveur, on compte en temps universel.
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := 'UTC';
  END;
  v_first_day := (now() AT TIME ZONE v_tz)::date - (LEAST(GREATEST(COALESCE(_days, 30), 1), 92) - 1);

  WITH courses AS MATERIALIZED (
    SELECT d.status::text AS status, COALESCE(d.transmitted_at, d.created_at) AS received_at,
           d.delivered_at, d.failed_at, d.returned_at
      FROM public.delivery_dispatches d
     WHERE d.company_id = _company_id
  ),
  -- Activité par jour : chaque événement est compté à sa propre date.
  events AS (
    SELECT (e.happened_at AT TIME ZONE v_tz)::date AS day, e.kind
      FROM courses c
     CROSS JOIN LATERAL (VALUES ('received', c.received_at), ('delivered', c.delivered_at),
                                ('failed', c.failed_at), ('returned', c.returned_at)) AS e(kind, happened_at)
     WHERE e.happened_at IS NOT NULL
  ),
  daily AS (
    SELECT day,
           count(*) FILTER (WHERE kind = 'received') AS received,
           count(*) FILTER (WHERE kind = 'delivered') AS delivered,
           count(*) FILTER (WHERE kind = 'failed') AS failed,
           count(*) FILTER (WHERE kind = 'returned') AS returned
      FROM events
     WHERE day >= v_first_day
     GROUP BY day
  )
  SELECT jsonb_build_object(
    'by_status', COALESCE((SELECT jsonb_object_agg(s.status, s.n)
                             FROM (SELECT status, count(*) AS n FROM courses GROUP BY status) s), '{}'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(daily) ORDER BY daily.day DESC) FROM daily), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_company_overview(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_overview(uuid, integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Synthèse d'un affilié
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.affiliate_summary(_affiliate_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending_amount', COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'PENDING'), 0),
    'payable_amount', COALESCE(sum(c.commission_amount) FILTER (WHERE c.status IN ('PAYABLE', 'APPROVED')), 0),
    'paid_amount', COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'PAID'), 0),
    'paid_customers', count(DISTINCT c.referred_user_id) FILTER (WHERE c.status IN ('PAYABLE', 'APPROVED', 'PAID')),
    'commissions_count', count(*),
    'referred_count', (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = _affiliate_id),
    'payouts_count', (SELECT count(*) FROM public.affiliate_payouts p WHERE p.affiliate_id = _affiliate_id)
  )
    FROM public.affiliate_commissions c
   WHERE c.affiliate_id = _affiliate_id;
$$;

REVOKE ALL ON FUNCTION public.affiliate_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_summary(uuid) TO authenticated, service_role;
