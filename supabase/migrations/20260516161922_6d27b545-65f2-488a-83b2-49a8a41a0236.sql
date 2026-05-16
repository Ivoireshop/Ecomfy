CREATE OR REPLACE FUNCTION public.apply_shop_activation(
  p_shop_id uuid,
  p_user_id uuid,
  p_amount numeric DEFAULT 0,
  p_transaction_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already_activated boolean;
  v_trace_id uuid;
  v_payment_found boolean := false;
BEGIN
  IF p_transaction_reference IS NULL OR btrim(p_transaction_reference) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement confirmé requis pour activer la boutique.'
    );
  END IF;

  SELECT COALESCE(is_activated, false)
  INTO v_already_activated
  FROM public.shops
  WHERE id = p_shop_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Boutique introuvable pour ce compte.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.user_id = p_user_id
      AND p.status = 'completed'
      AND COALESCE(p.metadata->>'payment_type', '') = 'shop_activation'
      AND p.metadata->>'shop_id' = p_shop_id::text
      AND (
        p.transaction_id = p_transaction_reference
        OR p.metadata->>'gateway_reference' = p_transaction_reference
        OR p.metadata->>'order_id' = p_transaction_reference
      )
  )
  INTO v_payment_found;

  IF NOT v_payment_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun paiement validé ne correspond à cette boutique.'
    );
  END IF;

  UPDATE public.shops
  SET
    is_activated = true,
    activation_fee_paid = true,
    is_published = true,
    updated_at = now()
  WHERE id = p_shop_id
    AND user_id = p_user_id;

  UPDATE public.profiles
  SET
    shop_activation_paid = true,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.commission_payments (
    shop_id,
    amount,
    payment_method,
    transaction_reference,
    status,
    created_by,
    notes
  )
  VALUES (
    p_shop_id,
    COALESCE(p_amount, 0),
    COALESCE(NULLIF(p_payment_method, ''), 'geniuspay'),
    p_transaction_reference,
    'paid',
    p_user_id,
    'Activation de la boutique'
  )
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING
  RETURNING id INTO v_trace_id;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'already_activated', v_already_activated,
    'trace_created', v_trace_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_shop_activation_payment(
  p_shop_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shop record;
  v_confirmed_payment record;
BEGIN
  SELECT
    id,
    user_id,
    COALESCE(is_activated, false) AS is_activated,
    COALESCE(activation_fee_paid, false) AS activation_fee_paid,
    COALESCE(is_published, false) AS is_published
  INTO v_shop
  FROM public.shops
  WHERE id = p_shop_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Boutique introuvable pour ce compte.',
      'should_charge', false
    );
  END IF;

  SELECT p.id, p.amount, p.transaction_id, p.payment_method
  INTO v_confirmed_payment
  FROM public.payments p
  WHERE p.user_id = p_user_id
    AND p.status = 'completed'
    AND COALESCE(p.metadata->>'payment_type', '') = 'shop_activation'
    AND p.metadata->>'shop_id' = p_shop_id::text
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
  LIMIT 1;

  IF v_shop.is_activated THEN
    RETURN jsonb_build_object(
      'success', true,
      'should_charge', false,
      'already_activated', true,
      'shop_id', p_shop_id
    );
  END IF;

  IF v_confirmed_payment.id IS NOT NULL THEN
    PERFORM public.apply_shop_activation(
      p_shop_id,
      p_user_id,
      COALESCE(v_confirmed_payment.amount, 0),
      v_confirmed_payment.transaction_id,
      COALESCE(v_confirmed_payment.payment_method, 'geniuspay')
    );

    RETURN jsonb_build_object(
      'success', true,
      'should_charge', false,
      'already_paid', true,
      'applied', true,
      'shop_id', p_shop_id
    );
  END IF;

  IF v_shop.activation_fee_paid OR v_shop.is_published THEN
    UPDATE public.shops
    SET
      is_activated = false,
      activation_fee_paid = false,
      is_published = false,
      updated_at = now()
    WHERE id = p_shop_id
      AND user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'should_charge', true,
    'shop_id', p_shop_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid) TO service_role;