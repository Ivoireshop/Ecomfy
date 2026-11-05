-- Socle des tests de 20261105100000_delivery_flow_guards.sql (flux commande -> affectation -> livraison).
--
-- Base JETABLE uniquement (jamais dev ni prod). Trois étapes sur la même base :
--   1. ce fichier : rôles, tables minimales, politiques et déclencheurs d'AVANT la migration (état de la prod) ;
--   2. supabase/migrations/20261105100000_delivery_flow_guards.sql ;
--   3. supabase/tests/delivery_flow_guards_cases.sql : cas de test et bilan.
-- Exemple (le dépôt n'a pas besoin de psql local) :
--   docker run -d --rm --name ecomfy-delivery-test -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/delivery_flow_guards.sql supabase/migrations/20261105100000_delivery_flow_guards.sql \
--        supabase/tests/delivery_flow_guards_cases.sql) | docker exec -i ecomfy-delivery-test psql -U postgres -v ON_ERROR_STOP=1
-- Le cas 00 (constat du bug de synchro, avant migration) est exécuté à la fin de ce fichier.

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

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  order_number text, customer_name text, customer_phone text, customer_address text, customer_city text,
  total numeric NOT NULL DEFAULT 0, payment_status text NOT NULL DEFAULT 'pending',
  order_status text NOT NULL DEFAULT 'new',
  delivery_provider_id uuid, delivery_transferred_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.delivery_providers (id uuid PRIMARY KEY, user_id uuid NOT NULL, company_name text, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.delivery_company_members (
  id uuid PRIMARY KEY, provider_id uuid NOT NULL REFERENCES public.delivery_providers(id), user_id uuid,
  role text NOT NULL, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.order_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id),
  driver_id uuid REFERENCES public.delivery_company_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','picked_up','in_transit','delivered','failed','returned')),
  picked_up_at timestamptz, delivered_at timestamptz,
  location_lat numeric, location_lng numeric, pod_signature_url text, pod_photo_url text, failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_delivery_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  delivery_provider_id uuid NOT NULL REFERENCES public.delivery_providers(id), status text NOT NULL DEFAULT 'active',
  auto_transfer boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, delivery_provider_id)
);
CREATE TABLE public.delivery_zones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL, name text, city text, is_active boolean DEFAULT true);
CREATE TABLE public.delivery_driver_zones (driver_id uuid NOT NULL, zone_id uuid NOT NULL, provider_id uuid NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER order_deliveries_set_updated_at BEFORE UPDATE ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Politiques d'AVANT (prod : 20260811064645 + 20261022100000)
CREATE POLICY "owner reads orders" ON public.orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.user_id = auth.uid()));
CREATE POLICY "owner updates orders" ON public.orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.user_id = auth.uid()));
CREATE POLICY "Owners read delivery provider" ON public.delivery_providers FOR SELECT USING (auth.uid() = user_id);

CREATE FUNCTION public.shop_owner_can_see_delivery_member(_member_id uuid, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_deliveries od JOIN public.orders o ON o.id = od.order_id
                   JOIN public.shops s ON s.id = o.shop_id WHERE od.driver_id = _member_id AND s.user_id = _user_id);
$$;
CREATE POLICY "Provider owners can manage memberships" ON public.delivery_company_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_company_members.provider_id AND dp.user_id = auth.uid()));
CREATE POLICY "Users can view their own memberships" ON public.delivery_company_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_company_members.provider_id AND dp.user_id = auth.uid()));
CREATE POLICY "Shop owners can view assigned delivery members" ON public.delivery_company_members FOR SELECT
  TO authenticated USING (public.shop_owner_can_see_delivery_member(id, auth.uid()));

CREATE POLICY "Shop owners can view deliveries for their orders" ON public.order_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id = o.shop_id WHERE o.id = order_deliveries.order_id AND s.user_id = auth.uid()));
CREATE POLICY "Delivery provider members can view their deliveries" ON public.order_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()));
CREATE POLICY "Delivery drivers can update their assigned deliveries" ON public.order_deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver'));
CREATE POLICY "Provider admins and dispatchers can manage deliveries" ON public.order_deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid() AND dcm.role IN ('admin','dispatcher'))
         OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_company_members dcm WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid() AND dcm.role IN ('admin','dispatcher'))
         OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()));

-- Déclencheurs d'AVANT (prod : 20260811064645)
CREATE FUNCTION public.sync_delivery_status_to_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE public.orders SET order_status = 'delivered', updated_at = now() WHERE id = NEW.order_id;
  ELSIF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM 'returned' THEN
    UPDATE public.orders SET order_status = 'returned', updated_at = now() WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_delivery_status_change AFTER UPDATE OF status ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_status_to_order();

CREATE FUNCTION public.auto_transfer_order_to_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_provider_id uuid;
BEGIN
  IF NEW.order_status = 'confirmed' AND (OLD.order_status IS DISTINCT FROM 'confirmed') AND NEW.delivery_provider_id IS NULL THEN
    SELECT sdc.delivery_provider_id INTO v_provider_id FROM public.shop_delivery_connections sdc
      JOIN public.delivery_providers dp ON dp.id = sdc.delivery_provider_id
     WHERE sdc.shop_id = NEW.shop_id AND sdc.status = 'active' AND sdc.auto_transfer = true AND dp.is_active = true
     ORDER BY sdc.created_at ASC LIMIT 1;
    IF v_provider_id IS NOT NULL THEN
      NEW.delivery_provider_id := v_provider_id; NEW.delivery_transferred_at := now();
      INSERT INTO public.order_deliveries (order_id, provider_id, status) VALUES (NEW.id, v_provider_id, 'pending') ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_auto_transfer_delivery BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_transfer_order_to_delivery();

-- Données. Utilisateurs : o = propriétaire de la boutique S ; p = propriétaire de PR1 ; q = propriétaire de PR2 ;
-- d1/d2 = livreurs de PR1 ; mg = dispatcher de PR1 ; di = livreur inactif de PR1 ; d4 = livreur de PR2 ; x = tiers.
INSERT INTO public.shops VALUES ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a');
INSERT INTO public.delivery_providers VALUES
  ('b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-00000000000b', 'PR1', true),
  ('b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-00000000000c', 'PR2', true);
INSERT INTO public.delivery_company_members (id, provider_id, user_id, role, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000000d', 'driver', true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-00000000000f', 'driver', true),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'dispatcher', true),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', 'driver', true),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'driver', false);
INSERT INTO public.shop_delivery_connections (shop_id, delivery_provider_id, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'active');
INSERT INTO public.delivery_zones (id, provider_id, name, city) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Abidjan', 'Abidjan');
INSERT INTO public.delivery_driver_zones (driver_id, zone_id, provider_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

INSERT INTO public.orders (id, shop_id, order_number, customer_name, customer_phone, customer_address, customer_city, total, payment_status, order_status) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'O1',  'Client 1',  '+22501', 'Rue 1', 'Abidjan', 10000, 'pending', 'confirmed'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'O2',  'Client 2',  '+22502', 'Rue 2', 'Abidjan', 15000, 'pending', 'confirmed'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'O3',  'Client 3',  '+22503', 'Rue 3', 'Abidjan', 20000, 'pending', 'shipped'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'O4',  'Client 4',  '+22504', 'Rue 4', 'Abidjan', 5000,  'pending', 'confirmed'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'O5',  'Client 5',  '+22505', 'Rue 5', 'Abidjan', 7000,  'pending', 'cancelled'),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'O6',  'Client 6',  '+22506', 'Rue 6', 'Abidjan', 8000,  'pending', 'confirmed'),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'O8',  'Client 8',  '+22508', 'Rue 8', 'Abidjan', 30000, 'paid',    'confirmed'),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'O9',  'Client 9',  '+22509', 'Rue 9', 'Abidjan', 9000,  'pending', 'shipped'),
  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'O10', 'Client 10', '+22510', 'Rue 10', 'Abidjan', 4000, 'pending', 'new');
-- O1 : confirmée sans livraison (cas « Expédier » ; O10 : cas auto-transfert)
INSERT INTO public.order_deliveries (order_id, provider_id, driver_id, status, failure_reason) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pending',    NULL),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'in_transit', NULL),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', NULL,                                   'pending',    NULL),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'in_transit', NULL),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'failed',     'Client absent'),
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pending',    NULL),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'in_transit', NULL);

CREATE TABLE public.fg_results (n serial, test text, expected text, observed text, pass boolean);

-- Cas 00 (AVANT migration) : un livreur marque « livré » une course dont la commande est annulée -> la commande est ressuscitée.
UPDATE public.order_deliveries SET status = 'delivered' WHERE order_id = 'd0000000-0000-0000-0000-000000000005';
INSERT INTO public.fg_results (test, expected, observed, pass)
SELECT '00 AVANT migration : commande annulée écrasée par la synchro', 'delivered (bug)', order_status, order_status = 'delivered'
  FROM public.orders WHERE id = 'd0000000-0000-0000-0000-000000000005';
-- Remise à l'état initial du jeu de données
UPDATE public.order_deliveries SET status = 'in_transit' WHERE order_id = 'd0000000-0000-0000-0000-000000000005';
UPDATE public.orders SET order_status = 'cancelled' WHERE id = 'd0000000-0000-0000-0000-000000000005';
