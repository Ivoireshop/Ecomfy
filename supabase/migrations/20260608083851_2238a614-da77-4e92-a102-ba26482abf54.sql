
CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  request_count integer NOT NULL DEFAULT 0,
  last_feature text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

GRANT SELECT ON public.ai_daily_usage TO authenticated;
GRANT ALL ON public.ai_daily_usage TO service_role;

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.ai_daily_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Deny client writes on ai_daily_usage"
  ON public.ai_daily_usage
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Re-allow SELECT for owner via permissive policy above (RESTRICTIVE + permissive logic).
-- The RESTRICTIVE policy applies to ALL, but SELECT also goes through the permissive policy.
-- Need to ensure RESTRICTIVE only blocks writes:
DROP POLICY "Deny client writes on ai_daily_usage" ON public.ai_daily_usage;

CREATE POLICY "Deny client inserts on ai_daily_usage"
  ON public.ai_daily_usage AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on ai_daily_usage"
  ON public.ai_daily_usage AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes on ai_daily_usage"
  ON public.ai_daily_usage AS RESTRICTIVE FOR DELETE
  TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _user_id uuid,
  _feature text DEFAULT 'generic',
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
      'remaining', 0
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
      'remaining', null
    );
  END IF;

  SELECT request_count INTO v_current
    FROM public.ai_daily_usage
    WHERE user_id = _user_id AND usage_date = v_today
    FOR UPDATE;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  IF v_current >= _limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'daily_quota_exceeded',
      'limit', _limit,
      'used', v_current,
      'remaining', 0,
      'resets_at', ((v_today + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  INSERT INTO public.ai_daily_usage AS u (user_id, usage_date, request_count, last_feature, updated_at)
  VALUES (_user_id, v_today, 1, _feature, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET request_count = u.request_count + 1,
        last_feature = EXCLUDED.last_feature,
        updated_at = now()
  RETURNING request_count INTO v_current;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', _limit,
    'used', v_current,
    'remaining', GREATEST(_limit - v_current, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) FROM anon, authenticated, public;
