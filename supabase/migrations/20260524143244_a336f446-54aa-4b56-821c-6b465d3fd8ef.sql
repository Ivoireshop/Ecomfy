
-- 1) Add subscription columns to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz NULL;

-- 2) Replace sync_shop_order_stats to skip commission when subscription is active
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_shop_id uuid;
  v_per_order numeric;
  v_threshold numeric;
  v_new_balance numeric;
  v_current_deadline timestamptz;
  v_sub_until timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_shop_id := OLD.shop_id;
  ELSE
    target_shop_id := NEW.shop_id;
  END IF;

  UPDATE shops SET
    total_orders = (SELECT COUNT(*) FROM orders WHERE shop_id = target_shop_id),
    total_sales = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE shop_id = target_shop_id),
    updated_at = now()
  WHERE id = target_shop_id;

  IF TG_OP = 'INSERT' THEN
    SELECT commission_per_order, commission_threshold, payment_deadline, subscription_active_until
      INTO v_per_order, v_threshold, v_current_deadline, v_sub_until
      FROM shops WHERE id = target_shop_id;

    -- Skip commission accrual if active subscription
    IF v_sub_until IS NOT NULL AND v_sub_until > now() THEN
      RETURN NEW;
    END IF;

    UPDATE shops
      SET commission_balance_due = COALESCE(commission_balance_due, 0) + COALESCE(v_per_order, 50)
      WHERE id = target_shop_id
      RETURNING commission_balance_due INTO v_new_balance;

    IF v_new_balance >= COALESCE(v_threshold, 12000) AND v_current_deadline IS NULL THEN
      UPDATE shops
        SET payment_deadline = now() + interval '3 days'
        WHERE id = target_shop_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) RPC to apply a subscription payment
CREATE OR REPLACE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid,
  p_user_id uuid,
  p_plan text,
  p_amount numeric,
  p_transaction_reference text,
  p_payment_method text DEFAULT 'geniuspay'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shop record;
  v_existing uuid;
  v_new_until timestamptz;
  v_started timestamptz;
BEGIN
  IF p_shop_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  IF p_plan NOT IN ('starter','business','premium') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;
  IF p_transaction_reference IS NULL OR btrim(p_transaction_reference) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_reference');
  END IF;

  -- Idempotency by reference
  SELECT id INTO v_existing
    FROM public.commission_payments
    WHERE transaction_reference = p_transaction_reference
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_applied', true);
  END IF;

  SELECT id, subscription_active_until, subscription_started_at
    INTO v_shop FROM public.shops
    WHERE id = p_shop_id AND user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- Extend by 30 days, cumulative if still active
  IF v_shop.subscription_active_until IS NOT NULL AND v_shop.subscription_active_until > now() THEN
    v_new_until := v_shop.subscription_active_until + interval '30 days';
  ELSE
    v_new_until := now() + interval '30 days';
  END IF;

  v_started := COALESCE(v_shop.subscription_started_at, now());

  UPDATE public.shops
    SET subscription_plan = p_plan,
        subscription_started_at = v_started,
        subscription_active_until = v_new_until,
        -- Clear pending commission obligations: subscriber pays flat monthly
        commission_balance_due = 0,
        payment_deadline = NULL,
        is_suspended = false,
        updated_at = now()
    WHERE id = p_shop_id;

  INSERT INTO public.commission_payments (
    shop_id, amount, payment_method, transaction_reference, status, created_by, notes
  ) VALUES (
    p_shop_id, COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_payment_method,''),'geniuspay'),
    p_transaction_reference, 'paid', p_user_id,
    'Abonnement ' || p_plan || ' mensuel'
  )
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'plan', p_plan,
    'active_until', v_new_until
  );
END;
$function$;
