-- Tests de 20261022100000_delivery_rls_recursion_and_push_guard.sql
--
-- Base JETABLE uniquement (jamais dev ni prod). Quatre étapes sur la même base :
--   1. ce fichier : rôles, tables minimales et politiques d'AVANT la migration (copiées de dev) ;
--   2. la fonction push_order_to_delivery_provider d'AVANT (extraite de 20260811083400_delivery_driver_zones_and_push_order.sql) ;
--   3. supabase/migrations/20261022100000_delivery_rls_recursion_and_push_guard.sql puis 20261022110000_delivery_driver_contacts.sql ;
--   4. supabase/tests/delivery_rls_recursion_cases.sql : cas de test et bilan.
-- Exemple (le dépôt n'a pas besoin de psql local) :
--   (cat supabase/tests/delivery_rls_recursion.sql
--    sed -n '/CREATE OR REPLACE FUNCTION public.push_order_to_delivery_provider/,/^\$\$;/p' supabase/migrations/20260811083400_delivery_driver_zones_and_push_order.sql
--    cat supabase/migrations/20261022100000_delivery_rls_recursion_and_push_guard.sql supabase/migrations/20261022110000_delivery_driver_contacts.sql
--    cat supabase/tests/delivery_rls_recursion_cases.sql) | docker exec -i <conteneur> psql -U postgres -v ON_ERROR_STOP=1
-- Le cas 00 (constat de la récursion, avant migration) est exécuté à la fin de ce fichier, donc avant les étapes 2 à 4.

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  order_number text, customer_city text, order_status text NOT NULL DEFAULT 'new',
  delivery_provider_id uuid, delivery_transferred_at timestamptz
);
CREATE TABLE public.delivery_providers (id uuid PRIMARY KEY, user_id uuid NOT NULL, company_name text, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.delivery_company_members (
  id uuid PRIMARY KEY, provider_id uuid NOT NULL REFERENCES public.delivery_providers(id), user_id uuid,
  role text NOT NULL, is_active boolean NOT NULL DEFAULT true, name text, phone text
);
CREATE TABLE public.order_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id),
  driver_id uuid REFERENCES public.delivery_company_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','picked_up','in_transit','delivered','failed','returned')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_delivery_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  delivery_provider_id uuid NOT NULL REFERENCES public.delivery_providers(id), status text NOT NULL DEFAULT 'active',
  UNIQUE (shop_id, delivery_provider_id)
);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text, phone text);
CREATE TABLE public.delivery_zones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL, name text, city text, is_active boolean DEFAULT true);
CREATE TABLE public.delivery_driver_zones (driver_id uuid NOT NULL, zone_id uuid NOT NULL, provider_id uuid NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

-- Politiques d'AVANT (relevées sur dev le 22/10/2026)
CREATE POLICY "owner reads orders" ON public.orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.user_id = auth.uid()));
CREATE POLICY "Owners and founders read delivery provider" ON public.delivery_providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Provider owners can manage memberships" ON public.delivery_company_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_company_members.provider_id AND dp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_company_members.provider_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can view their own memberships" ON public.delivery_company_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_company_members.provider_id AND dp.user_id = auth.uid()));
CREATE POLICY "Shop owners can view assigned delivery members" ON public.delivery_company_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.order_deliveries od JOIN public.orders o ON o.id = od.order_id JOIN public.shops s ON s.id = o.shop_id
                  WHERE od.driver_id = delivery_company_members.id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners can view deliveries for their orders" ON public.order_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id = o.shop_id WHERE o.id = order_deliveries.order_id AND s.user_id = auth.uid()));
CREATE POLICY "Delivery provider members can view their deliveries" ON public.order_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()));

-- Données. Utilisateurs : o = propriétaire de la boutique S ; p = prestataire PR ; d = livreur de PR ; x = tiers.
INSERT INTO public.shops VALUES ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a');
INSERT INTO public.delivery_providers VALUES
  ('b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-00000000000b', 'PR connecté', true),
  ('b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-00000000000c', 'PR2 non connecté', true),
  ('b0000000-0000-0000-0000-000000000003', '22222222-0000-0000-0000-00000000000e', 'PR3 inactif', false);
INSERT INTO public.delivery_company_members (id, provider_id, user_id, role, name, phone) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000000d', 'driver', 'Livreur assigné', '+2250100000001'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000000f', 'driver', 'Livreur autre', '+2250100000002');
INSERT INTO public.profiles VALUES
  ('33333333-0000-0000-0000-00000000000d', 'Kouadio Livreur', '+2250100000001'),
  ('33333333-0000-0000-0000-00000000000f', 'Autre Livreur', '+2250100000002');
INSERT INTO public.shop_delivery_connections (shop_id, delivery_provider_id, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'active'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'active');
INSERT INTO public.orders (id, shop_id, order_number, customer_city, order_status) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'O1', 'Abidjan', 'new'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'O2', 'Abidjan', 'delivered'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'O3', 'Abidjan', 'confirmed'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'O4', 'Abidjan', 'new'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'O5', 'Abidjan', 'cancelled');
INSERT INTO public.order_deliveries (order_id, provider_id, driver_id, status) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'in_transit'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', NULL, 'failed');

CREATE TABLE public.dr_results (n serial, test text, expected text, observed text, pass boolean);

-- Requête du tableau de bord (« Suivi Livraison ») sous une identité : lignes de order_deliveries + livreur embarqué.
CREATE FUNCTION public.dr_track(p_test text, p_sub text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_rows int; v_drivers int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*), count(m.id) INTO v_rows, v_drivers
      FROM public.order_deliveries od LEFT JOIN public.delivery_company_members m ON m.id = od.driver_id;
    v_obs := format('rows=%s drivers=%s', v_rows, v_drivers);
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.dr_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- Membres de livraison visibles sous une identité.
CREATE FUNCTION public.dr_members(p_test text, p_sub text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_names text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT coalesce(string_agg(name, ',' ORDER BY name), '-') INTO v_names FROM public.delivery_company_members;
    v_obs := 'members=' || v_names;
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.dr_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- Appel du push sous une identité.
CREATE FUNCTION public.dr_push(p_test text, p_sub text, p_order uuid, p_provider uuid, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_res json;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    v_res := public.push_order_to_delivery_provider(p_order, p_provider);
    v_obs := CASE WHEN (v_res ->> 'success')::boolean THEN 'ok' ELSE 'refus ' || (v_res ->> 'error') END;
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.dr_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- Constat AVANT migration : le propriétaire de la boutique ne peut pas lire ses livraisons (récursion).
SELECT public.dr_track('00 AVANT migration : propriétaire lit ses livraisons (récursion attendue)', '11111111-0000-0000-0000-00000000000a', 'err infinite recursion%');
