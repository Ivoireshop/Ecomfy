
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS extra_deadline_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_deadline_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_deadline_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_deadline_granted_by uuid;

-- Update enforce functions to respect extra deadline (skip locked->final_suspension while active & not expired)
CREATE OR REPLACE FUNCTION public.enforce_shop_payment_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_locked int := 0;
  v_final int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.shops
     WHERE shop_payment_status = 'payment_pending'
       AND first_deadline_at IS NOT NULL
       AND first_deadline_at < now()
       AND COALESCE(commission_balance_due,0) > 0
  LOOP
    UPDATE public.shops
       SET shop_payment_status = 'locked',
           locked_at = now(),
           second_deadline_at = now() + interval '3 days',
           is_suspended = true,
           updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.shop_payment_events(shop_id,event_type,note)
    VALUES (r.id,'locked','Verrouillage automatique après première échéance');
    v_locked := v_locked + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM public.shops
     WHERE shop_payment_status = 'locked'
       AND second_deadline_at IS NOT NULL
       AND second_deadline_at < now()
       AND COALESCE(commission_balance_due,0) > 0
       AND NOT (
         COALESCE(extra_deadline_active,false) = true
         AND extra_deadline_ends_at IS NOT NULL
         AND extra_deadline_ends_at > now()
       )
  LOOP
    UPDATE public.shops
       SET shop_payment_status = 'final_suspension',
           final_suspension_at = now(),
           is_suspended = true,
           updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.shop_payment_events(shop_id,event_type,note)
    VALUES (r.id,'final_suspension','Fermeture définitive - contact support requis');
    v_final := v_final + 1;
  END LOOP;

  RETURN jsonb_build_object('locked', v_locked, 'final_suspension', v_final);
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_shop_payment_state_for(_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  v_changed text := null;
BEGIN
  SELECT id, shop_payment_status, first_deadline_at, second_deadline_at,
         COALESCE(commission_balance_due,0) AS due,
         COALESCE(extra_deadline_active,false) AS xa,
         extra_deadline_ends_at AS xe
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
     AND s.due > 0
     AND NOT (s.xa = true AND s.xe IS NOT NULL AND s.xe > now()) THEN
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
END $function$;

-- Founder-only: grant an extra grace period (keeps shop locked, blocks final suspension)
CREATE OR REPLACE FUNCTION public.founder_grant_extra_deadline(_shop_id uuid, _days integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_founder boolean;
  v_ends timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role IN ('founder','co_founder')
  ) INTO v_is_founder;
  IF NOT v_is_founder THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_ends := now() + make_interval(days => GREATEST(_days, 1));

  UPDATE public.shops
     SET shop_payment_status = CASE
           WHEN shop_payment_status = 'final_suspension' THEN 'locked'
           WHEN shop_payment_status = 'active' THEN 'locked'
           ELSE shop_payment_status
         END,
         is_suspended = true,
         locked_at = COALESCE(locked_at, now()),
         second_deadline_at = v_ends,
         final_suspension_at = NULL,
         extra_deadline_active = true,
         extra_deadline_started_at = now(),
         extra_deadline_ends_at = v_ends,
         extra_deadline_granted_by = v_uid,
         updated_at = now()
   WHERE id = _shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.shop_payment_events(shop_id, event_type, note, created_by)
  VALUES (_shop_id, 'manual_override',
          'Délai supplémentaire accordé (' || _days || ' jour(s)) — expire le ' ||
          to_char(v_ends AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
          v_uid);

  RETURN jsonb_build_object('success', true, 'ends_at', v_ends);
END $$;

GRANT EXECUTE ON FUNCTION public.founder_grant_extra_deadline(uuid, integer) TO authenticated;
