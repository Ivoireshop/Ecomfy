-- Paniers abandonnés : correctifs.
--
-- 1) La RPC upsert_abandoned_cart écrivait customer_country, colonne qui n'a jamais été créée :
--    chaque appel échouait (42703) et aucun panier n'était enregistré.
-- 2) Un panier déjà converti n'était jamais réactivé (même session) : les paniers suivants restaient invisibles.
-- 3) Articles, prix et totaux venaient du client : ils sont maintenant reconstruits côté serveur.
-- 4) Panier vidé par le visiteur : la ligne restait (nouvelle RPC discard_abandoned_cart).
-- 5) Conversion fiable : un trigger sur orders marque les paniers de la boutique ayant le même téléphone.
-- 6) La table n'était pas dans la publication realtime : la liste du propriétaire ne se rafraîchissait pas.

ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS customer_country text;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_shop_open
  ON public.abandoned_carts (shop_id, updated_at DESC) WHERE converted = false;

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
  v_item jsonb;
  v_qty integer;
  v_product record;
  v_variants jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_total numeric := 0;
  v_rl jsonb;
BEGIN
  IF _shop_id IS NULL OR _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 128 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF NOT public.is_shop_publicly_visible(_shop_id) THEN
    RAISE EXCEPTION 'shop_not_visible';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Limitation de débit par session : au-delà, on ignore sans erreur (le panier reste celui déjà enregistré).
  v_rl := public.check_rate_limit('abandoned_cart_session', _shop_id::text || '|' || _session_id, 120, 600);
  IF COALESCE((v_rl ->> 'allowed')::boolean, true) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Articles reconstruits depuis la base : nom et prix ne viennent jamais du client.
  FOR v_item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    CONTINUE WHEN jsonb_typeof(v_item) <> 'object'
      OR COALESCE(v_item ->> 'product_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR COALESCE(v_item ->> 'quantity', '') !~ '^[0-9]{1,3}$';
    v_qty := (v_item ->> 'quantity')::int;
    CONTINUE WHEN v_qty < 1;

    SELECT id, shop_id, name, price, is_published INTO v_product
      FROM public.products WHERE id = (v_item ->> 'product_id')::uuid;
    CONTINUE WHEN v_product.id IS NULL OR v_product.shop_id <> _shop_id OR v_product.is_published IS DISTINCT FROM true;

    v_variants := NULL;
    IF jsonb_typeof(v_item -> 'selected_variants') = 'object'
       AND (SELECT count(*) FROM jsonb_object_keys(v_item -> 'selected_variants')) <= 20 THEN
      SELECT jsonb_object_agg(left(key, 100), left(value #>> '{}', 100))
        INTO v_variants
        FROM jsonb_each(v_item -> 'selected_variants')
        WHERE value #>> '{}' IS NOT NULL;
    END IF;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'quantity', v_qty,
      'price', v_product.price,
      'selected_variants', v_variants
    ));
    v_count := v_count + v_qty;
    v_total := v_total + COALESCE(v_product.price, 0) * v_qty;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'invalid_input';
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
    v_lines, v_count, v_total,
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
        -- Un panier déjà converti qui se remplit à nouveau devient un nouveau panier abandonné.
        created_at = CASE WHEN a.converted THEN now() ELSE a.created_at END,
        converted = false,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Le visiteur a vidé son panier : on retire le panier encore ouvert (jamais un panier converti).
CREATE OR REPLACE FUNCTION public.discard_abandoned_cart(
  _shop_id uuid,
  _session_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _shop_id IS NULL OR _session_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.abandoned_carts
   WHERE shop_id = _shop_id AND session_id = _session_id AND converted = false;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_abandoned_cart(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discard_abandoned_cart(uuid, text) TO anon, authenticated;

-- Conversion fiable : toute commande de la boutique clôt les paniers ouverts du même numéro,
-- même si l'appel front mark_abandoned_cart_converted a échoué ou venait d'une autre session.
CREATE OR REPLACE FUNCTION public.mark_abandoned_carts_converted_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(NEW.customer_phone, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_digits <> '' THEN
    UPDATE public.abandoned_carts
       SET converted = true, updated_at = now()
     WHERE shop_id = NEW.shop_id
       AND converted = false
       AND regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g') = v_digits;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_mark_abandoned_carts_converted ON public.orders;
CREATE TRIGGER trg_orders_mark_abandoned_carts_converted
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.mark_abandoned_carts_converted_on_order();

-- Realtime : la liste du propriétaire se met à jour (DELETE inclus, d'où REPLICA IDENTITY FULL pour le filtre shop_id).
ALTER TABLE public.abandoned_carts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'abandoned_carts'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.abandoned_carts;
  END IF;
END $$;
