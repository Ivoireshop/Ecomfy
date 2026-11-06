-- Test de 20261106120000_shop_assets_restrict_uploads.sql (durcissement du bucket public `shop-assets`).
--
-- Base JETABLE uniquement (jamais dev ni prod) :
--   docker run -d --rm --name ecomfy-shop-assets-test -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/shop_assets_policies.sql \
--        supabase/migrations/20261106120000_shop_assets_restrict_uploads.sql \
--        supabase/tests/shop_assets_policies_cases.sql) \
--     | docker exec -i ecomfy-shop-assets-test psql -U postgres -v ON_ERROR_STOP=1
-- Le socle reproduit à l'identique les politiques ouvertes laissées par 20260907140000 et 20260908170000
-- (y compris une politique de nom inconnu) : le test prouve qu'elles sont toutes retirées.

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL, name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;

-- État laissé par les migrations d'origine
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-assets', 'shop-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-kyc', 'delivery-kyc', false);
CREATE POLICY "Public Access for shop-assets" ON storage.objects FOR SELECT USING (bucket_id = 'shop-assets');
CREATE POLICY "Public upload access for shop-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-assets');
CREATE POLICY "Public Upload for shop-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-assets');
CREATE POLICY "Public Update for shop-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-assets');
-- politique de nom inconnu, qui doit disparaître elle aussi
CREATE POLICY "someone_added_this" ON storage.objects FOR ALL USING (bucket_id = 'shop-assets') WITH CHECK (bucket_id = 'shop-assets');
-- politique d'un AUTRE bucket : doit rester intacte
CREATE POLICY "delivery_kyc_select_stub" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'delivery-kyc');

-- Fichiers existants
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('shop-assets', 'avatars/00000000-0000-0000-0000-00000000000b/avatar-1.jpg'),
  ('shop-assets', 'parcel-photos/parcel_1.jpg');
