-- H10 : création de commande publique par RPC (plus d'INSERT direct sur orders / order_items).
--
-- Constat : n'importe qui pouvait insérer des commandes et des articles dans orders / order_items
-- (politiques d'INSERT ouvertes à anon), sans limitation de débit. Chaque commande ajoute la
-- commission par commande à shops.commission_balance_due (trigger sync_shop_order_stats) : un tiers
-- pouvait ainsi faire franchir à la boutique d'un concurrent le seuil de blocage. Les montants étaient
-- en outre calculés dans le navigateur (C6 les impose déjà ligne par ligne par trigger).
--
-- Après cette migration :
--   * la seule voie publique est create_public_order(...), SECURITY DEFINER : boutique publiquement
--     visible, champs client validés et bornés, lignes validées (produit publié de la boutique, quantité
--     1..999, offre en lot, variantes bornées), commande et articles créés dans UNE transaction, numéro de
--     commande généré par le serveur, statut initial 'new' (ou 'pending' pour la commande directe), paiement
--     'pending', totaux et commission recalculés par les triggers existants (enforce_order_item_price,
--     recompute_order_totals) ; limitation de débit par IP et par couple boutique + téléphone ;
--   * INSERT retiré à anon et authenticated sur orders et order_items (et politiques supprimées) ;
--     service_role, le propriétaire via SQL direct et les Edge Functions ne sont pas touchés.
--
-- À appliquer APRÈS 20261015120000 (guard_public_order_insert, enforce_order_item_price avec lots) et
-- 20261015160000. À déployer avec le front (ProductView, ShopView) : l'ancien front ne peut plus insérer.
-- Tests : supabase/tests/h10_create_public_order.sql (base jetable). Idempotent.

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_customer_email text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_customer_city text DEFAULT NULL,
  p_customer_country text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_order_status text DEFAULT 'new'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_customer_name, ''));
  v_phone text := btrim(COALESCE(p_customer_phone, ''));
  v_email text := NULLIF(btrim(COALESCE(p_customer_email, '')), '');
  v_address text := NULLIF(btrim(COALESCE(p_customer_address, '')), '');
  v_city text := NULLIF(btrim(COALESCE(p_customer_city, '')), '');
  v_country text := NULLIF(btrim(COALESCE(p_customer_country, '')), '');
  v_pay text := COALESCE(NULLIF(btrim(COALESCE(p_payment_method, '')), ''), 'cash_on_delivery');
  v_status text := COALESCE(NULLIF(btrim(COALESCE(p_order_status, '')), ''), 'new');
  v_headers json;
  v_ip text;
  v_rl jsonb;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_bundle int;
  v_variants jsonb;
  v_variants_text text;
  v_image text;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_summary text[] := ARRAY[]::text[];
  v_order_id uuid;
  v_order_number text;
  v_total numeric;
BEGIN
  -- ---------- Validation des champs client ----------
  IF p_shop_id IS NULL OR NOT public.is_shop_publicly_visible(p_shop_id) THEN
    RAISE EXCEPTION 'Boutique indisponible.';
  END IF;
  -- Nom et téléphone peuvent être désactivés dans checkout_fields de la boutique : vides acceptés, validés si fournis.
  IF char_length(v_name) > 100 OR (v_name <> '' AND char_length(v_name) < 2) THEN
    RAISE EXCEPTION 'Nom invalide.';
  END IF;
  IF v_phone <> '' AND v_phone !~ '^\+?[0-9][0-9 ().-]{5,24}$' THEN
    RAISE EXCEPTION 'Numéro de téléphone invalide.';
  END IF;
  IF v_email IS NOT NULL AND (char_length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Adresse e-mail invalide.';
  END IF;
  IF char_length(COALESCE(v_address, '')) > 500 OR char_length(COALESCE(v_city, '')) > 100
     OR char_length(COALESCE(v_country, '')) > 100 THEN
    RAISE EXCEPTION 'Adresse invalide.';
  END IF;
  IF v_pay NOT IN ('cash_on_delivery', 'mobile_money', 'cod') THEN
    RAISE EXCEPTION 'Mode de paiement invalide.';
  END IF;
  IF v_status NOT IN ('new', 'pending') THEN
    v_status := 'new';
  END IF;

  -- ---------- Validation des lignes ----------
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Panier invalide.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR COALESCE(v_item ->> 'product_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR COALESCE(v_item ->> 'quantity', '') !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'Article invalide.';
    END IF;
    v_qty := (v_item ->> 'quantity')::int;
    IF v_qty < 1 OR v_qty > 999 THEN
      RAISE EXCEPTION 'Quantité invalide.';
    END IF;

    v_bundle := NULL;
    IF v_item ? 'bundle_index' AND jsonb_typeof(v_item -> 'bundle_index') <> 'null' THEN
      IF COALESCE(v_item ->> 'bundle_index', '') !~ '^[0-9]{1,3}$' THEN
        RAISE EXCEPTION 'Offre en lot invalide.';
      END IF;
      v_bundle := (v_item ->> 'bundle_index')::int;
    END IF;

    -- Variantes : objet texte -> texte, 20 clés max, 100 caractères max par clé et par valeur.
    v_variants := NULL;
    v_variants_text := '';
    IF v_item ? 'selected_variants' AND jsonb_typeof(v_item -> 'selected_variants') = 'object' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(v_item -> 'selected_variants')) > 20 THEN
        RAISE EXCEPTION 'Variantes invalides.';
      END IF;
      SELECT jsonb_object_agg(left(k, 100), left(val, 100)),
             string_agg(left(k, 100) || ': ' || left(val, 100), ', ')
        INTO v_variants, v_variants_text
        FROM (SELECT key AS k, value #>> '{}' AS val FROM jsonb_each(v_item -> 'selected_variants')) s
        WHERE val IS NOT NULL;
      IF v_variants_text IS NOT NULL AND v_variants_text <> '' THEN
        v_variants_text := ' (' || v_variants_text || ')';
      ELSE
        v_variants := NULL;
        v_variants_text := '';
      END IF;
    END IF;

    SELECT id, shop_id, name, is_published INTO v_product
      FROM public.products WHERE id = (v_item ->> 'product_id')::uuid;
    IF v_product.id IS NULL OR v_product.shop_id <> p_shop_id OR v_product.is_published IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Produit indisponible.';
    END IF;

    SELECT image_url INTO v_image FROM public.product_images
      WHERE product_id = v_product.id
      ORDER BY is_primary DESC NULLS LAST, display_order NULLS LAST, created_at
      LIMIT 1;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'quantity', v_qty,
      'bundle_index', v_bundle,
      'variants', v_variants,
      'image', v_image
    ));
    v_summary := v_summary || (v_qty::text || '× ' || v_product.name || v_variants_text);
  END LOOP;

  -- ---------- Limitation de débit (après validation : un refus de validation ne consomme rien) ----------
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  -- cf-connecting-ip est posé par Cloudflare (non falsifiable par le client) ; x-forwarded-for ne l'est pas.
  v_ip := NULLIF(btrim(COALESCE(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip', '')), '');

  IF v_ip IS NOT NULL THEN
    v_rl := public.check_rate_limit('create_order_ip', left(v_ip, 64), 10, 600);
    IF COALESCE((v_rl ->> 'allowed')::boolean, true) IS NOT TRUE THEN
      RAISE EXCEPTION 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_phone <> '' THEN
    v_rl := public.check_rate_limit('create_order_shop_phone', p_shop_id::text || '|' || regexp_replace(v_phone, '[^0-9+]', '', 'g'), 5, 3600);
  ELSE
    -- Sans téléphone, seule la boutique identifie l'émetteur : plafond plus large pour ne pas gêner les ventes.
    v_rl := public.check_rate_limit('create_order_shop_nophone', p_shop_id::text, 30, 3600);
  END IF;
  IF COALESCE((v_rl ->> 'allowed')::boolean, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Trop de commandes pour ce numéro. Réessayez plus tard.' USING ERRCODE = 'P0001';
  END IF;

  -- ---------- Création (une seule transaction) ----------
  v_order_number := public.generate_order_number();

  INSERT INTO public.orders (
    shop_id, order_number, customer_name, customer_email, customer_phone, customer_address,
    customer_city, customer_country, subtotal, commission_amount, total,
    payment_method, order_status, products_summary
  ) VALUES (
    p_shop_id, v_order_number, v_name, v_email, v_phone, v_address,
    v_city, v_country, 0, 0, 0,
    v_pay, v_status, array_to_string(v_summary, ' ; ')
  ) RETURNING id INTO v_order_id;

  -- Prix, total et commission : décidés par enforce_order_item_price et recompute_order_totals.
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_image_url, quantity, unit_price, total_price,
      bundle_index, selected_variants
    ) VALUES (
      v_order_id, (v_line ->> 'product_id')::uuid, v_line ->> 'name', v_line ->> 'image',
      (v_line ->> 'quantity')::int, 0, 0,
      CASE WHEN jsonb_typeof(v_line -> 'bundle_index') = 'number' THEN (v_line ->> 'bundle_index')::int END,
      CASE WHEN jsonb_typeof(v_line -> 'variants') = 'object' THEN v_line -> 'variants' END
    );
  END LOOP;

  SELECT total INTO v_total FROM public.orders WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text)
  TO anon, authenticated, service_role;

-- ---------- Plus d'insertion directe ----------
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders for visible shops" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Insert items only for fresh public orders" ON public.order_items;

REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;
