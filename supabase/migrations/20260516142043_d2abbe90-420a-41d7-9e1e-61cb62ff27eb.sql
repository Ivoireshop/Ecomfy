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
  v_profile_paid boolean := false;
  v_has_completed_activation_payment boolean := false;
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

  SELECT COALESCE(shop_activation_paid, false)
  INTO v_profile_paid
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND COALESCE(metadata->>'payment_type', '') = 'shop_activation'
      AND (
        metadata->>'shop_id' = p_shop_id::text
        OR metadata->>'shop_id' IS NULL
        OR metadata->>'shop_id' = ''
      )
  )
  INTO v_has_completed_activation_payment;

  IF v_shop.is_activated THEN
    UPDATE public.shops
    SET
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

    RETURN jsonb_build_object(
      'success', true,
      'should_charge', false,
      'already_activated', true,
      'shop_id', p_shop_id
    );
  END IF;

  IF v_shop.activation_fee_paid OR v_profile_paid OR v_has_completed_activation_payment THEN
    PERFORM public.apply_shop_activation(
      p_shop_id,
      p_user_id,
      0,
      NULL,
      CASE
        WHEN v_has_completed_activation_payment THEN 'already_paid'
        WHEN v_profile_paid THEN 'profile_already_paid'
        ELSE 'activation_flag_already_paid'
      END
    );

    RETURN jsonb_build_object(
      'success', true,
      'should_charge', false,
      'already_paid', true,
      'applied', true,
      'shop_id', p_shop_id
    );
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

UPDATE public.shops s
SET
  is_activated = true,
  activation_fee_paid = true,
  is_published = true,
  updated_at = now()
WHERE (
    EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.user_id = s.user_id
        AND p.status = 'completed'
        AND COALESCE(p.metadata->>'payment_type', '') = 'shop_activation'
        AND (
          p.metadata->>'shop_id' = s.id::text
          OR p.metadata->>'shop_id' IS NULL
          OR p.metadata->>'shop_id' = ''
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = s.user_id
        AND COALESCE(pr.shop_activation_paid, false) = true
    )
  )
  AND (
    COALESCE(s.is_activated, false) = false
    OR COALESCE(s.activation_fee_paid, false) = false
    OR COALESCE(s.is_published, false) = false
  );