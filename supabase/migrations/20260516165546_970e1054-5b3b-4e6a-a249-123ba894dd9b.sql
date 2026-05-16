
CREATE OR REPLACE FUNCTION public.apply_commission_payment(
  p_shop_id uuid,
  p_amount numeric,
  p_transaction_reference text,
  p_created_by uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay',
  p_notes text DEFAULT 'Paiement en ligne via GeniusPay'
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
      WHERE transaction_reference = p_transaction_reference
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id, COALESCE(commission_balance_due,0) AS balance, COALESCE(commission_threshold,12000) AS threshold
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  UPDATE public.shops
     SET commission_balance_due = v_new_balance,
         payment_deadline = CASE WHEN v_new_balance < v_shop.threshold THEN NULL ELSE payment_deadline END,
         is_suspended = CASE WHEN v_new_balance < v_shop.threshold THEN false ELSE is_suspended END,
         updated_at = now()
   WHERE id = p_shop_id;

  INSERT INTO public.commission_payments (shop_id, amount, payment_method, transaction_reference, status, created_by, notes)
  VALUES (p_shop_id, p_amount, COALESCE(NULLIF(p_payment_method,''),'geniuspay'), p_transaction_reference, 'paid', p_created_by, p_notes)
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Reconcile Terminus kooko missed payment
SELECT public.apply_commission_payment(
  '0a388aee-0d45-4ec5-94a5-5f2675e2698b'::uuid,
  1063,
  'MTX-JCVJCD5ADQ',
  '0651f314-d61e-4139-8ba6-afc10499a2c6'::uuid,
  'wave',
  'Régularisation paiement commission GeniusPay'
);
