-- Socle du test de 20261116110000_stock_driver_scan.sql. Base JETABLE uniquement (jamais dev ni prod).
--   docker run -d --rm --name ecomfy-stockscan -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/stock_driver_scan.sql supabase/migrations/20261116110000_stock_driver_scan.sql \
--        supabase/tests/stock_driver_scan_cases.sql) | docker exec -i ecomfy-stockscan psql -U postgres -v ON_ERROR_STOP=1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.shops (id uuid PRIMARY KEY, user_id uuid NOT NULL, stock_qr_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id),
  name text, sku text, stock_quantity integer, stock_qr_code text, updated_at timestamptz);
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id));
CREATE TABLE public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
  product_id uuid NOT NULL REFERENCES public.products(id), quantity integer NOT NULL DEFAULT 1);
CREATE TABLE public.delivery_company_members (id uuid PRIMARY KEY, user_id uuid, role text NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.order_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  driver_id uuid REFERENCES public.delivery_company_members(id), status text NOT NULL DEFAULT 'pending');
CREATE TABLE public.stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, product_id uuid NOT NULL,
  variant_id uuid, unit_code text, movement_type text NOT NULL, quantity integer NOT NULL, previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0, source_location text, destination_location text, reference_order_id uuid, driver_id uuid,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), notes text);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
