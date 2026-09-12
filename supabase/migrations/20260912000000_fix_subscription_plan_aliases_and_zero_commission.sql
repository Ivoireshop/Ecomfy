-- Migration: Fix Subscription Plan Aliases & Strict Zero Commission for Subscribed Shops
-- Ensures that ANY active paid subscription (pro_monthly, premium_academy_pro, starter, business, premium, annual)
-- waives the 50 FCFA per order commission completely (0 FCFA commission), while $2 activation without subscription
-- continues standard commission rules.

-- 1. Ensure columns exist on public.shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_subscribed boolean DEFAULT false;

-- 2. Helper function to check if a shop has an active paid subscription
CREATE OR REPLACE FUNCTION public.is_shop_subscription_active(p_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan text;
  v_until timestamptz;
  v_is_sub boolean;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT subscription_plan, subscription_active_until, COALESCE(is_subscribed, false)
    INTO v_plan, v_until, v_is_sub
    FROM public.shops
   WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Plan is active if active_until is in the future OR is_subscribed is true AND plan is not free/starter_free
  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN true;
  END IF;

  IF v_is_sub = true AND v_plan NOT IN ('free', 'starter_free') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3. Robust apply_shop_subscription RPC supporting all plan aliases
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

-- 4. Update sync_shop_order_stats to strictly skip 50 FCFA commission for active subscribers
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
  v_sub_plan text;
  v_is_sub boolean;
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
    SELECT commission_per_order, commission_threshold, payment_deadline,
           subscription_active_until, subscription_plan, COALESCE(is_subscribed, false)
      INTO v_per_order, v_threshold, v_current_deadline,
           v_sub_until, v_sub_plan, v_is_sub
      FROM shops WHERE id = target_shop_id;

    -- STRICT RULE: Skip 50 FCFA commission accrual if shop has active paid subscription
    IF (v_sub_until IS NOT NULL AND v_sub_until > now()) 
       OR (v_is_sub = true AND COALESCE(v_sub_plan, 'free') NOT IN ('free', 'starter_free')) THEN
      -- Keep balance at 0 for subscribers
      UPDATE shops SET commission_balance_due = 0, commission_rate = 0 WHERE id = target_shop_id;
      RETURN NEW;
    END IF;

    -- Apply standard 50 FCFA commission for non-subscribed shops
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

-- 5. Update check_and_trigger_billing_threshold to bypass 12 000 FCFA threshold invoice for subscribers
CREATE OR REPLACE FUNCTION public.check_and_trigger_billing_threshold(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actual_orders int;
  v_shop_status text;
  v_invoice_id uuid;
  v_invoice_num text;
  v_threshold int := 240;
  v_amount numeric := 12000;
  v_sub_until timestamptz;
  v_sub_plan text;
  v_is_sub boolean;
BEGIN
  IF _shop_id IS NULL THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'invalid_shop_id');
  END IF;

  SELECT shop_payment_status, subscription_active_until, subscription_plan, COALESCE(is_subscribed, false)
    INTO v_shop_status, v_sub_until, v_sub_plan, v_is_sub
    FROM public.shops
   WHERE id = _shop_id;

  -- Bypass threshold billing if shop has active subscription!
  IF (v_sub_until IS NOT NULL AND v_sub_until > now()) 
     OR (v_is_sub = true AND COALESCE(v_sub_plan, 'free') NOT IN ('free', 'starter_free')) THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'active_subscription');
  END IF;

  -- Count actual non-cancelled orders for shop
  SELECT COUNT(*) INTO v_actual_orders
    FROM public.orders
   WHERE shop_id = _shop_id;

  -- Check if threshold of 240 orders is reached
  IF v_actual_orders >= v_threshold THEN
    SELECT id INTO v_invoice_id
      FROM public.shop_invoices
     WHERE shop_id = _shop_id AND orders_threshold = v_threshold;

    IF v_invoice_id IS NULL THEN
      v_invoice_num := 'BILL-ECOMFY-' || lpad(floor(random() * 899999 + 100000)::text, 6, '0');

      INSERT INTO public.shop_invoices (
        invoice_number, shop_id, orders_threshold, amount, currency, status, due_date
      ) VALUES (
        v_invoice_num, _shop_id, v_threshold, v_amount, 'FCFA', 'PAYMENT_DUE', now() + interval '3 days'
      ) RETURNING id INTO v_invoice_id;

      UPDATE public.shops
         SET shop_payment_status = 'PAYMENT_DUE',
             payment_deadline = now() + interval '3 days',
             threshold_reached_at = now(),
             first_deadline_at = now() + interval '3 days',
             commission_balance_due = v_amount,
             updated_at = now()
       WHERE id = _shop_id;

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (_shop_id, 'BILLING_THRESHOLD_REACHED', v_amount, 'Seuil de 240 commandes atteint');

      RETURN jsonb_build_object('triggered', true, 'invoice_number', v_invoice_num, 'status', 'PAYMENT_DUE');
    END IF;
  END IF;

  RETURN jsonb_build_object('triggered', false, 'orders_count', v_actual_orders);
END $$;

-- 6. Update recompute_order_totals to ensure 0 FCFA order commission for active subscribers
CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
  v_rate numeric;
  v_sub_until timestamptz;
  v_sub_plan text;
  v_is_sub boolean;
  v_commission_amount numeric := 0;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = v_order_id;

  SELECT COALESCE(s.commission_rate, 0.025), s.subscription_active_until, s.subscription_plan, COALESCE(s.is_subscribed, false)
    INTO v_rate, v_sub_until, v_sub_plan, v_is_sub
    FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
   WHERE o.id = v_order_id;

  -- If shop has an active paid subscription => Commission is ALWAYS 0 FCFA!
  IF (v_sub_until IS NOT NULL AND v_sub_until > now()) 
     OR (v_is_sub = true AND COALESCE(v_sub_plan, 'free') NOT IN ('free', 'starter_free'))
     OR v_rate = 0 THEN
    v_commission_amount := 0;
  ELSE
    v_commission_amount := ROUND(v_subtotal * COALESCE(v_rate, 0.025), 2);
  END IF;

  UPDATE public.orders
    SET subtotal = v_subtotal,
        total = v_subtotal,
        commission_amount = v_commission_amount,
        updated_at = now()
    WHERE id = v_order_id;

  RETURN NULL;
END $$;

-- 7. Synchronize existing user subscriptions to shops
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT s.user_id, s.plan, s.end_date
      FROM public.subscriptions s
     WHERE s.status = 'active' AND (s.end_date IS NULL OR s.end_date > now())
  LOOP
    UPDATE public.shops
       SET subscription_plan = LOWER(r.plan),
           subscription_active_until = COALESCE(r.end_date, now() + interval '30 days'),
           is_subscribed = true,
           commission_rate = 0,
           commission_balance_due = 0,
           payment_deadline = NULL
     WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 8. Clean up commission on orders for shops with active subscription
UPDATE public.orders o
   SET commission_amount = 0
  FROM public.shops s
 WHERE o.shop_id = s.id
   AND (
     (s.subscription_active_until IS NOT NULL AND s.subscription_active_until > now())
     OR (s.is_subscribed = true AND s.subscription_plan NOT IN ('free', 'starter_free'))
   );
