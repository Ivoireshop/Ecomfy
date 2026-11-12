-- Socle minimal pour tester supabase/migrations/20261112120000_digital_products.sql sur une BASE JETABLE (PostgreSQL 15,
-- jamais la dev ni la prod). Il recrée seulement ce que la migration touche : rôles Supabase, auth.uid(), storage.*,
-- shops / shop_collaborators / products / orders / order_items et has_shop_permission (copie de 20261111100000).
-- Commande :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/digital_products.sql \
--        -f supabase/migrations/20261112120000_digital_products.sql \
--        -f supabase/migrations/20261112120000_digital_products.sql \
--        -f supabase/tests/digital_products_cases.sql
-- (la migration est passée deux fois : elle doit être idempotente).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid $$;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1:array_length(_parts, 1) - 1];
END $$;

CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, business_name text, slug text
);
CREATE TABLE IF NOT EXISTS public.shop_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active', roles text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL, price numeric NOT NULL DEFAULT 0, is_digital boolean DEFAULT false, digital_file_url text,
  is_published boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_number text NOT NULL DEFAULT gen_random_uuid()::text, payment_method text NOT NULL DEFAULT 'mobile_money',
  payment_status text NOT NULL DEFAULT 'pending', customer_email text
);
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id), product_name text NOT NULL DEFAULT 'x', quantity int NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION public.has_shop_permission(_shop_id uuid, _permissions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shop_collaborators sc
    WHERE sc.shop_id = _shop_id AND sc.user_id = auth.uid() AND sc.status = 'active'
      AND (sc.roles::text[] && _permissions OR 'full_admin' = ANY (sc.roles::text[]))
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_shop_permission(uuid, text[]) TO PUBLIC;

-- Droits par défaut de Supabase : tout est ouvert aux rôles API, c'est le RLS (et les REVOKE de la migration) qui protège.
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
