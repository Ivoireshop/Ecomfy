-- Livraison, étape D : affectation aux livreurs (cahier des charges §9).
--   1. Notification au livreur quand une commande lui est affectée ou retirée.
--   2. Performances individuelles : delivery_company_driver_stats.
-- (L'appartenance du livreur à la structure est déjà garantie par guard_delivery_dispatch_assignment, migration 20261106110000.)

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Notification du livreur
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_dispatch_notify_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text;
  r record;
BEGIN
  IF NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN RETURN NEW; END IF;
  SELECT o.order_number INTO v_num FROM public.orders o WHERE o.id = NEW.order_id;

  -- Nouveau livreur : « une commande vous est affectée ».
  IF NEW.assigned_driver_id IS NOT NULL THEN
    FOR r IN SELECT s.user_id FROM public.delivery_company_staff s
              WHERE s.driver_id = NEW.assigned_driver_id AND s.status = 'active' AND s.user_id IS NOT NULL LOOP
      PERFORM public.delivery_notify(r.user_id, NEW.company_id, NEW.assigned_driver_id, 'dispatch_driver_assigned', 'info',
        'Une commande vous est affectée',
        format('Commande %s à livrer à %s.', COALESCE(v_num, NEW.order_id::text), NEW.city),
        '/delivery/partner-dashboard');
    END LOOP;
  END IF;

  -- Ancien livreur (réaffectation) : la commande lui est retirée.
  IF OLD.assigned_driver_id IS NOT NULL THEN
    FOR r IN SELECT s.user_id FROM public.delivery_company_staff s
              WHERE s.driver_id = OLD.assigned_driver_id AND s.status = 'active' AND s.user_id IS NOT NULL LOOP
      PERFORM public.delivery_notify(r.user_id, NEW.company_id, OLD.assigned_driver_id, 'dispatch_driver_unassigned', 'warning',
        'Une commande vous a été retirée',
        format('Commande %s réaffectée à un autre livreur.', COALESCE(v_num, NEW.order_id::text)),
        '/delivery/partner-dashboard');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_notify_driver() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_delivery_dispatch_notify_driver ON public.delivery_dispatches;
CREATE TRIGGER trg_delivery_dispatch_notify_driver
  AFTER UPDATE OF assigned_driver_id ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.delivery_dispatch_notify_driver();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Performances individuelles des livreurs
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_driver_stats(_company_id uuid)
RETURNS TABLE (
  driver_id uuid,
  full_name text,
  is_active boolean,
  in_progress integer,
  delivered integer,
  failed integer,
  success_rate numeric,
  avg_delivery_minutes numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dr.id,
         dr.full_name,
         dr.is_active,
         count(*) FILTER (WHERE d.status IN ('assigned', 'picked_up', 'in_transit'))::integer,
         count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed'))::integer,
         count(*) FILTER (WHERE d.status IN ('failed', 'returned'))::integer,
         CASE WHEN count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed', 'failed', 'returned')) = 0
              THEN NULL
              ELSE round(100.0 * count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed'))
                         / count(*) FILTER (WHERE d.status IN ('delivered', 'cod_collected', 'deposit_pending', 'completed', 'failed', 'returned')), 0)
         END,
         round(avg(EXTRACT(EPOCH FROM (d.delivered_at - d.picked_up_at)) / 60.0)
               FILTER (WHERE d.delivered_at IS NOT NULL AND d.picked_up_at IS NOT NULL AND d.delivered_at >= d.picked_up_at), 0)
    FROM public.delivery_drivers dr
    LEFT JOIN public.delivery_dispatches d ON d.assigned_driver_id = dr.id AND d.company_id = _company_id
   WHERE dr.company_id = _company_id
     AND public.delivery_company_can(_company_id, 'stats')
   GROUP BY dr.id, dr.full_name, dr.is_active
   ORDER BY dr.full_name;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_driver_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_driver_stats(uuid) TO authenticated, service_role;
