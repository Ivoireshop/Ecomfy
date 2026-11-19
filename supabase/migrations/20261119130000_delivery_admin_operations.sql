-- Livraison, étape E : contrôle des opérations par l'administration Ecomfy (cahier des charges §11.2).
-- Une seule fonction, réservée aux administrateurs de la plateforme : volumes par statut, performances par structure,
-- litiges ouverts et courses échouées récentes, sur une période en jours (1 à 365).
CREATE OR REPLACE FUNCTION public.delivery_admin_operations(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_days integer := LEAST(GREATEST(COALESCE(_days, 30), 1), 365);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.delivery_is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = '42501';
  END IF;
  v_since := now() - make_interval(days => v_days);

  SELECT jsonb_build_object(
    'days', v_days,
    'totals', (
      SELECT jsonb_build_object(
        'transmitted', count(*),
        'accepted', count(*) FILTER (WHERE d.accepted_at IS NOT NULL),
        'refused', count(*) FILTER (WHERE d.status = 'refused'),
        'in_progress', count(*) FILTER (WHERE d.status IN ('accepted', 'preparing', 'pending_assignment', 'assigned', 'picked_up', 'in_transit')),
        'delivered', count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed')),
        'failed', count(*) FILTER (WHERE d.status = 'failed'),
        'returned', count(*) FILTER (WHERE d.status = 'returned'),
        'cancelled', count(*) FILTER (WHERE d.status = 'cancelled'),
        'cod_total', COALESCE(sum(d.cod_amount) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed')), 0)
      )
      FROM public.delivery_dispatches d
      WHERE COALESCE(d.transmitted_at, d.created_at) >= v_since
    ),
    'companies', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.transmitted DESC)
      FROM (
        SELECT c.id AS company_id,
               c.company_name,
               c.verification_status::text AS verification_status,
               count(d.id)::int AS transmitted,
               count(*) FILTER (WHERE d.accepted_at IS NOT NULL)::int AS accepted,
               count(*) FILTER (WHERE d.status = 'refused')::int AS refused,
               count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed'))::int AS delivered,
               count(*) FILTER (WHERE d.status IN ('failed', 'returned'))::int AS failed,
               round(100.0 * count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed'))
                     / NULLIF(count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed', 'failed', 'returned')), 0), 0) AS success_rate,
               (SELECT count(*) FROM public.delivery_drivers dr WHERE dr.company_id = c.id AND dr.is_active)::int AS active_drivers
          FROM public.delivery_companies c
          JOIN public.delivery_dispatches d ON d.company_id = c.id AND COALESCE(d.transmitted_at, d.created_at) >= v_since
         GROUP BY c.id, c.company_name, c.verification_status
      ) t
    ), '[]'::jsonb),
    'disputes', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.raised_at DESC)
      FROM (
        SELECT ct.dispatch_id, c.company_name, s.business_name AS shop_name, d.recipient_name,
               ct.cod_amount, ct.currency, ct.dispute_reason AS reason, ct.dispute_raised_at AS raised_at
          FROM public.delivery_cash_transfers ct
          JOIN public.delivery_dispatches d ON d.id = ct.dispatch_id
          JOIN public.delivery_companies c ON c.id = ct.company_id
          LEFT JOIN public.shops s ON s.id = ct.shop_id
         WHERE ct.dispute_raised AND ct.dispute_resolved_at IS NULL
         LIMIT 50
      ) t
    ), '[]'::jsonb),
    'incidents', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.failed_at DESC)
      FROM (
        SELECT d.id AS dispatch_id, c.company_name, d.recipient_name, d.city, d.failure_reason AS reason, d.failed_at
          FROM public.delivery_dispatches d
          JOIN public.delivery_companies c ON c.id = d.company_id
         WHERE d.status = 'failed' AND d.failed_at >= v_since
         LIMIT 50
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_operations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_operations(integer) TO authenticated, service_role;
