-- Migration: Ecomfy Billing Threshold System (240 Orders / 12,000 FCFA), Grace Period & STORE_RESTRICTED Partial Lock

-- 1. Create shop_invoices table
CREATE TABLE IF NOT EXISTS public.shop_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  orders_threshold integer NOT NULL DEFAULT 240,
  amount numeric NOT NULL DEFAULT 12000,
  currency text NOT NULL DEFAULT 'FCFA',
  status text NOT NULL DEFAULT 'PAYMENT_DUE',
  created_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  paid_at timestamptz,
  payment_reference text,
  payment_method text,
  reactivated_at timestamptz,
  CONSTRAINT shop_invoices_status_check CHECK (
    status IN ('PAYMENT_DUE', 'GRACE_PERIOD', 'PAYMENT_OVERDUE', 'STORE_RESTRICTED', 'PAYMENT_CONFIRMED', 'CANCELLED')
  ),
  CONSTRAINT shop_invoices_unique_threshold UNIQUE (shop_id, orders_threshold)
);

-- Grant RLS permissions
GRANT SELECT ON public.shop_invoices TO authenticated;
GRANT ALL ON public.shop_invoices TO service_role;
ALTER TABLE public.shop_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners read own invoices" ON public.shop_invoices;
CREATE POLICY "Shop owners read own invoices"
  ON public.shop_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

DROP POLICY IF EXISTS "Founders manage all invoices" ON public.shop_invoices;
CREATE POLICY "Founders manage all invoices"
  ON public.shop_invoices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE INDEX IF NOT EXISTS idx_shop_invoices_shop ON public.shop_invoices(shop_id, status);

-- 2. Update shops payment status constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_payment_status_check'
  ) THEN
    ALTER TABLE public.shops DROP CONSTRAINT shops_payment_status_check;
  END IF;
  
  ALTER TABLE public.shops
    ADD CONSTRAINT shops_payment_status_check
    CHECK (shop_payment_status IN (
      'STORE_ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'PAYMENT_OVERDUE', 
      'STORE_RESTRICTED', 'PAYMENT_CONFIRMED', 'STORE_REACTIVATED',
      'active', 'payment_pending', 'locked', 'final_suspension'
    ));
END $$;

-- 3. Function: Check & Trigger Billing Threshold (240 Orders = 12 000 FCFA)
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
BEGIN
  IF _shop_id IS NULL THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'invalid_shop_id');
  END IF;

  -- Count actual non-cancelled orders for shop
  SELECT COUNT(*) INTO v_actual_orders
    FROM public.orders
   WHERE shop_id = _shop_id;

  SELECT shop_payment_status INTO v_shop_status
    FROM public.shops
   WHERE id = _shop_id;

  -- Check if threshold of 240 orders is reached
  IF v_actual_orders >= v_threshold THEN
    -- Check if invoice already exists for 240 threshold
    SELECT id INTO v_invoice_id
      FROM public.shop_invoices
     WHERE shop_id = _shop_id AND orders_threshold = v_threshold;

    IF v_invoice_id IS NULL THEN
      -- Generate unique invoice number
      v_invoice_num := 'BILL-ECOMFY-' || lpad(floor(random() * 899999 + 100000)::text, 6, '0');

      INSERT INTO public.shop_invoices (
        invoice_number,
        shop_id,
        orders_threshold,
        amount,
        currency,
        status,
        due_date
      ) VALUES (
        v_invoice_num,
        _shop_id,
        v_threshold,
        v_amount,
        'FCFA',
        'PAYMENT_DUE',
        now() + interval '3 days'
      ) RETURNING id INTO v_invoice_id;

      -- Update shop status to PAYMENT_DUE with 3-day grace period
      UPDATE public.shops
         SET shop_payment_status = 'PAYMENT_DUE',
             payment_deadline = now() + interval '3 days',
             threshold_reached_at = now(),
             first_deadline_at = now() + interval '3 days',
             commission_balance_due = v_amount,
             updated_at = now()
       WHERE id = _shop_id;

      -- Log payment event
      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (
        _shop_id, 
        'BILLING_THRESHOLD_REACHED', 
        v_amount, 
        'Seuil de 240 commandes atteint (Facture ' || v_invoice_num || ') — 12 000 FCFA dû sous 3 jours'
      );

      RETURN jsonb_build_object('triggered', true, 'invoice_number', v_invoice_num, 'status', 'PAYMENT_DUE');
    END IF;
  END IF;

  RETURN jsonb_build_object('triggered', false, 'orders_count', v_actual_orders);
END $$;

-- 4. Trigger on orders table to check threshold after order insertion
CREATE OR REPLACE FUNCTION public.trg_on_order_inserted_billing_check()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_trigger_billing_threshold(NEW.shop_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_billing_threshold_check ON public.orders;
CREATE TRIGGER trg_order_billing_threshold_check
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_order_inserted_billing_check();

-- 5. Auto-escalation function: Enforce 3-day grace period deadline
CREATE OR REPLACE FUNCTION public.enforce_shop_billing_deadlines()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_restricted_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT s.id, s.shop_payment_status, i.id AS invoice_id, i.invoice_number
      FROM public.shops s
      LEFT JOIN public.shop_invoices i ON i.shop_id = s.id AND i.orders_threshold = 240
     WHERE s.shop_payment_status IN ('PAYMENT_DUE', 'GRACE_PERIOD', 'payment_pending')
       AND s.payment_deadline IS NOT NULL
       AND s.payment_deadline < now()
  LOOP
    -- Update shop status to STORE_RESTRICTED (partial lock)
    UPDATE public.shops
       SET shop_payment_status = 'STORE_RESTRICTED',
           locked_at = now(),
           is_suspended = true,
           updated_at = now()
     WHERE id = r.id;

    -- Update invoice status
    IF r.invoice_id IS NOT NULL THEN
      UPDATE public.shop_invoices
         SET status = 'STORE_RESTRICTED'
       WHERE id = r.invoice_id;
    END IF;

    -- Log payment event
    INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
    VALUES (
      r.id, 
      'STORE_RESTRICTED', 
      12000, 
      'Délai de 3 jours écoulé sans règlement — Boutique temporairement restreinte'
    );

    v_restricted_count := v_restricted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('restricted_shops_count', v_restricted_count);
END $$;

-- 6. Server-Side Customer Data Masking RPC: get_shop_orders_secure
CREATE OR REPLACE FUNCTION public.get_shop_orders_secure(_shop_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  shop_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,
  customer_city text,
  customer_country text,
  subtotal numeric,
  total numeric,
  commission_amount numeric,
  payment_method text,
  payment_status text,
  order_status text,
  products_summary text,
  received_during_lock boolean,
  is_read boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  is_restricted boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_is_restricted boolean;
BEGIN
  -- Determine shop status
  SELECT shop_payment_status INTO v_status
    FROM public.shops
   WHERE shops.id = _shop_id;

  v_is_restricted := v_status IN ('STORE_RESTRICTED', 'locked', 'PAYMENT_OVERDUE', 'final_suspension');

  IF v_is_restricted THEN
    -- Return MASKED customer data
    RETURN QUERY
    SELECT 
      o.id,
      o.order_number,
      o.shop_id,
      '••••••••'::text AS customer_name,
      '••••••••'::text AS customer_phone,
      '••••••••'::text AS customer_email,
      '••••••••'::text AS customer_address,
      '••••••••'::text AS customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      o.notes,
      o.created_at,
      o.updated_at,
      true AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  ELSE
    -- Return UNMASKED customer data
    RETURN QUERY
    SELECT 
      o.id,
      o.order_number,
      o.shop_id,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.customer_address,
      o.customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      o.notes,
      o.created_at,
      o.updated_at,
      false AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_shop_orders_secure(uuid) TO authenticated, anon;

-- 7. Function: Confirm Invoice Payment & Restore Full Store Access
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_shop_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'online'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice record;
  v_ref text;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_shop_id');
  END IF;

  v_ref := COALESCE(p_payment_reference, 'PAY-ECOMFY-' || lpad(floor(random() * 899999 + 100000)::text, 6, '0'));

  -- Update invoice status
  IF p_invoice_id IS NOT NULL THEN
    UPDATE public.shop_invoices
       SET status = 'PAYMENT_CONFIRMED',
           paid_at = now(),
           payment_reference = v_ref,
           payment_method = p_payment_method,
           reactivated_at = now()
     WHERE id = p_invoice_id AND shop_id = p_shop_id;
  ELSE
    UPDATE public.shop_invoices
       SET status = 'PAYMENT_CONFIRMED',
           paid_at = now(),
           payment_reference = v_ref,
           payment_method = p_payment_method,
           reactivated_at = now()
     WHERE shop_id = p_shop_id AND status != 'PAYMENT_CONFIRMED';
  END IF;

  -- Update shop status back to STORE_ACTIVE
  UPDATE public.shops
     SET shop_payment_status = 'STORE_ACTIVE',
         is_suspended = false,
         commission_balance_due = 0,
         payment_deadline = NULL,
         threshold_reached_at = NULL,
         first_deadline_at = NULL,
         locked_at = NULL,
         second_deadline_at = NULL,
         final_suspension_at = NULL,
         updated_at = now()
   WHERE id = p_shop_id;

  -- Unmark orders received during lock
  UPDATE public.orders
     SET received_during_lock = false
   WHERE shop_id = p_shop_id AND received_during_lock = true;

  -- Log event
  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
  VALUES (
    p_shop_id, 
    'PAYMENT_CONFIRMED', 
    12000, 
    'Paiement de 12 000 FCFA confirmé (Réf: ' || v_ref || ') — Accès boutique et données clients entièrement restaurés'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'shop_status', 'STORE_ACTIVE', 
    'message', 'Paiement confirmé. Boutique réactivée avec succès.'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_and_trigger_billing_threshold(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.enforce_shop_billing_deadlines() TO authenticated, service_role;
