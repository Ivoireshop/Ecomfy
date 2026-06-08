CREATE OR REPLACE FUNCTION public.get_ai_quota(
  _user_id uuid,
  _limit integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_current integer := 0;
  v_is_exempt boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'not_authenticated',
      'limit', _limit,
      'used', 0,
      'remaining', 0,
      'resets_at', ((v_today + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  -- Exempt founders / co-founders
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('founder', 'co_founder')
  ) INTO v_is_exempt;

  IF v_is_exempt THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'exempt', true,
      'limit', null,
      'used', 0,
      'remaining', null,
      'resets_at', ((v_today + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  SELECT request_count INTO v_current
    FROM public.ai_daily_usage
    WHERE user_id = _user_id AND usage_date = v_today;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', _limit,
    'used', v_current,
    'remaining', GREATEST(_limit - v_current, 0),
    'resets_at', ((v_today + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_quota(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_quota(uuid, integer) TO service_role;
