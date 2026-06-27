
-- 1) Public visibility no longer depends on is_suspended.
-- A locked shop (unpaid commission) must keep selling: public pages, ads, checkout,
-- order INSERTs must all continue to work. Only the seller's dashboard is locked.
CREATE OR REPLACE FUNCTION public.is_shop_publicly_visible(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id
      AND is_published = true
      AND is_activated = true
  );
$$;

-- 2) Track which orders arrived while the seller dashboard was locked.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS received_during_lock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at_order_time timestamptz;

CREATE OR REPLACE FUNCTION public.tag_order_received_during_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_locked boolean;
BEGIN
  SELECT COALESCE(is_suspended, false) INTO v_locked
    FROM public.shops WHERE id = NEW.shop_id;
  IF v_locked THEN
    NEW.received_during_lock := true;
    NEW.locked_at_order_time := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tag_order_received_during_lock ON public.orders;
CREATE TRIGGER trg_tag_order_received_during_lock
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tag_order_received_during_lock();

-- 3) Server-side protection: when shop is suspended, owners/collaborators can no
-- longer SELECT order rows directly. They must go through the redacted summary RPC.
DROP POLICY IF EXISTS "Shop owners can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can view orders unlocked" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can modify orders" ON public.orders;
DROP POLICY IF EXISTS "Collaborators can view shop orders" ON public.orders;
DROP POLICY IF EXISTS "Collaborators can view shop orders unlocked" ON public.orders;

CREATE POLICY "Shop owners can view orders unlocked"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id
      AND s.user_id = auth.uid()
      AND COALESCE(s.is_suspended, false) = false
  )
);

CREATE POLICY "Shop owners can modify orders"
ON public.orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Shop owners can delete orders"
ON public.orders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Collaborators can view shop orders unlocked"
ON public.orders FOR SELECT
USING (
  (public.has_shop_role(shop_id, auth.uid(), 'view_orders'::shop_collab_role)
   OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'::shop_collab_role))
  AND EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id AND COALESCE(s.is_suspended, false) = false
  )
);

-- 4) Same protection for order_items.
DROP POLICY IF EXISTS "Shop owners can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Shop owners can view order items unlocked" ON public.order_items;

CREATE POLICY "Shop owners can view order items unlocked"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id
      AND s.user_id = auth.uid()
      AND COALESCE(s.is_suspended, false) = false
  )
);

CREATE POLICY "Shop owners can modify order items"
ON public.order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Shop owners can delete order items"
ON public.order_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id AND s.user_id = auth.uid()
  )
);

-- 5) Redacted summary the locked dashboard can read.
CREATE OR REPLACE FUNCTION public.get_locked_orders_summary(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
  v_shop record;
  v_locked_count integer;
  v_locked_total numeric;
  v_per_order numeric;
  v_locked_commission numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT (user_id = auth.uid()) INTO v_is_owner
    FROM public.shops WHERE id = _shop_id;
  IF v_is_owner IS NOT TRUE THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT id,
         COALESCE(is_suspended,false) AS is_suspended,
         COALESCE(commission_balance_due,0) AS balance_due,
         COALESCE(commission_threshold,12000) AS threshold,
         COALESCE(commission_per_order,50) AS per_order,
         payment_deadline,
         updated_at
    INTO v_shop
    FROM public.shops WHERE id = _shop_id;

  SELECT COUNT(*), COALESCE(SUM(total),0)
    INTO v_locked_count, v_locked_total
    FROM public.orders
    WHERE shop_id = _shop_id AND received_during_lock = true;

  v_per_order := COALESCE(v_shop.per_order, 50);
  v_locked_commission := v_locked_count * v_per_order;

  RETURN jsonb_build_object(
    'is_suspended', v_shop.is_suspended,
    'balance_due', v_shop.balance_due,
    'threshold', v_shop.threshold,
    'commission_per_order', v_per_order,
    'payment_deadline', v_shop.payment_deadline,
    'locked_orders_count', v_locked_count,
    'locked_orders_total', v_locked_total,
    'locked_commission_added', v_locked_commission
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_locked_orders_summary(uuid) TO authenticated;

-- 6) When commission is fully paid, unlock the shop AND clear the locked tag on past orders.
CREATE OR REPLACE FUNCTION public.apply_commission_payment(
  p_shop_id uuid,
  p_amount numeric,
  p_transaction_reference text,
  p_created_by uuid DEFAULT NULL::uuid,
  p_payment_method text DEFAULT 'geniuspay'::text,
  p_notes text DEFAULT 'Paiement en ligne via GeniusPay'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shop record;
  v_existing uuid;
  v_new_balance numeric;
BEGIN
  IF p_shop_id IS NULL OR COALESCE(p_amount,0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  IF p_transaction_reference IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM public.commission_payments
      WHERE transaction_reference = p_transaction_reference LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id, COALESCE(commission_balance_due,0) AS balance,
         COALESCE(commission_threshold,12000) AS threshold
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  UPDATE public.shops
     SET commission_balance_due = v_new_balance,
         payment_deadline = CASE WHEN v_new_balance < v_shop.threshold THEN NULL ELSE payment_deadline END,
         is_suspended = CASE WHEN v_new_balance <= 0 THEN false
                             WHEN v_new_balance < v_shop.threshold THEN false
                             ELSE is_suspended END,
         updated_at = now()
   WHERE id = p_shop_id;

  -- Once balance is settled, reveal previously locked orders to the seller.
  IF v_new_balance <= 0 THEN
    UPDATE public.orders
       SET received_during_lock = false
     WHERE shop_id = p_shop_id AND received_during_lock = true;
  END IF;

  INSERT INTO public.commission_payments (shop_id, amount, payment_method, transaction_reference, status, created_by, notes)
  VALUES (p_shop_id, p_amount, COALESCE(NULLIF(p_payment_method,''),'geniuspay'), p_transaction_reference, 'paid', p_created_by, p_notes)
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
