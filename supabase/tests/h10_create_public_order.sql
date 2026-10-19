-- Tests du correctif H10 : création de commande publique par RPC create_public_order
-- (migration 20261018120000_h10_create_public_order_rpc.sql).
--
-- Base JETABLE uniquement (jamais la base de dev ou de prod). Image de référence :
--   public.ecr.aws/supabase/postgres:17.6.1.155 (rôles anon / authenticated / service_role et schéma auth réels).
--
-- Ce fichier crée des tables minimales et des copies des définitions réelles, puis les cas de test. Les deux
-- migrations C6 (20261015120000) et H10 s'insèrent entre les deux moitiés :
--   docker run -d --rm --name h10-pgtest -e POSTGRES_PASSWORD=test public.ecr.aws/supabase/postgres:17.6.1.155
--   (sed -n '1,/^-- ====== FIN DU SCHÉMA/p' supabase/tests/h10_create_public_order.sql;
--    cat supabase/migrations/20261015120000_c6_order_bundles_and_public_insert_guard.sql;
--    cat supabase/migrations/20261018120000_h10_create_public_order_rpc.sql;
--    sed -n '/^-- ====== FIN DU SCHÉMA/,$p' supabase/tests/h10_create_public_order.sql) \
--   | docker exec -i h10-pgtest psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1
-- Les messages d'erreur attendus sont en anglais pour « permission denied » : lancer avec lc_messages = 'C'.
-- Les fonctions auth.role() / auth.uid() de cette image lisent request.jwt.claim.role / .sub.
-- Chaque cas affiche « OK : ... » ; toute erreur arrête le script.

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, commission_rate numeric,
  subscription_active_until timestamptz, subscription_plan text, is_subscribed boolean,
  is_published boolean NOT NULL DEFAULT true, is_activated boolean NOT NULL DEFAULT true
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, name text NOT NULL, price numeric NOT NULL,
  is_published boolean DEFAULT true, stock_quantity integer, bundle_offers jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, image_url text NOT NULL,
  display_order integer DEFAULT 0, is_primary boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL, customer_email text, customer_phone text NOT NULL, customer_address text,
  customer_city text, customer_country text, products_summary text,
  subtotal numeric NOT NULL DEFAULT 0, total numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0, payment_method text NOT NULL DEFAULT 'mobile_money',
  payment_status text NOT NULL DEFAULT 'pending', order_status text NOT NULL DEFAULT 'new',
  delivery_provider_id uuid, delivery_transferred_at timestamptz, internal_delivery_note text,
  scheduled_delivery_date timestamptz, is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL, product_name text NOT NULL, product_image_url text, quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL, total_price numeric NOT NULL, selected_variants jsonb
);

-- Copies des définitions réelles
CREATE FUNCTION public.is_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id);
$$;
CREATE FUNCTION public.is_shop_publicly_visible(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND is_published = true AND is_activated = true);
$$;
CREATE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE order_num text; num_exists boolean;
BEGIN
  LOOP
    order_num := 'VP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5));
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = order_num) INTO num_exists;
    EXIT WHEN NOT num_exists;
  END LOOP;
  RETURN order_num;
END $$;
CREATE TABLE public.rate_limit_hits (bucket text NOT NULL, key text NOT NULL, hit_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION public.check_rate_limit(_bucket text, _key text, _max integer, _window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF _bucket IS NULL OR _key IS NULL OR _max IS NULL OR _window_seconds IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'count', 0);
  END IF;
  DELETE FROM public.rate_limit_hits WHERE bucket = _bucket AND key = _key AND hit_at < now() - make_interval(secs => _window_seconds * 4);
  SELECT count(*) INTO v_count FROM public.rate_limit_hits
   WHERE bucket = _bucket AND key = _key AND hit_at >= now() - make_interval(secs => _window_seconds);
  IF v_count >= _max THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', _max, 'retry_after_seconds', _window_seconds);
  END IF;
  INSERT INTO public.rate_limit_hits(bucket, key) VALUES (_bucket, _key);
  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', _max);
END $$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid; v_subtotal numeric; v_rate numeric; v_sub_until timestamptz; v_sub_plan text;
  v_is_sub boolean; v_commission_amount numeric := 0;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal FROM public.order_items WHERE order_id = v_order_id;
  SELECT COALESCE(s.commission_rate, 0.025), s.subscription_active_until, s.subscription_plan, COALESCE(s.is_subscribed, false)
    INTO v_rate, v_sub_until, v_sub_plan, v_is_sub
    FROM public.orders o JOIN public.shops s ON s.id = o.shop_id WHERE o.id = v_order_id;
  IF (v_sub_until IS NOT NULL AND v_sub_until > now())
     OR (v_is_sub = true AND COALESCE(v_sub_plan, 'free') NOT IN ('free', 'starter_free'))
     OR v_rate = 0 THEN
    v_commission_amount := 0;
  ELSE
    v_commission_amount := ROUND(v_subtotal * COALESCE(v_rate, 0.025), 2);
  END IF;
  UPDATE public.orders SET subtotal = v_subtotal, total = v_subtotal, commission_amount = v_commission_amount,
         updated_at = now() WHERE id = v_order_id;
  RETURN NULL;
END $$;
CREATE TRIGGER recompute_order_totals AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_order_totals();

-- Anciennes politiques d'insertion publique (état de production avant H10)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create orders for visible shops" ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_shop_publicly_visible(shop_id));
CREATE POLICY "Insert items only for fresh public orders" ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'h10_app') THEN CREATE ROLE h10_app LOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO h10_app;

-- Aide : vérifie qu'une instruction échoue avec un message contenant `p_expected`
CREATE FUNCTION public.t_expect_error(p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || p_expected || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'erreur inattendue : % (attendu : %)', SQLERRM, p_expected;
  END;
  RAISE EXCEPTION 'aucune erreur alors que « % » était attendu', p_expected;
END $$;

-- ====== FIN DU SCHÉMA (les migrations C6 et H10 s'insèrent ici) ======

\set owner '''11111111-1111-1111-1111-111111111111'''
INSERT INTO public.shops (id, user_id, commission_rate, is_published) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', :owner, 0.025, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', :owner, 0.025, true),
  ('aaaaaaaa-0000-0000-0000-000000000009', :owner, 0.025, false);
INSERT INTO public.products (id, shop_id, name, price, is_published, bundle_offers) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Montre', 10000, true,
   '[{"quantity":3,"price":24000,"label":"Lot de 3"}]'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Sac', 5000, true, '[]'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Brouillon', 100, false, '[]'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Autre boutique', 100, true, '[]'::jsonb);
INSERT INTO public.product_images (product_id, image_url, is_primary, display_order) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000002', 'https://img/secondaire.jpg', false, 5),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'https://img/principale.jpg', true, 9);

\set shop '''aaaaaaaa-0000-0000-0000-000000000001'''
\set p_watch '''bbbbbbbb-0000-0000-0000-000000000001'''
\set p_bag '''bbbbbbbb-0000-0000-0000-000000000002'''

-- 1. Visiteur anonyme : commande complète, prix et statuts décidés par le serveur
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
CREATE TEMP TABLE t_res AS SELECT public.create_public_order(
  :shop::uuid, '  Awa Koné ', '+225 07 00 00 00 01',
  jsonb_build_array(
    jsonb_build_object('product_id', :p_watch, 'quantity', 3, 'bundle_index', 0),
    jsonb_build_object('product_id', :p_bag, 'quantity', 2, 'selected_variants', jsonb_build_object('Couleur', 'Rouge', 'Taille', 'M'))),
  'awa@example.com', 'Cocody', 'Abidjan', 'Côte d''Ivoire', 'cash_on_delivery') AS r;
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$
DECLARE o record; res jsonb := (SELECT r FROM t_res); n int;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = (res ->> 'order_id')::uuid;
  ASSERT o.customer_name = 'Awa Koné', 'nom nettoyé';
  ASSERT o.order_status = 'new' AND o.payment_status = 'pending', 'statuts initiaux';
  ASSERT o.total = 24000 + 10000, 'total serveur : lot de 3 à 24000 + 2 sacs à 5000';
  ASSERT (res ->> 'total')::numeric = 34000, 'total renvoyé';
  ASSERT o.commission_amount = ROUND(34000 * 0.025, 2), 'commission recalculée par le serveur';
  ASSERT o.order_number LIKE 'VP-%', 'numéro généré par le serveur';
  ASSERT o.products_summary = '3× Montre ; 2× Sac (Couleur: Rouge, Taille: M)' OR o.products_summary = '3× Montre ; 2× Sac (Taille: M, Couleur: Rouge)',
    'résumé construit par le serveur : ' || o.products_summary;
  SELECT count(*) INTO n FROM public.order_items WHERE order_id = o.id;
  ASSERT n = 2, 'deux lignes';
  ASSERT (SELECT product_image_url FROM public.order_items WHERE order_id = o.id AND product_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'https://img/principale.jpg', 'image principale';
  ASSERT (SELECT selected_variants ->> 'Couleur' FROM public.order_items WHERE order_id = o.id AND product_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'Rouge', 'variantes conservées';
  ASSERT (SELECT bundle_index FROM public.order_items WHERE order_id = o.id AND product_id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0, 'lot conservé';
  RAISE NOTICE 'OK : commande anonyme créée, total %, commission % décidés par le serveur', o.total, o.commission_amount;
END $$;

-- 2. Statut demandé : 'pending' conservé (commande directe), tout autre ramené à 'new'
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
CREATE TEMP TABLE t_res2 AS
  SELECT public.create_public_order(:shop::uuid, 'Client Deux', '0700000002', jsonb_build_array(jsonb_build_object('product_id', :p_bag, 'quantity', 1)), NULL, NULL, NULL, NULL, 'cod', 'pending') AS r
  UNION ALL
  SELECT public.create_public_order(:shop::uuid, 'Client Trois', '0700000003', jsonb_build_array(jsonb_build_object('product_id', :p_bag, 'quantity', 1)), NULL, NULL, NULL, NULL, 'mobile_money', 'delivered');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT order_status FROM public.orders WHERE customer_name = 'Client Deux') = 'pending', 'pending conservé';
  ASSERT (SELECT order_status FROM public.orders WHERE customer_name = 'Client Trois') = 'new', 'delivered ramené à new';
  ASSERT (SELECT payment_status FROM public.orders WHERE customer_name = 'Client Trois') = 'pending', 'paiement toujours pending';
  RAISE NOTICE 'OK : statut initial imposé (pending/new), paiement pending';
END $$;

-- 3. L'insertion directe est fermée pour anon et authenticated
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
SELECT public.t_expect_error($$INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'X-1', 'Pirate', '0700000009')$$, 'permission denied');
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, total_price)
  VALUES (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'x', 1, 1)$$, 'permission denied');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT public.t_expect_error($$INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'X-2', 'Pirate', '0700000009')$$, 'permission denied');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.orders WHERE customer_name = 'Pirate'), 'aucune commande pirate';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename IN ('orders', 'order_items') AND cmd = 'INSERT'), 'plus de politique INSERT';
  RAISE NOTICE 'OK : INSERT direct refusé pour anon et authenticated, politiques supprimées';
END $$;

-- 4. Entrées invalides refusées, rien n'est créé
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000009'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'Boutique indisponible');
SELECT public.t_expect_error($$SELECT public.create_public_order(gen_random_uuid(), 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'Boutique indisponible');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'A', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'Nom invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', 'abc', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'téléphone invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb, 'pas-un-mail')$$, 'e-mail invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb, NULL, NULL, NULL, NULL, 'gratuit')$$, 'paiement invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[]'::jsonb)$$, 'Panier invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', NULL)$$, 'Panier invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '{"a":1}'::jsonb)$$, 'Panier invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010',
  (SELECT jsonb_agg(jsonb_build_object('product_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'quantity', 1)) FROM generate_series(1, 51)))$$, 'Panier invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":0}]'::jsonb)$$, 'Quantité invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1000}]'::jsonb)$$, 'Article invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":"abc"}]'::jsonb)$$, 'Article invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"pas-un-uuid","quantity":1}]'::jsonb)$$, 'Article invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-0000000000ff","quantity":1}]'::jsonb)$$, 'Produit indisponible');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000003","quantity":1}]'::jsonb)$$, 'Produit indisponible');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000004","quantity":1}]'::jsonb)$$, 'Produit indisponible');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":3,"bundle_index":7}]'::jsonb)$$, 'Offre en lot invalide');
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Awa Koné', '0700000010', '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":2,"bundle_index":0}]'::jsonb)$$, 'inférieure');
-- Atomicité : première ligne valide, seconde invalide -> aucune commande créée
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Atomique', '0700000011',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1},{"product_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":3,"bundle_index":9}]'::jsonb)$$, 'Offre en lot invalide');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.orders WHERE customer_name = 'Atomique'), 'transaction annulée : aucune commande orpheline';
  ASSERT (SELECT count(*) FROM public.orders) = 3, 'seulement les 3 commandes valides existent';
  RAISE NOTICE 'OK : entrées invalides refusées, créations atomiques';
END $$;

-- 4 bis. Nom et téléphone désactivés dans checkout_fields : chaînes vides acceptées (comportement historique)
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
SELECT public.create_public_order(:shop::uuid, '', '', jsonb_build_array(jsonb_build_object('product_id', :p_bag, 'quantity', 1)));
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.orders WHERE customer_name = '' AND customer_phone = '') = 1, 'commande sans nom ni téléphone';
  RAISE NOTICE 'OK : nom et téléphone vides acceptés';
END $$;

-- 5. Utilisateur connecté (non propriétaire) : même chemin, mêmes règles
SET SESSION AUTHORIZATION h10_app;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT public.create_public_order(:shop::uuid, 'Connecté', '0700000012', jsonb_build_array(jsonb_build_object('product_id', :p_bag, 'quantity', 1)));
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT order_status || payment_status FROM public.orders WHERE customer_name = 'Connecté') = 'newpending';
  RAISE NOTICE 'OK : utilisateur connecté, mêmes règles';
END $$;

-- 6. Limitation de débit par couple boutique + téléphone : 5 par heure
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  FOR i IN 1..5 LOOP
    PERFORM public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Répété', '+225 07 11 11 11 11',
      jsonb_build_array(jsonb_build_object('product_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'quantity', 1)));
  END LOOP;
END $$;
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Répété', '+22507 1111 1111',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'pour ce numéro');
-- Un autre numéro, ou la même personne sur une autre boutique, n'est pas bloqué
SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Autre', '0700000013',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb);
SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'Répété', '+225 07 11 11 11 11',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000004","quantity":1}]'::jsonb);
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.orders WHERE customer_name = 'Répété') = 6, '5 sur la boutique 1 + 1 sur la boutique 2';
  RAISE NOTICE 'OK : limite boutique + téléphone (5/heure), autres numéros et boutiques non bloqués';
END $$;

-- 7. Limitation de débit par IP (en-tête posé par Cloudflare) : 10 par 10 minutes
SET SESSION AUTHORIZATION h10_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false),
       set_config('request.headers', '{"cf-connecting-ip":"203.0.113.7","x-forwarded-for":"1.2.3.4"}', false);
DO $$ BEGIN
  FOR i IN 1..10 LOOP
    PERFORM public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Bot ' || i, '07000001' || lpad(i::text, 2, '0'),
      jsonb_build_array(jsonb_build_object('product_id', 'bbbbbbbb-0000-0000-0000-000000000002', 'quantity', 1)));
  END LOOP;
END $$;
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Bot 11', '0700000199',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'Trop de commandes en peu de temps');
-- Falsifier x-forwarded-for ne contourne rien : seul cf-connecting-ip compte
SELECT set_config('request.headers', '{"cf-connecting-ip":"203.0.113.7","x-forwarded-for":"9.9.9.9"}', false);
SELECT public.t_expect_error($$SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Bot 12', '0700000198',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb)$$, 'Trop de commandes en peu de temps');
-- Une autre IP passe
SELECT set_config('request.headers', '{"cf-connecting-ip":"198.51.100.2"}', false);
SELECT public.create_public_order('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Autre IP', '0700000197',
  '[{"product_id":"bbbbbbbb-0000-0000-0000-000000000002","quantity":1}]'::jsonb);
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  RAISE NOTICE 'OK : limite par IP (10/10 min), x-forwarded-for ignoré, autre IP acceptée';
END $$;

-- 8. Droits d'exécution
DO $$ BEGIN
  ASSERT has_function_privilege('anon', 'public.create_public_order(uuid,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE'), 'anon appelle la RPC';
  ASSERT NOT has_function_privilege('anon', 'public.check_rate_limit(text,text,integer,integer)', 'EXECUTE'), 'anon n''appelle pas check_rate_limit';
  RAISE NOTICE 'OK : RPC publique, check_rate_limit réservée au serveur';
END $$;

-- 9. service_role et propriétaire gardent l'écriture directe (Edge Functions)
SET SESSION AUTHORIZATION h10_app;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false), set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, payment_status)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'SVC-1', 'Service', '0700000014', 'PAID');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT payment_status FROM public.orders WHERE customer_name = 'Service') = 'PAID';
  RAISE NOTICE 'OK : service_role inchangé';
END $$;
