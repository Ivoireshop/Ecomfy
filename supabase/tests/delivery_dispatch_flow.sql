-- Socle des tests de 20261118110000_delivery_dispatch_flow.sql (transmission, acceptation, affectation, gardes, historique).
-- Base JETABLE uniquement. Chaîne : ce socle, puis 20260906010000, 20260907140000, 20261016120000, 20261106110000,
-- 20261109110000, 20261118100000, 20261118110000, 20261118120000, puis delivery_dispatch_flow_cases.sql (voir scripts de lancement dans le guide).

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'founder', 'co_founder', 'delivery', 'shareholder');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL, shop_payment_status text NOT NULL DEFAULT 'active');
CREATE TABLE public.shop_collaborators (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  order_number text NOT NULL UNIQUE, customer_name text NOT NULL, customer_phone text NOT NULL,
  customer_address text, customer_city text, total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash_on_delivery', payment_status text NOT NULL DEFAULT 'pending');
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads shop" ON public.shops FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop owner reads orders" ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()));
ALTER TABLE public.shop_collaborators ENABLE ROW LEVEL SECURITY;

-- Stockage Supabase simplifié
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL, name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;
GRANT SELECT, INSERT ON storage.objects TO authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated, anon;

GRANT SELECT ON public.user_roles, public.shops, public.orders, public.shop_collaborators TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE FUNCTION public.is_shop_owner_or_collaborator(target_shop_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = target_shop_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.shop_collaborators sc WHERE sc.shop_id = target_shop_id AND sc.user_id = auth.uid() AND sc.status = 'active')
      OR public.has_role(auth.uid(), 'admin') $$;
