-- Socle COMPLÉMENTAIRE des tests de 20261105110000_delivery_cash_events_proofs.sql.
-- Base JETABLE uniquement. À exécuter après delivery_flow_guards.sql et AVANT les migrations (il ajoute les tables que
-- la prod possède déjà : profiles, delivery_driver_sessions, delivery_payments, schéma storage simplifié).
-- Ordre complet :
--   docker run -d --rm --name ecomfy-delivery-test -e POSTGRES_PASSWORD=test postgres:16-alpine
--   (cat supabase/tests/delivery_flow_guards.sql supabase/tests/delivery_cash_events_proofs.sql \
--        supabase/migrations/20261105100000_delivery_flow_guards.sql supabase/migrations/20261105110000_delivery_cash_events_proofs.sql \
--        supabase/tests/delivery_flow_guards_cases.sql supabase/tests/delivery_cash_events_proofs_cases.sql) \
--     | docker exec -i ecomfy-delivery-test psql -U postgres -v ON_ERROR_STOP=1
\set ON_ERROR_STOP on

ALTER TABLE public.delivery_company_members ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text, phone text);

-- Caissier (PR1) et admin (PR1) en plus des membres du premier socle
INSERT INTO public.delivery_company_members (id, provider_id, user_id, role, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'cashier', true),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'admin', true);
INSERT INTO public.profiles VALUES
  ('33333333-0000-0000-0000-00000000000d', 'Livreur Un', '+2250100000001'),
  ('33333333-0000-0000-0000-00000000000f', 'Livreur Deux', '+2250100000002'),
  ('55555555-0000-0000-0000-000000000001', 'Dispatcher', '+2250100000003'),
  ('88888888-0000-0000-0000-000000000001', 'Caissier', '+2250100000004');

CREATE TABLE public.delivery_driver_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), driver_id uuid);

-- Stockage Supabase simplifié (RLS sur storage.objects, foldername)
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL, name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;
GRANT SELECT, INSERT ON storage.objects TO authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated, anon;
CREATE TABLE public.delivery_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES public.order_deliveries(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.delivery_driver_sessions(id) ON DELETE SET NULL,
  amount_collected numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'collected_by_driver' CHECK (status IN ('collected_by_driver', 'remitted_to_company', 'remitted_to_shop')),
  collected_at timestamptz NOT NULL DEFAULT now(),
  remitted_to_company_at timestamptz,
  remitted_to_shop_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_payments, public.delivery_driver_sessions, public.profiles TO authenticated;
ALTER TABLE public.delivery_payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER delivery_payments_set_updated_at BEFORE UPDATE ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Politiques d'AVANT (prod : 20260811064646)
CREATE POLICY "Provider admins can view and manage payments" ON public.delivery_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_deliveries od JOIN public.delivery_company_members a ON a.provider_id = od.provider_id
                  WHERE od.id = delivery_payments.delivery_id AND a.user_id = auth.uid() AND a.role IN ('admin', 'cashier')));
CREATE POLICY "Drivers can view payments for their sessions" ON public.delivery_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_driver_sessions dds JOIN public.delivery_company_members m ON m.id = dds.driver_id
                  WHERE dds.id = delivery_payments.session_id AND m.user_id = auth.uid()));
