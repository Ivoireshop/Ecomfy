-- Socle des tests de 20261106110000_delivery_kyc_audit_notifications.sql (KYC/KYB, permis, audit, notifications).
--
-- Base JETABLE uniquement (jamais dev ni prod). Ordre complet, sur une base vierge :
--   docker run -d --rm --name ecomfy-kyc-test -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/delivery_kyc.sql \
--        supabase/migrations/20260906010000_ecomfy_delivery_module.sql \
--        supabase/migrations/20260907140000_fix_delivery_rls_and_submission.sql \
--        supabase/migrations/20261016120000_h5_delivery_verification_guard.sql \
--        supabase/migrations/20261106110000_delivery_kyc_audit_notifications.sql \
--        supabase/tests/delivery_kyc_cases.sql) \
--     | docker exec -i ecomfy-kyc-test psql -U postgres -v ON_ERROR_STOP=1
-- Les trois migrations du module sont jouées TELLES QUELLES : le test prouve aussi que la chaîne s'applique.

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
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

CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid REFERENCES public.shops(id));
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads shop" ON public.shops FOR SELECT USING (user_id = auth.uid());

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

GRANT SELECT ON public.user_roles, public.shops, public.orders TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
