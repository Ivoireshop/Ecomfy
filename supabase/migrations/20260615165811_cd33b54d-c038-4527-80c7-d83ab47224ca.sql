
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket text NOT NULL,
  key text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_lookup_idx
  ON public.rate_limit_hits (bucket, key, hit_at DESC);

GRANT SELECT, INSERT, DELETE ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket text,
  _key text,
  _max integer,
  _window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _bucket IS NULL OR _key IS NULL OR _max IS NULL OR _window_seconds IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'count', 0);
  END IF;

  DELETE FROM public.rate_limit_hits
   WHERE bucket = _bucket AND key = _key
     AND hit_at < now() - make_interval(secs => _window_seconds * 4);

  SELECT count(*) INTO v_count
    FROM public.rate_limit_hits
   WHERE bucket = _bucket AND key = _key
     AND hit_at >= now() - make_interval(secs => _window_seconds);

  IF v_count >= _max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'limit', _max,
      'retry_after_seconds', _window_seconds
    );
  END IF;

  INSERT INTO public.rate_limit_hits(bucket, key) VALUES (_bucket, _key);
  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', _max);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
