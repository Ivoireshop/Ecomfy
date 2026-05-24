ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS gifs_generated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gifs_period_start timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.increment_shop_gif_count(_shop_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _period_start timestamptz;
  _count integer;
BEGIN
  SELECT (user_id = auth.uid()) INTO _is_owner FROM public.shops WHERE id = _shop_id;
  IF _is_owner IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT gifs_period_start, gifs_generated_count INTO _period_start, _count
  FROM public.shops WHERE id = _shop_id FOR UPDATE;

  IF _period_start IS NULL OR _period_start < now() - interval '30 days' THEN
    UPDATE public.shops
      SET gifs_period_start = now(), gifs_generated_count = 1
      WHERE id = _shop_id;
    RETURN 1;
  ELSE
    UPDATE public.shops
      SET gifs_generated_count = gifs_generated_count + 1
      WHERE id = _shop_id;
    RETURN _count + 1;
  END IF;
END;
$$;