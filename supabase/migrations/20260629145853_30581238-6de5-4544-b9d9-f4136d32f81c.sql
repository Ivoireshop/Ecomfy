
-- 1) abandoned_carts: replace permissive anon INSERT/UPDATE policies with SECURITY DEFINER RPCs that enforce session ownership.
DROP POLICY IF EXISTS "Anyone can update their abandoned cart on public shops" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can create abandoned carts on public shops" ON public.abandoned_carts;

CREATE OR REPLACE FUNCTION public.upsert_abandoned_cart(
  _shop_id uuid,
  _session_id text,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _customer_city text,
  _customer_address text,
  _customer_country text,
  _payment_method text,
  _items jsonb,
  _items_count integer,
  _total numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _shop_id IS NULL OR _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 128 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF NOT public.is_shop_publicly_visible(_shop_id) THEN
    RAISE EXCEPTION 'shop_not_visible';
  END IF;

  INSERT INTO public.abandoned_carts AS a (
    shop_id, session_id, customer_name, customer_phone, customer_email,
    customer_city, customer_address, customer_country, payment_method,
    items, items_count, total, converted, updated_at
  ) VALUES (
    _shop_id, _session_id,
    NULLIF(left(COALESCE(_customer_name,''), 200), ''),
    NULLIF(left(COALESCE(_customer_phone,''), 50), ''),
    NULLIF(left(COALESCE(_customer_email,''), 255), ''),
    NULLIF(left(COALESCE(_customer_city,''), 200), ''),
    NULLIF(left(COALESCE(_customer_address,''), 500), ''),
    NULLIF(left(COALESCE(_customer_country,''), 100), ''),
    NULLIF(left(COALESCE(_payment_method,''), 50), ''),
    COALESCE(_items, '[]'::jsonb),
    GREATEST(COALESCE(_items_count, 0), 0),
    GREATEST(COALESCE(_total, 0), 0),
    false,
    now()
  )
  ON CONFLICT (shop_id, session_id) DO UPDATE
    SET customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_email = EXCLUDED.customer_email,
        customer_city = EXCLUDED.customer_city,
        customer_address = EXCLUDED.customer_address,
        customer_country = EXCLUDED.customer_country,
        payment_method = EXCLUDED.payment_method,
        items = EXCLUDED.items,
        items_count = EXCLUDED.items_count,
        total = EXCLUDED.total,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_abandoned_cart_converted(
  _shop_id uuid,
  _session_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _shop_id IS NULL OR _session_id IS NULL THEN RETURN; END IF;
  UPDATE public.abandoned_carts
     SET converted = true, updated_at = now()
   WHERE shop_id = _shop_id AND session_id = _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_abandoned_cart(uuid, text, text, text, text, text, text, text, text, jsonb, integer, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_cart_converted(uuid, text) TO anon, authenticated;

-- 2) rate_limit_hits: add explicit deny policies to document fail-closed intent (writes happen only via SECURITY DEFINER RPC check_rate_limit / service_role).
DROP POLICY IF EXISTS "rate_limit_hits service only" ON public.rate_limit_hits;
CREATE POLICY "rate_limit_hits service only"
  ON public.rate_limit_hits FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 3) product_reviews: keep approved-only reads possible by shop owners (existing ALL policy). Make sure reviewer_email is NOT exposed to anon/authenticated through any future SELECT policy by adding a column-level revoke.
REVOKE SELECT (reviewer_email) ON public.product_reviews FROM anon, authenticated;
