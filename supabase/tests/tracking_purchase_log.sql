-- Socle des tests de 20261105120000_tracking_purchase_log.sql (registre des Purchase publicitaires).
-- Base JETABLE uniquement (jamais dev ni prod) : tables minimales, puis migration, puis cas.
--   docker run -d --rm --name ecomfy-purchase-test -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/tracking_purchase_log.sql supabase/migrations/20261105120000_tracking_purchase_log.sql \n--        supabase/tests/tracking_purchase_log_cases.sql) | docker exec -i ecomfy-purchase-test psql -U postgres -v ON_ERROR_STOP=1
-- Attendu : « 25 | 25 | 0 ».

\set ON_ERROR_STOP on
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL, slug text);
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  order_number text, payment_status text NOT NULL DEFAULT 'pending', order_status text NOT NULL DEFAULT 'new');
CREATE TABLE public.ecomfy_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), internal_reference text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id), shop_id uuid REFERENCES public.shops(id), amount numeric, currency text DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'PENDING', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.shops, public.orders, public.ecomfy_payments TO anon, authenticated, service_role;
