-- Tests de 20261021150000_restricted_shop_orders_server_masking.sql
--
-- Base JETABLE uniquement (jamais dev ni prod). Trois fichiers, dans cet ordre, sur la même base :
--   1. ce fichier : rôles, tables et politiques d'AVANT la migration, fonctions d'aide, constat de l'état initial ;
--   2. supabase/migrations/20261021150000_restricted_shop_orders_server_masking.sql ;
--   3. supabase/tests/restricted_shop_orders_cases.sql : les cas de test et le bilan.
-- Exemple : psql -v ON_ERROR_STOP=1 -f 1 -f 2 -f 3 (voir docs/DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md).

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

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'founder', 'co_founder');
CREATE TYPE public.shop_collab_role AS ENUM ('view_orders', 'manage_delivered_orders', 'edit_shop');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.shops (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  shop_payment_status text NOT NULL DEFAULT 'active',
  is_suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE public.shop_collaborators (
  shop_id uuid NOT NULL, user_id uuid, status text NOT NULL DEFAULT 'active',
  roles public.shop_collab_role[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text, shop_id uuid NOT NULL,
  customer_name text, customer_phone text, customer_email text,
  customer_address text, customer_city text, customer_country text,
  subtotal numeric, total numeric, commission_amount numeric,
  payment_method text, payment_status text, order_status text,
  products_summary text, received_during_lock boolean DEFAULT false,
  is_read boolean DEFAULT false, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.orders, public.shops, public.shop_collaborators, public.user_roles TO authenticated;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE FUNCTION public.is_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id);
$$;
CREATE FUNCTION public.is_shop_collaborator(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_collaborators WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active');
$$;
CREATE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_collaborators
                  WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active' AND _role = ANY(roles));
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role), public.is_shop_owner(uuid, uuid),
  public.is_shop_collaborator(uuid, uuid), public.has_shop_role(uuid, uuid, public.shop_collab_role)
  TO anon, authenticated, service_role;

-- Politiques d'AVANT la migration (état de 20260627023426) : la migration doit les remplacer.
CREATE POLICY "Shop owners can view orders unlocked" ON public.orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.user_id = auth.uid()
                  AND COALESCE(s.is_suspended, false) = false));
CREATE POLICY "Collaborators can view shop orders unlocked" ON public.orders FOR SELECT
  USING ((public.has_shop_role(shop_id, auth.uid(), 'view_orders'::public.shop_collab_role)
          OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'::public.shop_collab_role))
         AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND COALESCE(s.is_suspended, false) = false));

-- Boutiques : A active ; S suspendue (is_suspended) ; O statut PAYMENT_OVERDUE SANS suspension (le trou d'avant) ;
-- R STORE_RESTRICTED + suspendue (cas réel de enforce_shop_billing_deadlines) ; P payment_pending (non restreinte).
INSERT INTO public.shops VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000a', 'active', false),
  ('55555555-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000005a', 'active', true),
  ('00000000-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000b', 'PAYMENT_OVERDUE', false),
  ('cccccccc-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-00000000000c', 'STORE_RESTRICTED', true),
  ('dddddddd-0000-0000-0000-00000000000d', '11111111-0000-0000-0000-00000000000d', 'payment_pending', false);
INSERT INTO public.shop_collaborators (shop_id, user_id, status, roles) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000001', 'active', '{view_orders}'),
  ('00000000-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002', 'active', '{view_orders}');
INSERT INTO public.user_roles VALUES ('33333333-0000-0000-0000-000000000001', 'founder');
INSERT INTO public.orders (order_number, shop_id, customer_name, customer_phone, customer_email, customer_address, customer_city, notes) VALUES
  ('A-1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Awa Client', '+22501', 'awa@x.ci', '1 rue A', 'Abidjan', 'appeler Mme Awa'),
  ('S-1', '55555555-0000-0000-0000-00000000000a', 'Sali Client', '+22505', 'sali@x.ci', '5 rue S', 'Daloa', 'note S'),
  ('O-1', '00000000-0000-0000-0000-00000000000a', 'Olga Client', '+22506', 'olga@x.ci', '6 rue O', 'Man', 'note O'),
  ('R-1', 'cccccccc-0000-0000-0000-00000000000c', 'Rita Client', '+22504', 'rita@x.ci', '4 rue R', 'Yamoussoukro', 'note R'),
  ('P-1', 'dddddddd-0000-0000-0000-00000000000d', 'Paul Client', '+22507', 'paul@x.ci', '7 rue P', 'Korhogo', 'note P');

CREATE TABLE public.rs_results (n serial, test text, expected text, observed text, pass boolean);

-- Lecture directe de orders (RLS) sous une identité : nombre de lignes visibles.
CREATE FUNCTION public.rs_direct(p_test text, p_role text, p_sub text, p_shop uuid, p_expected int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    SELECT count(*) INTO v_count FROM public.orders WHERE shop_id = p_shop;
    v_obs := 'rows=' || v_count;
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.rs_results (test, expected, observed, pass) VALUES (p_test, 'rows=' || p_expected, v_obs, v_obs = 'rows=' || p_expected);
END $$;

-- RPC sous une identité : lignes, masquage des noms/téléphones/notes.
CREATE FUNCTION public.rs_rpc(p_test text, p_role text, p_sub text, p_shop uuid, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_count int; v_restricted boolean; v_clear boolean; v_notes boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    SELECT count(*), bool_or(is_restricted),
           bool_or(customer_name ~ '^(Awa|Sali|Olga|Rita|Paul)' OR customer_phone LIKE '+225%'),
           bool_or(notes IS NOT NULL)
      INTO v_count, v_restricted, v_clear, v_notes FROM public.get_shop_orders_secure(p_shop);
    v_obs := format('rows=%s restricted=%s clear=%s notes=%s', v_count, v_restricted, v_clear, v_notes);
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.rs_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- AVANT la migration, le trou existe : PAYMENT_OVERDUE sans suspension est lisible en direct par son propriétaire.
-- (Ce bloc ne s'exécute que si la migration n'est PAS encore appliquée ; il documente l'état initial.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_shop_restricted') THEN
    PERFORM public.rs_direct('00 AVANT migration : propriétaire PAYMENT_OVERDUE lit en direct (trou)', 'authenticated',
                             '11111111-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 1);
  END IF;
END $$;

-- FIN DU SOCLE (appliquer ensuite la migration, puis restricted_shop_orders_cases.sql)
