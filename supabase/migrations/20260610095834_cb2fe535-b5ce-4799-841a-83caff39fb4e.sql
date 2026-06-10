
-- Allow decimal credits (1.5 per product sheet)
ALTER TABLE public.profiles
  ALTER COLUMN purchased_credits TYPE numeric(10,2) USING purchased_credits::numeric;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_optimizer_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_voice_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_product_sheet_used boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.consume_ai_credit(
  _user_id uuid,
  _feature text,
  _amount numeric DEFAULT 1.5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
  v_role_exempt boolean;
  v_sub record;
  v_free_used boolean;
  v_free_col text;
  v_new_balance numeric;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Founder / co-founder exempt
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('founder','co_founder')
  ) INTO v_role_exempt;
  IF v_role_exempt THEN
    RETURN jsonb_build_object('success', true, 'exempt', true);
  END IF;

  -- Active subscription = unlimited within plan
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
  IF v_sub.status = 'active' AND (v_sub.end_date IS NULL OR v_sub.end_date > now()) THEN
    RETURN jsonb_build_object('success', true, 'subscription', true);
  END IF;

  -- Free trial: 1 free attempt per feature
  v_free_col := CASE _feature
    WHEN 'optimizer' THEN 'free_optimizer_used'
    WHEN 'voice' THEN 'free_voice_used'
    WHEN 'product_sheet' THEN 'free_product_sheet_used'
    ELSE NULL
  END;

  IF v_free_col IS NOT NULL THEN
    EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1', v_free_col)
      INTO v_free_used USING _user_id;
    IF v_free_used IS NOT TRUE THEN
      EXECUTE format('UPDATE public.profiles SET %I = true, updated_at = now() WHERE id = $1', v_free_col)
        USING _user_id;
      RETURN jsonb_build_object('success', true, 'free_trial', true);
    END IF;
  END IF;

  -- Pay from purchased_credits
  SELECT COALESCE(purchased_credits, 0) INTO v_balance
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

  IF v_balance < _amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'credits_required',
      'balance', v_balance,
      'needed', _amount
    );
  END IF;

  v_new_balance := v_balance - _amount;
  UPDATE public.profiles
    SET purchased_credits = v_new_balance, updated_at = now()
    WHERE id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'charged', _amount,
    'balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid, text, numeric) TO authenticated, service_role;
