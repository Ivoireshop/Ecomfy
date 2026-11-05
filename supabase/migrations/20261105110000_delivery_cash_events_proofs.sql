-- Logistique, suite : argent encaissé, notifications, dispatchers non propriétaires, preuves de livraison.
-- Prérequis : 20261105100000_delivery_flow_guards.sql.
--
-- 1. Argent à la livraison. `delivery_payments` existait mais rien ne l'alimentait : livrer ne créait aucun encaissement.
--    Maintenant : une livraison passée `delivered` sur une commande NON payée crée une ligne `collected_by_driver`
--    (montant = total de la commande, espèces). Le prestataire (propriétaire, admin, caissier) la fait avancer :
--    collected_by_driver -> remitted_to_company -> remitted_to_shop, dans cet ordre, horodatage posé par le serveur,
--    montant et livraison immuables. Plus d'INSERT/DELETE direct. La boutique et le livreur lisent leurs lignes.
--    `orders.payment_status` n'est PAS modifié (il sert à la facturation et aux statistiques).
-- 2. Journal et notifications : `delivery_events` (une ligne par changement de statut, d'affectation ou d'argent),
--    lisible par la boutique, le prestataire et le livreur concernés, publié en temps réel pour les notifications de l'app.
-- 3. Dispatchers non propriétaires : get_my_delivery_provider / get_provider_deliveries / get_provider_drivers /
--    get_provider_payments (SECURITY DEFINER) donnent au propriétaire, à l'admin, au dispatcher et au caissier ce que la
--    RLS de `orders` et de `profiles` leur cachait (client, nom et téléphone du livreur).
-- 4. Preuves de livraison : bucket privé « delivery-proofs », chemin <id de livraison>/<fichier>, dépôt par le livreur
--    assigné tant que la livraison n'est pas terminée, lecture par lui, la boutique et le prestataire.
--
-- Rejouable. Tests : supabase/tests/delivery_cash_events_proofs.sql + _cases.sql (base jetable).

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Rôle de l'appelant chez un prestataire
-- ---------------------------------------------------------------------------------------------------------------

-- 'owner', ou le rôle du membre actif ('admin', 'dispatcher', 'cashier', 'driver'), ou NULL.
CREATE OR REPLACE FUNCTION public.delivery_provider_role(_provider_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = _provider_id AND dp.user_id = auth.uid()) THEN 'owner'
    ELSE (SELECT m.role FROM public.delivery_company_members m
           WHERE m.provider_id = _provider_id AND m.user_id = auth.uid() AND m.is_active
           ORDER BY (m.role = 'admin') DESC, (m.role = 'dispatcher') DESC LIMIT 1)
  END;
$$;

REVOKE ALL ON FUNCTION public.delivery_provider_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_provider_role(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Argent encaissé
-- ---------------------------------------------------------------------------------------------------------------

REVOKE INSERT, DELETE ON public.delivery_payments FROM authenticated, anon;

DROP POLICY IF EXISTS "Provider admins can view and manage payments" ON public.delivery_payments;
DROP POLICY IF EXISTS "Provider staff can view payments" ON public.delivery_payments;
DROP POLICY IF EXISTS "Provider cashiers can update payments" ON public.delivery_payments;
DROP POLICY IF EXISTS "Drivers can view payments for their sessions" ON public.delivery_payments;
DROP POLICY IF EXISTS "Drivers can view payments of their deliveries" ON public.delivery_payments;
DROP POLICY IF EXISTS "Shop owners can view payments of their orders" ON public.delivery_payments;

CREATE POLICY "Provider staff can view payments"
  ON public.delivery_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_deliveries od
     WHERE od.id = delivery_payments.delivery_id
       AND public.delivery_provider_role(od.provider_id) IN ('owner', 'admin', 'cashier')
  ));

CREATE POLICY "Provider cashiers can update payments"
  ON public.delivery_payments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_deliveries od
     WHERE od.id = delivery_payments.delivery_id
       AND public.delivery_provider_role(od.provider_id) IN ('owner', 'admin', 'cashier')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.order_deliveries od
     WHERE od.id = delivery_payments.delivery_id
       AND public.delivery_provider_role(od.provider_id) IN ('owner', 'admin', 'cashier')
  ));

CREATE POLICY "Drivers can view payments of their deliveries"
  ON public.delivery_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_deliveries od
      JOIN public.delivery_company_members m ON m.id = od.driver_id
     WHERE od.id = delivery_payments.delivery_id AND m.user_id = auth.uid() AND m.role = 'driver'
  ));

CREATE POLICY "Shop owners can view payments of their orders"
  ON public.delivery_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_deliveries od
      JOIN public.orders o ON o.id = od.order_id
      JOIN public.shops s ON s.id = o.shop_id
     WHERE od.id = delivery_payments.delivery_id AND s.user_id = auth.uid()
  ));

-- Garde : montant et livraison immuables, étapes dans l'ordre, horodatages posés par le serveur.
-- SECURITY INVOKER : les appels internes (fonctions SECURITY DEFINER, service_role) ne sont pas bridés.
CREATE OR REPLACE FUNCTION public.guard_delivery_payment_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enforce boolean := auth.uid() IS NOT NULL AND current_user IN ('authenticated', 'anon');
BEGIN
  IF v_enforce THEN
    IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
       OR NEW.amount_collected IS DISTINCT FROM OLD.amount_collected
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.collected_at IS DISTINCT FROM OLD.collected_at THEN
      RAISE EXCEPTION 'Le montant encaissé et la livraison ne peuvent pas être modifiés.' USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'collected_by_driver'  AND NEW.status = 'remitted_to_company')
      OR (OLD.status = 'remitted_to_company' AND NEW.status = 'remitted_to_shop')
    ) THEN
      RAISE EXCEPTION 'Étape d''argent interdite : % vers %.', OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'remitted_to_company' THEN
      NEW.remitted_to_company_at := now();
    ELSIF NEW.status = 'remitted_to_shop' THEN
      NEW.remitted_to_company_at := coalesce(OLD.remitted_to_company_at, now());
      NEW.remitted_to_shop_at := now();
    END IF;
  ELSIF v_enforce THEN
    NEW.remitted_to_company_at := OLD.remitted_to_company_at;
    NEW.remitted_to_shop_at := OLD.remitted_to_shop_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_payments_guard ON public.delivery_payments;
CREATE TRIGGER delivery_payments_guard
  BEFORE UPDATE ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_payment_update();

-- Livraison terminée sur une commande non payée : l'argent est chez le livreur.
CREATE OR REPLACE FUNCTION public.record_delivery_cash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    SELECT total AS total_amount, payment_status INTO v_order FROM public.orders WHERE id = NEW.order_id;
    IF lower(coalesce(v_order.payment_status, '')) <> 'paid' AND coalesce(v_order.total_amount, 0) > 0 THEN
      INSERT INTO public.delivery_payments (delivery_id, amount_collected, payment_method, status)
      VALUES (NEW.id, v_order.total_amount, 'cash', 'collected_by_driver')
      ON CONFLICT (delivery_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_deliveries_record_cash ON public.order_deliveries;
CREATE TRIGGER order_deliveries_record_cash
  AFTER UPDATE OF status ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.record_delivery_cash();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Journal des événements de livraison (et source des notifications)
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.order_deliveries(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  shop_id uuid,
  provider_id uuid NOT NULL,
  driver_user_id uuid,
  kind text NOT NULL CHECK (kind IN ('created', 'assigned', 'status', 'cash')),
  status text,
  detail text,
  order_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON public.delivery_events(delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_shop ON public.delivery_events(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_provider ON public.delivery_events(provider_id, created_at DESC);

ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_events TO authenticated;

DROP POLICY IF EXISTS "Delivery events visible to concerned parties" ON public.delivery_events;
CREATE POLICY "Delivery events visible to concerned parties"
  ON public.delivery_events FOR SELECT TO authenticated
  USING (
    driver_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = delivery_events.shop_id AND s.user_id = auth.uid())
    OR public.delivery_provider_role(delivery_events.provider_id) IN ('owner', 'admin', 'dispatcher', 'cashier')
  );

CREATE OR REPLACE FUNCTION public.log_delivery_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop uuid;
  v_number text;
  v_driver_user uuid;
BEGIN
  SELECT o.shop_id, o.order_number INTO v_shop, v_number FROM public.orders o WHERE o.id = NEW.order_id;
  SELECT m.user_id INTO v_driver_user FROM public.delivery_company_members m WHERE m.id = NEW.driver_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_events (delivery_id, order_id, shop_id, provider_id, driver_user_id, kind, status, order_number)
    VALUES (NEW.id, NEW.order_id, v_shop, NEW.provider_id, v_driver_user,
            CASE WHEN NEW.driver_id IS NULL THEN 'created' ELSE 'assigned' END, NEW.status, v_number);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_events (delivery_id, order_id, shop_id, provider_id, driver_user_id, kind, status, detail, order_number)
    VALUES (NEW.id, NEW.order_id, v_shop, NEW.provider_id, v_driver_user, 'status', NEW.status,
            CASE WHEN NEW.status = 'failed' THEN NEW.failure_reason END, v_number);
  END IF;
  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id AND NEW.driver_id IS NOT NULL THEN
    INSERT INTO public.delivery_events (delivery_id, order_id, shop_id, provider_id, driver_user_id, kind, status, order_number)
    VALUES (NEW.id, NEW.order_id, v_shop, NEW.provider_id, v_driver_user, 'assigned', NEW.status, v_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_deliveries_log_insert ON public.order_deliveries;
CREATE TRIGGER order_deliveries_log_insert
  AFTER INSERT ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.log_delivery_event();

DROP TRIGGER IF EXISTS order_deliveries_log_update ON public.order_deliveries;
CREATE TRIGGER order_deliveries_log_update
  AFTER UPDATE OF status, driver_id ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.log_delivery_event();

-- Événements d'argent : encaissement, remise au prestataire, reversement à la boutique.
CREATE OR REPLACE FUNCTION public.log_delivery_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_od record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT od.id, od.order_id, od.provider_id, o.shop_id, o.order_number,
         (SELECT m.user_id FROM public.delivery_company_members m WHERE m.id = od.driver_id) AS driver_user
    INTO v_od
    FROM public.order_deliveries od JOIN public.orders o ON o.id = od.order_id
   WHERE od.id = NEW.delivery_id;
  IF v_od.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.delivery_events (delivery_id, order_id, shop_id, provider_id, driver_user_id, kind, status, detail, order_number)
  VALUES (v_od.id, v_od.order_id, v_od.shop_id, v_od.provider_id, v_od.driver_user, 'cash', NEW.status,
          NEW.amount_collected::text, v_od.order_number);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_payments_log ON public.delivery_payments;
CREATE TRIGGER delivery_payments_log
  AFTER INSERT OR UPDATE OF status ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_delivery_payment_event();

-- Temps réel (notifications de l'app). Sans effet sur une base qui n'a pas la publication (tests).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_events;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Accès du personnel du prestataire (propriétaire, admin, dispatcher, caissier)
-- ---------------------------------------------------------------------------------------------------------------

-- Le prestataire de l'appelant : propriétaire d'abord, sinon membre actif admin / dispatcher / caissier.
CREATE OR REPLACE FUNCTION public.get_my_delivery_provider()
RETURNS TABLE (provider_id uuid, company_name text, member_role text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.provider_id, x.company_name, x.member_role, x.is_active FROM (
    SELECT dp.id AS provider_id, dp.company_name, 'owner'::text AS member_role, dp.is_active, 0 AS rank
      FROM public.delivery_providers dp WHERE dp.user_id = auth.uid()
    UNION ALL
    SELECT dp.id, dp.company_name, m.role, dp.is_active, 1
      FROM public.delivery_company_members m JOIN public.delivery_providers dp ON dp.id = m.provider_id
     WHERE m.user_id = auth.uid() AND m.is_active AND m.role IN ('admin', 'dispatcher', 'cashier')
  ) x
  WHERE auth.uid() IS NOT NULL
  ORDER BY x.rank, x.company_name
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_my_delivery_provider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_delivery_provider() TO authenticated, service_role;

-- Livraisons du prestataire avec les champs de la commande utiles au dispatch.
CREATE OR REPLACE FUNCTION public.get_provider_deliveries(_provider_id uuid)
RETURNS TABLE (
  delivery_id uuid, order_id uuid, order_number text, status text, driver_id uuid, failure_reason text,
  customer_name text, customer_city text, total_amount numeric, payment_status text,
  cash_status text, picked_up_at timestamptz, delivered_at timestamptz, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT od.id, od.order_id, o.order_number, od.status, od.driver_id, od.failure_reason,
         o.customer_name, o.customer_city, o.total, o.payment_status,
         dpay.status, od.picked_up_at, od.delivered_at, od.created_at
    FROM public.order_deliveries od
    JOIN public.orders o ON o.id = od.order_id
    LEFT JOIN public.delivery_payments dpay ON dpay.delivery_id = od.id
   WHERE od.provider_id = _provider_id
     AND public.delivery_provider_role(_provider_id) IN ('owner', 'admin', 'dispatcher', 'cashier')
   ORDER BY od.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_provider_deliveries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_deliveries(uuid) TO authenticated, service_role;

-- Équipe de livreurs avec nom et téléphone (le profil n'est pas lisible directement).
CREATE OR REPLACE FUNCTION public.get_provider_drivers(_provider_id uuid)
RETURNS TABLE (member_id uuid, full_name text, phone text, role text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, p.full_name, p.phone, m.role, m.is_active
    FROM public.delivery_company_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.provider_id = _provider_id
     AND public.delivery_provider_role(_provider_id) IN ('owner', 'admin', 'dispatcher', 'cashier')
   ORDER BY m.created_at
$$;

REVOKE ALL ON FUNCTION public.get_provider_drivers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_drivers(uuid) TO authenticated, service_role;

-- Caisse du prestataire : argent encaissé par ses livreurs et état de sa remise.
CREATE OR REPLACE FUNCTION public.get_provider_payments(_provider_id uuid)
RETURNS TABLE (
  payment_id uuid, delivery_id uuid, order_number text, customer_name text, driver_name text,
  amount_collected numeric, status text, collected_at timestamptz,
  remitted_to_company_at timestamptz, remitted_to_shop_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dpay.id, od.id, o.order_number, o.customer_name, p.full_name,
         dpay.amount_collected, dpay.status, dpay.collected_at, dpay.remitted_to_company_at, dpay.remitted_to_shop_at
    FROM public.delivery_payments dpay
    JOIN public.order_deliveries od ON od.id = dpay.delivery_id
    JOIN public.orders o ON o.id = od.order_id
    LEFT JOIN public.delivery_company_members m ON m.id = od.driver_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE od.provider_id = _provider_id
     AND public.delivery_provider_role(_provider_id) IN ('owner', 'admin', 'cashier')
   ORDER BY dpay.collected_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_provider_payments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_payments(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Preuves de livraison (stockage privé)
-- ---------------------------------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-proofs', 'delivery-proofs', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Le dossier (premier segment du chemin) est l'identifiant de la livraison.
--   écriture : le livreur actif assigné, tant que la livraison n'est ni livrée, ni échouée, ni retournée ;
--   lecture  : ce livreur, le propriétaire de la boutique de la commande, le personnel du prestataire.
CREATE OR REPLACE FUNCTION public.delivery_proof_access(_folder text, _write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_od record;
BEGIN
  IF auth.uid() IS NULL OR _folder IS NULL
     OR _folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  SELECT od.provider_id, od.driver_id, od.status, o.shop_id INTO v_od
    FROM public.order_deliveries od JOIN public.orders o ON o.id = od.order_id
   WHERE od.id = _folder::uuid;
  IF NOT FOUND THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.delivery_company_members m
              WHERE m.id = v_od.driver_id AND m.user_id = auth.uid() AND m.is_active AND m.role = 'driver') THEN
    RETURN NOT _write OR v_od.status IN ('pending', 'assigned', 'picked_up', 'in_transit');
  END IF;

  IF _write THEN RETURN false; END IF;

  RETURN EXISTS (SELECT 1 FROM public.shops s WHERE s.id = v_od.shop_id AND s.user_id = auth.uid())
      OR public.delivery_provider_role(v_od.provider_id) IN ('owner', 'admin', 'dispatcher', 'cashier');
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_proof_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_proof_access(text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS "delivery_proofs_driver_insert" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_select" ON storage.objects;

CREATE POLICY "delivery_proofs_driver_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs' AND public.delivery_proof_access((storage.foldername(name))[1], true));

CREATE POLICY "delivery_proofs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-proofs' AND public.delivery_proof_access((storage.foldername(name))[1], false));
