-- Tests du correctif C6 (suite) : offres en lot et verrou d'insertion publique des commandes
-- (migration 20261015120000_c6_order_bundles_and_public_insert_guard.sql).
--
-- Base JETABLE uniquement (jamais la base de dev ou de prod). Image de référence :
--   public.ecr.aws/supabase/postgres:17.6.1.155 (rôles anon / authenticated / service_role et schéma auth réels).
--
-- Ce fichier crée des tables minimales et des copies des définitions réelles (recompute_order_totals,
-- is_shop_owner), puis les cas de test. La migration doit être exécutée entre les deux :
--   docker run -d --rm --name c6-pgtest -e POSTGRES_PASSWORD=test public.ecr.aws/supabase/postgres:17.6.1.155
--   (sed -n '1,/^-- ====== FIN DU SCHÉMA/p' supabase/tests/c6_order_pricing.sql;
--    cat supabase/migrations/20261015120000_c6_order_bundles_and_public_insert_guard.sql;
--    sed -n '/^-- ====== FIN DU SCHÉMA/,$p' supabase/tests/c6_order_pricing.sql) \
--   | docker exec -i c6-pgtest psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1
-- Les fonctions auth.role() / auth.uid() de cette image lisent request.jwt.claim.role / .sub.
-- Chaque cas affiche « OK : ... » ; toute erreur arrête le script.

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, commission_rate numeric,
  subscription_active_until timestamptz, subscription_plan text, is_subscribed boolean
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, name text NOT NULL, price numeric NOT NULL,
  is_published boolean DEFAULT true, stock_quantity integer, bundle_offers jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, order_number text, customer_name text,
  customer_phone text, subtotal numeric NOT NULL DEFAULT 0, total numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0, payment_method text DEFAULT 'cash_on_delivery',
  payment_status text NOT NULL DEFAULT 'pending', order_status text NOT NULL DEFAULT 'new',
  delivery_provider_id uuid, delivery_transferred_at timestamptz, internal_delivery_note text,
  scheduled_delivery_date timestamptz, is_read boolean DEFAULT false, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL, product_name text, quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL, total_price numeric NOT NULL
);

-- Copies des définitions réelles (migrations 20260522181112 et 20260912000000)
CREATE FUNCTION public.is_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id);
$$;
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

-- État de production AVANT la migration : trigger de prix sans lots (migration 20260615165600)
CREATE FUNCTION public.enforce_order_item_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product record; v_order_shop uuid;
BEGIN
  SELECT shop_id INTO v_order_shop FROM public.orders WHERE id = NEW.order_id;
  IF v_order_shop IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  SELECT id, shop_id, price, name, is_published INTO v_product FROM public.products WHERE id = NEW.product_id;
  IF v_product.id IS NULL OR v_product.shop_id <> v_order_shop OR v_product.is_published <> true THEN
    RAISE EXCEPTION 'Produit indisponible';
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 999 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
  NEW.unit_price := v_product.price;
  NEW.total_price := ROUND(v_product.price * NEW.quantity, 2);
  NEW.product_name := COALESCE(NULLIF(btrim(NEW.product_name), ''), v_product.name);
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_order_item_price BEFORE INSERT OR UPDATE OF product_id, quantity, unit_price, total_price
  ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'c6_app') THEN CREATE ROLE c6_app LOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO c6_app;

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

-- ====== FIN DU SCHÉMA (la migration s'insère ici) ======

\set owner '''11111111-1111-1111-1111-111111111111'''
INSERT INTO public.shops (id, user_id, commission_rate) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', :owner, 0.025);
INSERT INTO public.products (id, shop_id, name, price, bundle_offers) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Montre', 10000,
   '[{"quantity":3,"price":24000,"label":"Lot de 3"},{"quantity":"x","price":5}, {"quantity":2}]'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Sac', 5000, '[]'::jsonb);
INSERT INTO public.orders (id, shop_id, order_number) VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-1');

-- 1. Sans lot : le prix de la base prévaut sur celui du client
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 2, 1, 1);
DO $$ BEGIN
  ASSERT (SELECT total FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000001') = 10000, 'sans lot : total = 2 x 5000';
  RAISE NOTICE 'OK : article sans lot, prix client ignoré';
END $$;

-- 2. Lot de 3 à 24 000 : quantité 3 -> 24 000 ; quantité 5 -> 40 000 (8 000 l'unité)
DELETE FROM public.order_items;
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 3, 1, 1, 0);
DO $$ BEGIN
  ASSERT (SELECT total FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000001') = 24000, 'lot de 3 = 24000';
  ASSERT (SELECT unit_price FROM public.order_items LIMIT 1) = 8000, 'prix unitaire du lot = 8000';
  RAISE NOTICE 'OK : lot de 3 facturé 24 000';
END $$;
UPDATE public.order_items SET quantity = 5;
DO $$ BEGIN
  ASSERT (SELECT total FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000001') = 40000, 'lot x5 = 40000';
  RAISE NOTICE 'OK : quantité 5 au prix unitaire du lot';
END $$;

-- 3. Retirer le lot (UPDATE de bundle_index) rétablit le prix plein
UPDATE public.order_items SET bundle_index = NULL;
DO $$ BEGIN
  ASSERT (SELECT total FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000001') = 50000, 'sans lot x5 = 50000';
  RAISE NOTICE 'OK : bundle_index remis à NULL = prix plein';
END $$;

-- 4. Lots invalides refusés
DELETE FROM public.order_items;
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 2, 1, 1, 0)$$, 'inférieure');
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 3, 1, 1, 9)$$, 'Offre en lot invalide');
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 3, 1, 1, -1)$$, 'Offre en lot invalide');
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 3, 1, 1, 1)$$, 'Offre en lot invalide'); -- quantité non numérique
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 3, 1, 1, 2)$$, 'Offre en lot invalide'); -- prix absent
SELECT public.t_expect_error($$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, bundle_index)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 1, 1, 0)$$, 'Offre en lot invalide'); -- produit sans lot
DO $$ BEGIN RAISE NOTICE 'OK : lots invalides refusés (quantité trop faible, index hors tableau, négatif, malformé, produit sans lot)'; END $$;

-- 5. Insertion publique : valeurs imposées pour un visiteur anonyme
SET SESSION AUTHORIZATION c6_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.orders (id, shop_id, order_number, payment_status, order_status, commission_amount, delivery_provider_id,
  internal_delivery_note, scheduled_delivery_date, is_read, total)
VALUES ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-2', 'PAID', 'delivered', 99999,
  gen_random_uuid(), 'note', now(), true, 1);
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000002';
  ASSERT o.payment_status = 'pending', 'payment_status imposé';
  ASSERT o.order_status = 'new', 'order_status imposé';
  ASSERT o.commission_amount = 0, 'commission imposée';
  ASSERT o.delivery_provider_id IS NULL AND o.internal_delivery_note IS NULL AND o.scheduled_delivery_date IS NULL, 'livraison imposée';
  ASSERT o.is_read = false, 'is_read imposé';
  RAISE NOTICE 'OK : visiteur anonyme : PAID/delivered/commission/livraison ramenés aux valeurs sûres';
END $$;

-- 6. Un statut de commande légitime ('pending') est conservé
SET SESSION AUTHORIZATION c6_app;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.orders (id, shop_id, order_number, order_status) VALUES ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-3', 'pending');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT order_status FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000003') = 'pending';
  RAISE NOTICE 'OK : statut pending conservé (commande directe de la page d''accueil)';
END $$;

-- 7. Un utilisateur connecté qui n'est PAS le propriétaire est traité comme un visiteur
SET SESSION AUTHORIZATION c6_app;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
INSERT INTO public.orders (id, shop_id, order_number, payment_status) VALUES ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-4', 'PAID');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT payment_status FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000004') = 'pending';
  RAISE NOTICE 'OK : utilisateur connecté non propriétaire = visiteur';
END $$;

-- 8. Le propriétaire de la boutique et le service_role gardent la main
SET SESSION AUTHORIZATION c6_app;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
INSERT INTO public.orders (id, shop_id, order_number, payment_status, order_status) VALUES ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-5', 'PAID', 'delivered');
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false), set_config('request.jwt.claim.sub', '', false);
INSERT INTO public.orders (id, shop_id, order_number, payment_status) VALUES ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'T-6', 'PAID');
RESET ROLE;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  ASSERT (SELECT payment_status || order_status FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000005') = 'PAIDdelivered', 'propriétaire inchangé';
  ASSERT (SELECT payment_status FROM public.orders WHERE id = 'cccccccc-0000-0000-0000-000000000006') = 'PAID', 'service_role inchangé';
  RAISE NOTICE 'OK : propriétaire et service_role non bridés';
END $$;

-- 9. La fonction du trigger n'est pas appelable par l'API
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.guard_public_order_insert()', 'EXECUTE'), 'anon ne doit pas pouvoir exécuter guard_public_order_insert';
  RAISE NOTICE 'OK : guard_public_order_insert non exécutable par anon';
END $$;
