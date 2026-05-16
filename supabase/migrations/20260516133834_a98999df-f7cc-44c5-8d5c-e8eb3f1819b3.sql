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
BEGIN
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

  IF p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '' THEN
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
  END IF;

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