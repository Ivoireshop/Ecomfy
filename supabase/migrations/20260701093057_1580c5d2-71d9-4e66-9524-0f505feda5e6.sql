
-- Per-shop enforcement callable by anyone (idempotent, safe)
CREATE OR REPLACE FUNCTION public.enforce_shop_payment_state_for(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s record;
  v_changed text := null;
BEGIN
  SELECT id, shop_payment_status, first_deadline_at, second_deadline_at,
         COALESCE(commission_balance_due,0) AS due
    INTO s
    FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  IF s.shop_payment_status = 'payment_pending'
     AND s.first_deadline_at IS NOT NULL
     AND s.first_deadline_at < now()
     AND s.due > 0 THEN
    UPDATE public.shops
       SET shop_payment_status = 'locked',
           locked_at = now(),
           second_deadline_at = now() + interval '3 days',
           is_suspended = true,
           updated_at = now()
     WHERE id = _shop_id;
    INSERT INTO public.shop_payment_events(shop_id,event_type,note)
    VALUES (_shop_id,'locked','Verrouillage automatique (client trigger) après première échéance');
    v_changed := 'locked';
  ELSIF s.shop_payment_status = 'locked'
     AND s.second_deadline_at IS NOT NULL
     AND s.second_deadline_at < now()
     AND s.due > 0 THEN
    UPDATE public.shops
       SET shop_payment_status = 'final_suspension',
           final_suspension_at = now(),
           is_suspended = true,
           updated_at = now()
     WHERE id = _shop_id;
    INSERT INTO public.shop_payment_events(shop_id,event_type,note)
    VALUES (_shop_id,'final_suspension','Fermeture définitive (client trigger)');
    v_changed := 'final_suspension';
  END IF;

  RETURN jsonb_build_object('changed', v_changed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_shop_payment_state_for(uuid) TO anon, authenticated, service_role;
