-- Fix billing threshold and partial payment synchronization
-- This ensures commission_balance_due is the single source of truth for amountDue,
-- and invoice amounts & shop statuses are updated dynamically when partial or full payments are made.

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
  v_event text;
BEGIN
  IF p_shop_id IS NULL OR COALESCE(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- Idempotency check on transaction reference
  IF p_transaction_reference IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.commission_payments
      WHERE transaction_reference = p_transaction_reference LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id,
         COALESCE(commission_balance_due, 0) AS balance,
         COALESCE(commission_threshold, 12000) AS threshold,
         shop_payment_status,
         payment_deadline
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- Calculate remaining balance after payment
  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  -- Log the payment row
  INSERT INTO public.commission_payments (
    shop_id, amount, transaction_reference, created_by, payment_method, notes
  ) VALUES (
    p_shop_id, p_amount, p_transaction_reference, p_created_by, p_payment_method, p_notes
  );

  IF v_new_balance <= 0 THEN
    -- Full settlement: restore store access completely
    UPDATE public.shops
       SET commission_balance_due = 0,
           payment_deadline = NULL,
           is_suspended = false,
           shop_payment_status = 'STORE_ACTIVE',
           threshold_reached_at = NULL,
           first_deadline_at = NULL,
           locked_at = NULL,
           second_deadline_at = NULL,
           final_suspension_at = NULL,
           updated_at = now()
     WHERE id = p_shop_id;

    -- Update all open invoices to PAYMENT_CONFIRMED
    UPDATE public.shop_invoices
       SET status = 'PAYMENT_CONFIRMED',
           amount = 0,
           paid_at = now(),
           payment_reference = COALESCE(p_transaction_reference, payment_reference),
           payment_method = COALESCE(p_payment_method, payment_method)
     WHERE shop_id = p_shop_id AND status != 'PAYMENT_CONFIRMED';

    -- Unmark orders received during lock
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;

    v_event := 'paid_full';
  ELSE
    -- Partial settlement: update balance and invoice amount
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           is_suspended = CASE 
             WHEN v_shop.payment_deadline IS NOT NULL AND v_shop.payment_deadline < now() THEN true 
             ELSE false 
           END,
           shop_payment_status = CASE 
             WHEN v_shop.payment_deadline IS NOT NULL AND v_shop.payment_deadline < now() THEN 'STORE_RESTRICTED'
             WHEN v_new_balance < 12000 THEN 'STORE_ACTIVE'
             ELSE 'PAYMENT_DUE'
           END,
           updated_at = now()
     WHERE id = p_shop_id;

    -- Sync active open invoices with the new reduced balance
    UPDATE public.shop_invoices
       SET amount = v_new_balance
     WHERE shop_id = p_shop_id AND status != 'PAYMENT_CONFIRMED';

    v_event := 'payment_partial';
  END IF;

  -- Log event in payment timeline
  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
  VALUES (
    p_shop_id, 
    'COMMISSION_PAYMENT_APPLIED', 
    p_amount, 
    'Paiement de ' || p_amount || ' FCFA appliqué (Réf: ' || COALESCE(p_transaction_reference, 'N/A') || ') — Solde restant: ' || v_new_balance || ' FCFA'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'event', v_event, 
    'new_balance', v_new_balance,
    'message', 'Paiement comptabilisé avec succès. Nouveau solde : ' || v_new_balance || ' FCFA'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) TO authenticated, service_role, anon;
