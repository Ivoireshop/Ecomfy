
-- 1) Extend shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS shop_payment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS threshold_reached_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS second_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_suspension_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_payment_status_check'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_payment_status_check
      CHECK (shop_payment_status IN ('active','payment_pending','locked','final_suspension'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shops_payment_status ON public.shops(shop_payment_status);

-- Backfill from existing state
UPDATE public.shops
   SET shop_payment_status = 'final_suspension',
       locked_at = COALESCE(locked_at, updated_at),
       second_deadline_at = COALESCE(second_deadline_at, updated_at),
       final_suspension_at = COALESCE(final_suspension_at, updated_at)
 WHERE COALESCE(is_suspended,false) = true
   AND payment_deadline IS NOT NULL
   AND payment_deadline < now() - interval '3 days'
   AND shop_payment_status = 'active';

UPDATE public.shops
   SET shop_payment_status = 'locked',
       locked_at = COALESCE(locked_at, updated_at),
       second_deadline_at = COALESCE(second_deadline_at, updated_at + interval '3 days')
 WHERE COALESCE(is_suspended,false) = true
   AND shop_payment_status = 'active';

UPDATE public.shops
   SET shop_payment_status = 'payment_pending',
       first_deadline_at = COALESCE(first_deadline_at, payment_deadline),
       threshold_reached_at = COALESCE(threshold_reached_at, payment_deadline - interval '3 days')
 WHERE COALESCE(is_suspended,false) = false
   AND payment_deadline IS NOT NULL
   AND shop_payment_status = 'active'
   AND COALESCE(commission_balance_due,0) >= COALESCE(commission_threshold,12000);

-- 2) Events log
CREATE TABLE IF NOT EXISTS public.shop_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount numeric DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_payment_events TO authenticated;
GRANT ALL ON public.shop_payment_events TO service_role;
ALTER TABLE public.shop_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owner reads own payment events" ON public.shop_payment_events;
CREATE POLICY "Shop owner reads own payment events"
  ON public.shop_payment_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

DROP POLICY IF EXISTS "Founders manage payment events" ON public.shop_payment_events;
CREATE POLICY "Founders manage payment events"
  ON public.shop_payment_events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE INDEX IF NOT EXISTS idx_shop_payment_events_shop ON public.shop_payment_events(shop_id, created_at DESC);

-- 3) can_manage_shop
CREATE OR REPLACE FUNCTION public.can_manage_shop(_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id
      AND user_id = auth.uid()
      AND shop_payment_status IN ('active','payment_pending')
  ) OR public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'co_founder');
$$;

-- 4) Trigger to block writes when shop is locked / final_suspension
CREATE OR REPLACE FUNCTION public.enforce_shop_not_locked_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'co_founder') THEN
    RETURN NEW;
  END IF;
  SELECT shop_payment_status INTO v_status FROM public.shops WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);
  IF v_status IN ('locked','final_suspension') THEN
    RAISE EXCEPTION 'shop_locked_payment_required' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_lock_products ON public.products;
CREATE TRIGGER trg_enforce_lock_products
  BEFORE INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_not_locked_products();

-- Similar guard on shops table (owner cannot edit shop settings when locked)
CREATE OR REPLACE FUNCTION public.enforce_shop_not_locked_shops()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'co_founder') THEN
    RETURN NEW;
  END IF;
  IF OLD.shop_payment_status IN ('locked','final_suspension')
     AND NEW.shop_payment_status = OLD.shop_payment_status THEN
    -- only allow specific fields to move (balance, payment fields updated by SECURITY DEFINER)
    IF NEW.business_name IS DISTINCT FROM OLD.business_name
       OR NEW.business_description IS DISTINCT FROM OLD.business_description
       OR NEW.logo_url IS DISTINCT FROM OLD.logo_url
       OR NEW.theme_config IS DISTINCT FROM OLD.theme_config
       OR NEW.is_published IS DISTINCT FROM OLD.is_published THEN
      RAISE EXCEPTION 'shop_locked_payment_required' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_lock_shops ON public.shops;
CREATE TRIGGER trg_enforce_lock_shops
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_not_locked_shops();

-- 5) sync_shop_order_stats: also update payment status when threshold reached
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_shop_id uuid;
  v_per_order numeric;
  v_threshold numeric;
  v_new_balance numeric;
  v_current_deadline timestamptz;
  v_sub_until timestamptz;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN target_shop_id := OLD.shop_id; ELSE target_shop_id := NEW.shop_id; END IF;

  UPDATE shops SET
    total_orders = (SELECT COUNT(*) FROM orders WHERE shop_id = target_shop_id),
    total_sales = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE shop_id = target_shop_id),
    updated_at = now()
  WHERE id = target_shop_id;

  IF TG_OP = 'INSERT' THEN
    SELECT commission_per_order, commission_threshold, payment_deadline, subscription_active_until, shop_payment_status
      INTO v_per_order, v_threshold, v_current_deadline, v_sub_until, v_status
      FROM shops WHERE id = target_shop_id;

    IF v_sub_until IS NOT NULL AND v_sub_until > now() THEN
      RETURN NEW;
    END IF;

    UPDATE shops
      SET commission_balance_due = COALESCE(commission_balance_due, 0) + COALESCE(v_per_order, 50)
      WHERE id = target_shop_id
      RETURNING commission_balance_due INTO v_new_balance;

    IF v_new_balance >= COALESCE(v_threshold, 12000)
       AND v_current_deadline IS NULL
       AND v_status = 'active' THEN
      UPDATE shops
        SET payment_deadline = now() + interval '3 days',
            threshold_reached_at = now(),
            first_deadline_at = now() + interval '3 days',
            shop_payment_status = 'payment_pending'
        WHERE id = target_shop_id;

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (target_shop_id, 'threshold_reached', v_new_balance,
              'Seuil de 12 000 FCFA atteint - 3 jours pour régler');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- 6) apply_commission_payment: update status + log events
CREATE OR REPLACE FUNCTION public.apply_commission_payment(
  p_shop_id uuid,
  p_amount numeric,
  p_transaction_reference text,
  p_created_by uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay',
  p_notes text DEFAULT 'Paiement en ligne via GeniusPay'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop record;
  v_existing uuid;
  v_new_balance numeric;
  v_pct numeric;
  v_event text;
BEGIN
  IF p_shop_id IS NULL OR COALESCE(p_amount,0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  IF p_transaction_reference IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.commission_payments
      WHERE transaction_reference = p_transaction_reference LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id,
         COALESCE(commission_balance_due,0) AS balance,
         COALESCE(commission_threshold,12000) AS threshold,
         shop_payment_status
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_pct := CASE WHEN v_shop.threshold > 0 THEN p_amount / v_shop.threshold ELSE 0 END;
  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  IF v_new_balance <= 0 THEN
    UPDATE public.shops
       SET commission_balance_due = 0,
           payment_deadline = NULL,
           is_suspended = false,
           shop_payment_status = 'active',
           threshold_reached_at = NULL,
           first_deadline_at = NULL,
           locked_at = NULL,
           second_deadline_at = NULL,
           final_suspension_at = NULL,
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'paid_full';
  ELSIF v_pct >= 0.75 THEN
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           payment_deadline = now() + interval '3 days',
           first_deadline_at = now() + interval '3 days',
           second_deadline_at = NULL,
           locked_at = NULL,
           is_suspended = false,
           shop_payment_status = 'payment_pending',
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'payment_partial_75';
  ELSIF v_pct >= 0.50 THEN
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           payment_deadline = now() + interval '3 days',
           first_deadline_at = now() + interval '3 days',
           second_deadline_at = NULL,
           locked_at = NULL,
           is_suspended = false,
           shop_payment_status = 'payment_pending',
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'payment_partial_50';
  ELSE
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           updated_at = now()
     WHERE id = p_shop_id;
    v_event := 'payment_small';
  END IF;

  INSERT INTO public.commission_payments (shop_id, amount, payment_method, transaction_reference, status, created_by, notes)
  VALUES (p_shop_id, p_amount, COALESCE(NULLIF(p_payment_method,''),'geniuspay'), p_transaction_reference, 'paid', p_created_by, p_notes)
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;

  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note, created_by)
  VALUES (p_shop_id, v_event, p_amount, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'event', v_event);
END $$;

-- 7) enforce_shop_payment_state (cron)
CREATE OR REPLACE FUNCTION public.enforce_shop_payment_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_locked int := 0;
  v_final int := 0;
  r record;
BEGIN
  -- payment_pending -> locked
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

  -- locked -> final_suspension
  FOR r IN
    SELECT id FROM public.shops
     WHERE shop_payment_status = 'locked'
       AND second_deadline_at IS NOT NULL
       AND second_deadline_at < now()
       AND COALESCE(commission_balance_due,0) > 0
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
END $$;

-- 8) Founder-only manual reactivate
CREATE OR REPLACE FUNCTION public.founder_reset_shop_payment(_shop_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'co_founder')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.shops
     SET commission_balance_due = 0,
         payment_deadline = NULL,
         is_suspended = false,
         shop_payment_status = 'active',
         threshold_reached_at = NULL,
         first_deadline_at = NULL,
         locked_at = NULL,
         second_deadline_at = NULL,
         final_suspension_at = NULL,
         updated_at = now()
   WHERE id = _shop_id;
  UPDATE public.orders SET received_during_lock = false
    WHERE shop_id = _shop_id AND received_during_lock = true;
  INSERT INTO public.shop_payment_events(shop_id,event_type,note,created_by)
  VALUES (_shop_id,'manual_override', COALESCE(_reason,'Réactivation manuelle par le fondateur'), auth.uid());
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.founder_reset_shop_payment(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_reset_shop_payment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_shop_payment_state() TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_shop(uuid) TO authenticated, anon;
