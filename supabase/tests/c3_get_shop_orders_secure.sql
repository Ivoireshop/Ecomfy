-- Tests du correctif C3 : contrôle de propriété sur get_shop_orders_secure.
--
-- Base JETABLE uniquement (jamais la base de dev ou de prod). Image de référence :
--   public.ecr.aws/supabase/postgres:17.6.1.155 (rôles anon / authenticated / service_role réels).
--
-- Ce fichier crée des tables minimales, puis exécute les cas de test. La fonction testée
-- (de "CREATE OR REPLACE FUNCTION public.get_shop_orders_secure" au GRANT, dans
-- 20260909100000_ecomfy_billing_threshold_system.sql) doit être fournie AVANT ce fichier :
--   (sed -n '/CREATE OR REPLACE FUNCTION public.get_shop_orders_secure/,/GRANT EXECUTE ON FUNCTION public.get_shop_orders_secure/p' \
--      supabase/migrations/20260909100000_ecomfy_billing_threshold_system.sql; \
--    cat supabase/tests/c3_get_shop_orders_secure.sql) \
--   | docker exec -i <conteneur> psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1

\set ON_ERROR_STOP on

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'founder', 'co_founder');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.shops (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  shop_payment_status text NOT NULL DEFAULT 'active'
);
CREATE TABLE public.shop_collaborators (
  shop_id uuid NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'active'
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

-- Copies des définitions réelles (migrations 20251104003056, 20260522181112, 20260916193000)
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
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role),
  public.is_shop_owner(uuid, uuid), public.is_shop_collaborator(uuid, uuid)
  TO anon, authenticated, service_role;
-- Identités
--   a1 = propriétaire de la boutique A (active), b1 = propriétaire de la boutique B (active)
--   r1 = propriétaire de la boutique R (STORE_RESTRICTED)
--   c1 = collaborateur actif de A, c2 = collaborateur invité (pending) de A
--   f1 = founder, f2 = co_founder, x1 = tiers sans aucun lien
INSERT INTO public.shops VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'active'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000002', 'active'),
  ('cccccccc-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-000000000003', 'STORE_RESTRICTED');
INSERT INTO public.shop_collaborators VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000001', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002', 'pending');
INSERT INTO public.user_roles VALUES
  ('33333333-0000-0000-0000-000000000001', 'founder'),
  ('33333333-0000-0000-0000-000000000002', 'co_founder');
INSERT INTO public.orders (order_number, shop_id, customer_name, customer_phone, customer_email, customer_address, customer_city) VALUES
  ('A-1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Awa Client', '+22501', 'awa@x.ci', '1 rue A', 'Abidjan'),
  ('A-2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Koffi Client', '+22502', 'koffi@x.ci', '2 rue A', 'Abidjan'),
  ('B-1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Bea Client', '+22503', 'bea@x.ci', '3 rue B', 'Bouake'),
  ('R-1', 'cccccccc-0000-0000-0000-00000000000c', 'Rita Client', '+22504', 'rita@x.ci', '4 rue R', 'Yamoussoukro');

CREATE TABLE public.c3_results (n serial, test text, expected text, observed text, pass boolean);

-- Exécute get_shop_orders_secure sous un rôle / une identité donnés et résume le résultat.
CREATE FUNCTION public.c3_run(p_test text, p_role text, p_sub text, p_shop uuid, p_expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_obs text;
  v_count int; v_restricted boolean; v_shops int; v_leak boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    SELECT count(*), bool_or(is_restricted), count(DISTINCT shop_id),
           bool_or(customer_name LIKE 'Awa%' OR customer_name LIKE 'Rita%' OR customer_name LIKE 'Bea%' OR customer_name LIKE 'Koffi%')
      INTO v_count, v_restricted, v_shops, v_leak
      FROM public.get_shop_orders_secure(p_shop);
    v_obs := format('ok rows=%s shops=%s restricted=%s clear_names=%s', v_count, v_shops, v_restricted::text, v_leak::text);
  EXCEPTION WHEN OTHERS THEN
    v_obs := 'err ' || SQLERRM;
  END;
  RESET ROLE;
  INSERT INTO public.c3_results (test, expected, observed, pass)
  VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

DO $$
DECLARE
  sa uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  sb uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  sr uuid := 'cccccccc-0000-0000-0000-00000000000c';
  a1 text := '11111111-0000-0000-0000-000000000001';
  b1 text := '11111111-0000-0000-0000-000000000002';
  r1 text := '11111111-0000-0000-0000-000000000003';
  c1 text := '22222222-0000-0000-0000-000000000001';
  c2 text := '22222222-0000-0000-0000-000000000002';
  f1 text := '33333333-0000-0000-0000-000000000001';
  f2 text := '33333333-0000-0000-0000-000000000002';
  x1 text := '44444444-0000-0000-0000-000000000001';
BEGIN
  PERFORM public.c3_run('01 anon, boutique A',                      'anon',          NULL, sa, 'err permission denied%');
  PERFORM public.c3_run('02 authenticated sans identité',            'authenticated', NULL, sa, 'err forbidden');
  PERFORM public.c3_run('03 authenticated tiers sur A',              'authenticated', x1,   sa, 'err forbidden');
  PERFORM public.c3_run('04 propriétaire B lit A',                   'authenticated', b1,   sa, 'err forbidden');
  PERFORM public.c3_run('05 propriétaire A lit A',                   'authenticated', a1,   sa, 'ok rows=2 shops=1 restricted=false clear_names=true');
  PERFORM public.c3_run('06 propriétaire A lit B',                   'authenticated', a1,   sb, 'err forbidden');
  PERFORM public.c3_run('07 collaborateur actif lit A',              'authenticated', c1,   sa, 'ok rows=2 shops=1 restricted=false clear_names=true');
  PERFORM public.c3_run('08 collaborateur invité (pending) lit A',   'authenticated', c2,   sa, 'err forbidden');
  PERFORM public.c3_run('09 collaborateur actif de A lit B',         'authenticated', c1,   sb, 'err forbidden');
  PERFORM public.c3_run('10 founder lit A',                          'authenticated', f1,   sa, 'ok rows=2 shops=1 restricted=false clear_names=true');
  PERFORM public.c3_run('11 co_founder lit B',                       'authenticated', f2,   sb, 'ok rows=1 shops=1 restricted=false clear_names=true');
  PERFORM public.c3_run('12 propriétaire boutique restreinte (masqué)', 'authenticated', r1, sr, 'ok rows=1 shops=1 restricted=true clear_names=false');
  PERFORM public.c3_run('13 tiers lit boutique restreinte',          'authenticated', x1,   sr, 'err forbidden');
  PERFORM public.c3_run('14 anon, boutique restreinte',              'anon',          NULL, sr, 'err permission denied%');
  PERFORM public.c3_run('15 service_role (pas de auth.uid())',       'service_role',  NULL, sa, 'err forbidden');
  PERFORM public.c3_run('16 boutique inexistante',                   'authenticated', a1,   gen_random_uuid(), 'err forbidden');
  PERFORM public.c3_run('17 UUID NULL',                              'authenticated', a1,   NULL, 'err forbidden');
END $$;

INSERT INTO public.c3_results (test, expected, observed, pass)
SELECT '18 droit EXECUTE anon = faux', 'false', has_function_privilege('anon', 'public.get_shop_orders_secure(uuid)', 'EXECUTE')::text,
       NOT has_function_privilege('anon', 'public.get_shop_orders_secure(uuid)', 'EXECUTE');
INSERT INTO public.c3_results (test, expected, observed, pass)
SELECT '19 droit EXECUTE authenticated = vrai', 'true', has_function_privilege('authenticated', 'public.get_shop_orders_secure(uuid)', 'EXECUTE')::text,
       has_function_privilege('authenticated', 'public.get_shop_orders_secure(uuid)', 'EXECUTE');

\pset format aligned
SELECT test, pass, observed FROM public.c3_results ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs FROM public.c3_results;
