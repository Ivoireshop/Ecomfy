-- Migration: Zero Commission (0 FCFA) for Subscribed / Paid Plan Shops in Ecomfy

-- 1. Ensure columns exist on public.shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_subscribed boolean DEFAULT false;

-- 2. Update confirm_invoice_payment to set commission_rate = 0 and is_subscribed = true
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_shop_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'online'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
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

  -- Update shop status to STORE_ACTIVE with ZERO commission rate
  UPDATE public.shops
     SET shop_payment_status = 'STORE_ACTIVE',
         is_suspended = false,
         commission_rate = 0,
         is_subscribed = true,
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
     SET received_during_lock = false,
         commission_amount = 0
   WHERE shop_id = p_shop_id;

  -- Log event
  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
  VALUES (
    p_shop_id, 
    'PAYMENT_CONFIRMED', 
    12000, 
    'Abonnement/Facture de 12 000 FCFA confirmé (Réf: ' || v_ref || ') — Pass 0 FCFA commission activé'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'shop_status', 'STORE_ACTIVE', 
    'message', 'Abonnement confirmé. Boutique activée sans commission (0 FCFA).'
  );
END $$;

-- 3. Update order total recomputation trigger function to strictly respect 0 FCFA commission for subscribed shops
CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
  v_rate numeric;
  v_shop_payment_status text;
  v_is_subscribed boolean;
  v_commission_amount numeric := 0;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = v_order_id;

  SELECT COALESCE(s.commission_rate, 0.025), s.shop_payment_status, COALESCE(s.is_subscribed, false)
    INTO v_rate, v_shop_payment_status, v_is_subscribed
    FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
   WHERE o.id = v_order_id;

  -- If shop is subscribed, has active paid status, or commission_rate is 0 => Commission is 0 FCFA!
  IF v_rate = 0 OR v_is_subscribed = true OR v_shop_payment_status IN ('STORE_ACTIVE', 'PAYMENT_CONFIRMED', 'STORE_REACTIVATED', 'active') THEN
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

-- 4. Retroactive cleanup: Set commission_amount = 0 for all existing orders of subscribed/active shops
UPDATE public.shops
   SET commission_rate = 0,
       is_subscribed = true
 WHERE shop_payment_status IN ('STORE_ACTIVE', 'PAYMENT_CONFIRMED', 'STORE_REACTIVATED', 'active');

UPDATE public.orders o
   SET commission_amount = 0
  FROM public.shops s
 WHERE o.shop_id = s.id
   AND (s.commission_rate = 0 OR s.is_subscribed = true OR s.shop_payment_status IN ('STORE_ACTIVE', 'PAYMENT_CONFIRMED', 'STORE_REACTIVATED', 'active'));
