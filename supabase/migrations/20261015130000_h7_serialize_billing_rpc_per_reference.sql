-- H7 : sérialise apply_shop_subscription et apply_commission_payment par référence de transaction.
--
-- Le test d'idempotence (lecture de commission_payments) était fait AVANT le verrou sur la boutique
-- et la trace n'était insérée qu'à la fin. Deux appels simultanés (geniuspay-webhook, verify-payment,
-- reconcile-pending-payments) passaient donc tous deux le test : abonnement prolongé deux fois,
-- montant déduit deux fois du solde de commission.
--
-- Un verrou consultatif transactionnel par référence force le second appel à attendre la fin du
-- premier ; il relit alors la trace insérée et sort en « already_applied ».
-- Corps des fonctions identique aux dernières versions (20260912000000 et 20261012120000),
-- seul l'ajout du pg_advisory_xact_lock change. Les GRANT/REVOKE existants sont conservés.

-- ====================================================================
-- apply_shop_subscription
-- ====================================================================
CREATE OR REPLACE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_plan text DEFAULT 'pro_monthly',
  p_amount numeric DEFAULT 0,
  p_transaction_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_shop_id uuid;
  v_shop record;
  v_existing uuid;
  v_new_until timestamptz;
  v_started timestamptz;
  v_normalized_plan text;
  v_duration_interval interval := interval '30 days';
BEGIN
  IF p_shop_id IS NULL AND p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_user_and_shop_id');
  END IF;

  -- Sérialise les appels concurrents portant sur la même référence (relâché au COMMIT)
  IF p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('apply_billing:' || p_transaction_reference));
  END IF;

  -- Normalize plan name
  v_normalized_plan := LOWER(COALESCE(p_plan, 'pro_monthly'));

  -- Determine duration
  IF v_normalized_plan LIKE '%annual%' OR v_normalized_plan LIKE '%year%' THEN
    v_duration_interval := interval '365 days';
  END IF;

  -- Resolve shop_id if missing
  v_target_shop_id := p_shop_id;
  IF v_target_shop_id IS NULL AND p_user_id IS NOT NULL THEN
    SELECT id INTO v_target_shop_id
      FROM public.shops
     WHERE user_id = p_user_id
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  -- Check idempotency by reference if provided
  IF p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '' THEN
    SELECT id INTO v_existing
      FROM public.commission_payments
     WHERE transaction_reference = p_transaction_reference
     LIMIT 1;

    IF v_existing IS NOT NULL AND v_target_shop_id IS NOT NULL THEN
      -- Ensure shop is marked active even on duplicate call
      UPDATE public.shops
         SET subscription_plan = v_normalized_plan,
             is_subscribed = true,
             commission_rate = 0,
             commission_balance_due = 0,
             payment_deadline = NULL,
             is_suspended = false,
             updated_at = now()
       WHERE id = v_target_shop_id;

      RETURN jsonb_build_object('success', true, 'already_applied', true, 'shop_id', v_target_shop_id);
    END IF;
  END IF;

  IF v_target_shop_id IS NOT NULL THEN
    SELECT id, subscription_active_until, subscription_started_at
      INTO v_shop FROM public.shops
     WHERE id = v_target_shop_id
     FOR UPDATE;
  END IF;

  IF v_shop.id IS NOT NULL THEN
    -- Extend subscription cumulative if still active
    IF v_shop.subscription_active_until IS NOT NULL AND v_shop.subscription_active_until > now() THEN
      v_new_until := v_shop.subscription_active_until + v_duration_interval;
    ELSE
      v_new_until := now() + v_duration_interval;
    END IF;

    v_started := COALESCE(v_shop.subscription_started_at, now());

    UPDATE public.shops
       SET subscription_plan = v_normalized_plan,
           subscription_started_at = v_started,
           subscription_active_until = v_new_until,
           is_subscribed = true,
           commission_rate = 0,
           commission_balance_due = 0,
           payment_deadline = NULL,
           is_suspended = false,
           updated_at = now()
     WHERE id = v_target_shop_id;

    IF p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '' THEN
      INSERT INTO public.commission_payments (
        shop_id, amount, payment_method, transaction_reference, status, created_by, notes
      ) VALUES (
        v_target_shop_id, COALESCE(p_amount, 0),
        COALESCE(NULLIF(p_payment_method,''),'geniuspay'),
        p_transaction_reference, 'paid', COALESCE(p_user_id, v_shop.id),
        'Abonnement ' || v_normalized_plan
      )
      ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- Also sync subscriptions table for user-level access
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, status, plan, amount, start_date, end_date, created_at, updated_at
    ) VALUES (
      p_user_id, 'active', v_normalized_plan, COALESCE(p_amount, 0),
      now(), COALESCE(v_new_until, now() + v_duration_interval), now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
       SET status = 'active',
           plan = v_normalized_plan,
           amount = EXCLUDED.amount,
           start_date = now(),
           end_date = COALESCE(v_new_until, now() + v_duration_interval),
           updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_normalized_plan,
    'shop_id', v_target_shop_id,
    'active_until', COALESCE(v_new_until, now() + v_duration_interval)
  );
END;
$$;

-- ====================================================================
-- apply_commission_payment
-- ====================================================================
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
  -- Garde d'accès : service_role, connexion directe ou fondateur uniquement
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role::text IN ('founder', 'co_founder')
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_shop_id IS NULL OR COALESCE(p_amount,0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  IF p_transaction_reference IS NOT NULL THEN
    -- Sérialise les appels concurrents portant sur la même référence (relâché au COMMIT)
    PERFORM pg_advisory_xact_lock(hashtext('apply_billing:' || p_transaction_reference));

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

-- Droits (audit C2, migration 20261012130000) : service_role uniquement. CREATE OR REPLACE les
-- conserve ; rappel idempotent pour ne jamais rouvrir ces fonctions.
REVOKE ALL ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  TO service_role;
