-- Codes promo de boutique : schéma, droits, application côté serveur (22/10/2026).
--
-- Constat (base dev, identique à la prod si la table n'a jamais été modifiée à la main) :
--   * promo_codes n'avait que les colonnes des codes d'abonnement fondateur : pas de shop_id, de type de remise,
--     de montant fixe, de minimum de commande ni de ciblage. L'écran « Codes promo » du marchand (et la création
--     de codes fondateur avec ces champs) échouait donc à l'insertion ;
--   * une politique RESTRICTIVE réservait toute lecture aux fondateurs : un marchand ne pouvait pas lister ses codes ;
--   * aucune commande en boutique n'appliquait de code : create_public_order ignorait toute remise.
--
-- Après cette migration :
--   * promo_codes porte les codes de boutique (shop_id) et les codes d'abonnement (shop_id NULL, inchangés :
--     validate_promo_code / increment_promo_usage ne voient que ces derniers) ; unicité par boutique ;
--   * le propriétaire gère les codes de sa boutique, ses collaborateurs les lisent ; les fondateurs gardent tout ;
--   * orders.promo_code / orders.discount_amount ; le total et la commission sont calculés APRÈS remise
--     (recompute_order_totals_for, aussi appelé par le trigger sur order_items) ;
--   * create_public_order accepte p_promo_code ; la remise, le quota, la date, le minimum et le ciblage sont
--     vérifiés par le serveur, dans la transaction de la commande ;
--   * preview_shop_promo_code : aperçu pour le panier (limité en débit), sans consommer le code.
--
-- Idempotent. À appliquer AVANT le front (le nouveau front appelle preview_shop_promo_code et passe p_promo_code).

-- ---------- 1. Colonnes ----------
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_user_email text,
  ADD COLUMN IF NOT EXISTS target_user_phone text;

ALTER TABLE public.promo_codes ALTER COLUMN discount_percentage SET DEFAULT 0;
-- Un code en montant fixe n'a pas de pourcentage : la contrainte d'origine (> 0) l'interdisait.
ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_discount_percentage_check;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_discount_percentage_check
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_discount_type_check;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_discount_type_check
  CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping'));

ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_value_check;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_value_check
  CHECK (
    (discount_type = 'percentage' AND discount_percentage > 0)
    OR (discount_type = 'fixed_amount' AND discount_amount > 0)
    OR discount_type = 'free_shipping'
  );

-- Pas de frais de livraison dans le total d'une commande de boutique : « livraison offerte » n'y aurait aucun effet.
ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_shop_no_free_shipping;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_shop_no_free_shipping
  CHECK (shop_id IS NULL OR discount_type <> 'free_shipping');

ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_min_order_check;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_min_order_check CHECK (min_order_amount >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_discount_amount_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_discount_amount_check CHECK (discount_amount >= 0);

-- ---------- 2. Unicité : par boutique, sans tenir compte de la casse ----------
ALTER TABLE public.promo_codes DROP CONSTRAINT IF EXISTS promo_codes_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_global_code_uidx ON public.promo_codes (upper(code)) WHERE shop_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_shop_code_uidx ON public.promo_codes (shop_id, upper(code)) WHERE shop_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_promo_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NEW.code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$' THEN
    RAISE EXCEPTION 'Code promo invalide : 3 à 32 caractères (lettres, chiffres, - et _).';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS normalize_promo_code ON public.promo_codes;
CREATE TRIGGER normalize_promo_code BEFORE INSERT OR UPDATE OF code ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.normalize_promo_code();

CREATE INDEX IF NOT EXISTS idx_promo_codes_shop_id ON public.promo_codes (shop_id) WHERE shop_id IS NOT NULL;

-- ---------- 3. Les codes d'abonnement ne voient que les codes sans boutique ----------
CREATE OR REPLACE FUNCTION public.validate_promo_code(promo_code text)
RETURNS TABLE(is_valid boolean, discount_percentage integer, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_code public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code FROM public.promo_codes
   WHERE code = UPPER(promo_code) AND shop_id IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Code promo invalide'::TEXT; RETURN;
  END IF;
  IF v_code.is_active = false THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo n''est plus actif'::TEXT; RETURN;
  END IF;
  IF v_code.expires_at < now() THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo a expiré'::TEXT; RETURN;
  END IF;
  IF v_code.current_uses >= v_code.max_uses THEN
    RETURN QUERY SELECT false, 0, 'Ce code promo a atteint sa limite d''utilisation'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT true, v_code.discount_percentage, 'Code promo valide'::TEXT;
END $$;

CREATE OR REPLACE FUNCTION public.increment_promo_usage(promo_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.promo_codes
     SET current_uses = current_uses + 1, updated_at = now()
   WHERE code = UPPER(promo_code) AND shop_id IS NULL
     AND is_active = true AND expires_at > now() AND current_uses < max_uses;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.increment_promo_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(text) TO service_role;

-- ---------- 4. Droits (RLS) ----------
DROP POLICY IF EXISTS "Restrict promo_codes reads to founders" ON public.promo_codes;
DROP POLICY IF EXISTS "Restrict promo_codes reads to founders and shop team" ON public.promo_codes;
CREATE POLICY "Restrict promo_codes reads to founders and shop team"
ON public.promo_codes AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'founder'::app_role)
  OR public.has_role(auth.uid(), 'co_founder'::app_role)
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(shop_id))
);

DROP POLICY IF EXISTS "Shop owners manage shop promo codes" ON public.promo_codes;
CREATE POLICY "Shop owners manage shop promo codes" ON public.promo_codes
FOR ALL TO authenticated
USING (shop_id IS NOT NULL AND public.is_shop_owner(shop_id, auth.uid()))
WITH CHECK (shop_id IS NOT NULL AND public.is_shop_owner(shop_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Shop collaborators read shop promo codes" ON public.promo_codes;
CREATE POLICY "Shop collaborators read shop promo codes" ON public.promo_codes
FOR SELECT TO authenticated
USING (shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(shop_id));

-- ---------- 5. Totaux : remise comprise ----------
CREATE OR REPLACE FUNCTION public.recompute_order_totals_for(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_subtotal numeric;
  v_rate numeric;
  v_discount numeric;
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal FROM public.order_items WHERE order_id = p_order_id;

  SELECT COALESCE(s.commission_rate, 0.025), COALESCE(o.discount_amount, 0) INTO v_rate, v_discount
    FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
   WHERE o.id = p_order_id;

  v_discount := LEAST(COALESCE(v_discount, 0), v_subtotal);
  v_total := v_subtotal - v_discount;

  UPDATE public.orders
     SET subtotal = v_subtotal,
         discount_amount = v_discount,
         total = v_total,
         commission_amount = ROUND(v_total * COALESCE(v_rate, 0.025), 2),
         updated_at = now()
   WHERE id = p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.recompute_order_totals_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_order_totals_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_order_totals_for(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END $$;

-- Une insertion directe (hors RPC) ne peut pas s'attribuer une remise.
CREATE OR REPLACE FUNCTION public.guard_public_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin', 'service_role')
     OR (auth.uid() IS NOT NULL AND public.is_shop_owner(NEW.shop_id, auth.uid())) THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := 'pending';
  IF NEW.order_status IS NULL OR NEW.order_status NOT IN ('new', 'pending') THEN
    NEW.order_status := 'new';
  END IF;
  NEW.commission_amount := 0; -- recalculé par recompute_order_totals_for dès l'insertion des articles
  NEW.discount_amount := 0;
  NEW.promo_code := NULL;
  NEW.delivery_provider_id := NULL;
  NEW.delivery_transferred_at := NULL;
  NEW.internal_delivery_note := NULL;
  NEW.scheduled_delivery_date := NULL;
  NEW.is_read := false;
  RETURN NEW;
END $$;

-- ---------- 6. Évaluation d'un code (interne, jamais appelable par le navigateur) ----------
CREATE OR REPLACE FUNCTION public.evaluate_shop_promo(
  p_shop_id uuid, p_code text, p_subtotal numeric, p_phone text, p_email text, p_lock boolean DEFAULT false
)
RETURNS TABLE (promo_id uuid, code text, discount numeric, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v public.promo_codes%ROWTYPE;
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_phone text := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 8);
BEGIN
  IF p_lock THEN
    SELECT * INTO v FROM public.promo_codes
     WHERE shop_id = p_shop_id AND upper(promo_codes.code) = upper(btrim(COALESCE(p_code, ''))) FOR UPDATE;
  ELSE
    SELECT * INTO v FROM public.promo_codes
     WHERE shop_id = p_shop_id AND upper(promo_codes.code) = upper(btrim(COALESCE(p_code, '')));
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Code promo invalide'::text; RETURN;
  END IF;
  IF v.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Ce code promo n''est plus actif'::text; RETURN;
  END IF;
  IF v.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Ce code promo a expiré'::text; RETURN;
  END IF;
  IF v.current_uses >= v.max_uses THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Ce code promo a atteint sa limite d''utilisation'::text; RETURN;
  END IF;
  IF COALESCE(p_subtotal, 0) < v.min_order_amount THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric,
      ('Commande minimum de ' || replace(to_char(v.min_order_amount, 'FM999G999G999G990'), ',', ' ') || ' FCFA pour ce code')::text; RETURN;
  END IF;
  IF v.target_user_email IS NOT NULL AND lower(btrim(v.target_user_email)) <> v_email THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Ce code est réservé à un autre client'::text; RETURN;
  END IF;
  IF v.target_user_phone IS NOT NULL
     AND right(regexp_replace(v.target_user_phone, '\D', '', 'g'), 8) <> v_phone THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 0::numeric, 'Ce code est réservé à un autre client'::text; RETURN;
  END IF;

  RETURN QUERY SELECT
    v.id, v.code,
    CASE WHEN v.discount_type = 'percentage'
         THEN ROUND(p_subtotal * v.discount_percentage / 100.0, 2)
         WHEN v.discount_type = 'fixed_amount'
         THEN LEAST(v.discount_amount, p_subtotal)
         ELSE 0::numeric END,
    NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_shop_promo(uuid, text, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_shop_promo(uuid, text, numeric, text, text, boolean) TO service_role;

-- ---------- 7. Aperçu pour le panier ----------
CREATE OR REPLACE FUNCTION public.preview_shop_promo_code(
  p_shop_id uuid, p_code text, p_subtotal numeric,
  p_customer_phone text DEFAULT NULL, p_customer_email text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_headers json;
  v_ip text;
  v_rl jsonb;
  v_eval record;
BEGIN
  IF p_shop_id IS NULL OR NOT public.is_shop_publicly_visible(p_shop_id) THEN
    RETURN jsonb_build_object('valid', false, 'discount', 0, 'message', 'Boutique indisponible.');
  END IF;
  IF btrim(COALESCE(p_code, '')) = '' OR char_length(p_code) > 40 THEN
    RETURN jsonb_build_object('valid', false, 'discount', 0, 'message', 'Code promo invalide');
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  v_ip := NULLIF(btrim(COALESCE(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip', '')), '');
  -- Plafond par IP et par boutique : empêche de deviner les codes d'une boutique.
  v_rl := public.check_rate_limit('promo_preview', COALESCE(left(v_ip, 64), 'noip') || '|' || p_shop_id::text, 20, 600);
  IF COALESCE((v_rl ->> 'allowed')::boolean, true) IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'discount', 0, 'message', 'Trop de tentatives. Réessayez dans quelques minutes.');
  END IF;

  SELECT * INTO v_eval FROM public.evaluate_shop_promo(p_shop_id, p_code, GREATEST(COALESCE(p_subtotal, 0), 0),
                                                       p_customer_phone, p_customer_email, false);
  IF v_eval.error IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'discount', 0, 'message', v_eval.error);
  END IF;
  RETURN jsonb_build_object('valid', true, 'discount', v_eval.discount, 'code', v_eval.code, 'message', 'Code promo appliqué');
END $$;
REVOKE ALL ON FUNCTION public.preview_shop_promo_code(uuid, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_shop_promo_code(uuid, text, numeric, text, text) TO anon, authenticated, service_role;

-- ---------- 8. create_public_order avec p_promo_code ----------
-- L'ancienne signature (10 paramètres) est supprimée : le nouveau paramètre est facultatif, un appel sans code reste valide.
DROP FUNCTION IF EXISTS public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text);

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
  p_order_status text DEFAULT 'new',
  p_promo_code text DEFAULT NULL
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
  v_promo text := upper(btrim(COALESCE(p_promo_code, '')));
  v_subtotal numeric;
  v_eval record;
  v_discount numeric := 0;
  v_promo_applied boolean := false;
  v_promo_message text;
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

  -- ---------- Code promo (décidé par le serveur ; un code refusé ne bloque pas la commande) ----------
  -- Un refus par exception annulerait la transaction, donc aussi la limitation de débit : des codes pourraient
  -- alors être devinés sans limite. La commande est créée au prix plein et la raison du refus est renvoyée.
  IF v_promo <> '' THEN
    SELECT subtotal INTO v_subtotal FROM public.orders WHERE id = v_order_id;
    SELECT * INTO v_eval FROM public.evaluate_shop_promo(p_shop_id, v_promo, v_subtotal, v_phone, v_email, true);
    IF v_eval.error IS NULL THEN
      UPDATE public.promo_codes SET current_uses = current_uses + 1, updated_at = now() WHERE id = v_eval.promo_id;
      UPDATE public.orders SET promo_code = v_eval.code, discount_amount = v_eval.discount WHERE id = v_order_id;
      PERFORM public.recompute_order_totals_for(v_order_id);
      v_promo_applied := true;
      v_discount := v_eval.discount;
    ELSE
      v_promo_message := v_eval.error;
    END IF;
  END IF;

  SELECT total INTO v_total FROM public.orders WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'discount', v_discount,
    'promo_applied', v_promo_applied,
    'promo_message', v_promo_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text, text)
  TO anon, authenticated, service_role;
