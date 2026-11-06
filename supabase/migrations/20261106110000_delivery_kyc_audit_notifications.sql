-- Ecomfy Livraison : KYC / KYB réels, permis A/B contrôlé par la base, journal d'audit, notifications (06/11/2026).
--
-- Contexte : le module « sociétés de livraison » (delivery_companies, delivery_drivers…) n'est dans aucune base (prod
-- comprise). Son front simulait la vérification (OCR et comparaison faciale factices, catégories de permis toujours
-- « A et B »), n'enregistrait jamais les pièces (URL blob: / data:), tenait le journal d'audit dans localStorage, et
-- laissait la table des livreurs (pièces d'identité) lisible et modifiable par tout utilisateur connecté.
--
-- À appliquer APRÈS 20260906010000 (corrigé), 20260907140000 et 20261016120000. Rejouable.
--
--  1. Aides : administrateur de la plateforme, propriétaire d'une structure, chemins de documents.
--  2. KYC / KYB : identité du responsable (table à part, jamais lisible par les autres), pièces dans un bucket PRIVÉ,
--     registre des notes internes réservé aux administrateurs, un seul dossier par compte, doublon d'identité refusé.
--  3. Permis : catégories, numéro et expiration enregistrés par livreur ; règle permis ↔ véhicule appliquée par la base ;
--     un livreur n'est actif que s'il est approuvé ET que son permis est valable (invariant, même pour un administrateur).
--  4. Journal d'audit en ajout seul (écrit par des déclencheurs, jamais par le navigateur) et notifications temps réel.
--  5. Décisions des administrateurs par RPC (atomiques, journalisées, notifiantes) ; inscription et resoumission par RPC.
--  6. Expiration des pièces : suspension automatique et rappels (pg_cron si disponible).
--  7. Politiques RLS resserrées (structures, hubs, livreurs, transferts d'argent) et garde d'affectation des courses.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Aides
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delivery_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'founder'::app_role)
    OR public.has_role(auth.uid(), 'co_founder'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.delivery_company_owner(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = _company_id AND c.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.delivery_actor_kind()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN 'system'
              WHEN public.delivery_is_platform_admin() THEN 'admin'
              ELSE 'owner' END;
$$;

REVOKE ALL ON FUNCTION public.delivery_is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_company_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_actor_kind() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_company_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_actor_kind() TO authenticated, service_role;

-- Une pièce doit être un fichier déposé par l'appelant dans le bucket privé (<son id>/<fichier>), jamais une URL.
CREATE OR REPLACE FUNCTION public.delivery_assert_doc_path(_path text, _label text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF _path IS NULL OR _path = '' THEN RETURN; END IF;
  IF auth.uid() IS NULL
     OR left(_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/'
     OR position('..' IN _path) > 0 THEN
    RAISE EXCEPTION 'Document invalide (%) : importez le fichier depuis l''application.', _label
      USING ERRCODE = '22023';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. KYC / KYB
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE public.delivery_companies
  ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'manager',
  ADD COLUMN IF NOT EXISTS manager_first_name text,
  ADD COLUMN IF NOT EXISTS manager_last_name text,
  ADD COLUMN IF NOT EXISTS manager_selfie_with_id_url text,
  ADD COLUMN IF NOT EXISTS trade_register_document_url text,
  ADD COLUMN IF NOT EXISTS rejection_reason_code text,
  ADD COLUMN IF NOT EXISTS reviewer_comments text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_companies_profile_type_check') THEN
    ALTER TABLE public.delivery_companies
      ADD CONSTRAINT delivery_companies_profile_type_check CHECK (profile_type IN ('manager', 'driver'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_companies_reason_code_check') THEN
    ALTER TABLE public.delivery_companies
      ADD CONSTRAINT delivery_companies_reason_code_check CHECK (rejection_reason_code IS NULL OR rejection_reason_code IN (
        'EXPIRED_ID', 'EXPIRED_LICENSE', 'NAME_MISMATCH', 'DOB_MISMATCH', 'NON_ID_DOCUMENT', 'LICENSE_CATEGORY_MISMATCH',
        'LIVENESS_FAILED', 'DOCUMENT_UNREADABLE', 'DUPLICATE_IDENTITY', 'SUSPICIOUS_MANIPULATION', 'OTHER'));
  END IF;
END $$;

-- Un compte = un dossier (getMyCompany lit une seule ligne).
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_companies_user ON public.delivery_companies(user_id) WHERE user_id IS NOT NULL;

-- Identité du responsable (KYC). Table à part : delivery_companies est lisible par tout utilisateur connecté quand la
-- structure est approuvée (annuaire des vendeurs), pas ces données.
CREATE TABLE IF NOT EXISTS public.delivery_company_kyc (
  company_id uuid PRIMARY KEY REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  id_type text NOT NULL CHECK (id_type IN ('cni', 'passport')),
  id_number text NOT NULL CHECK (length(btrim(id_number)) >= 4),
  id_number_norm text GENERATED ALWAYS AS (upper(regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g'))) STORED,
  id_expiry date,
  date_of_birth date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_company_kyc_idnum ON public.delivery_company_kyc(id_type, id_number_norm);

-- Notes internes des administrateurs (jamais lisibles par le candidat ni par l'annuaire).
CREATE TABLE IF NOT EXISTS public.delivery_company_review_notes (
  company_id uuid PRIMARY KEY REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  internal_note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Livreurs et permis
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS vehicle_license_plate text,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS id_expiry date,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license_expiry date,
  ADD COLUMN IF NOT EXISTS selfie_with_id_url text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejection_reason_code text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

ALTER TABLE public.delivery_drivers ALTER COLUMN is_active SET DEFAULT false;
ALTER TABLE public.delivery_drivers ALTER COLUMN vehicle_type SET DEFAULT 'motorcycle';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_drivers_status_check') THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_status_check CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_drivers_categories_check') THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_categories_check CHECK (license_categories <@ ARRAY['A', 'B', 'C', 'D', 'E']::text[]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_drivers_vehicle_check') THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_vehicle_check CHECK (vehicle_type IN ('motorcycle', 'tricycle', 'car', 'van', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_drivers_reason_code_check') THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_reason_code_check CHECK (rejection_reason_code IS NULL OR rejection_reason_code IN (
        'EXPIRED_ID', 'EXPIRED_LICENSE', 'NAME_MISMATCH', 'DOB_MISMATCH', 'NON_ID_DOCUMENT', 'LICENSE_CATEGORY_MISMATCH',
        'LIVENESS_FAILED', 'DOCUMENT_UNREADABLE', 'DUPLICATE_IDENTITY', 'SUSPICIOUS_MANIPULATION', 'OTHER'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_drivers_license
  ON public.delivery_drivers(company_id, upper(license_number)) WHERE license_number IS NOT NULL;

-- Catégories de permis acceptées pour un véhicule (même règle que src/lib/vehicleLicenseMatcher.ts).
CREATE OR REPLACE FUNCTION public.delivery_required_license_categories(_vehicle text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _vehicle
    WHEN 'motorcycle' THEN ARRAY['A']
    WHEN 'tricycle'   THEN ARRAY['A']
    WHEN 'car'        THEN ARRAY['B']
    WHEN 'van'        THEN ARRAY['B', 'C']
    ELSE ARRAY['A', 'B']
  END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_vehicle_label(_vehicle text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _vehicle
    WHEN 'motorcycle' THEN 'Moto / Scooter'
    WHEN 'tricycle'   THEN 'Tricycle motorisé'
    WHEN 'car'        THEN 'Voiture / Véhicule léger'
    WHEN 'van'        THEN 'Camionnette / Van'
    ELSE 'Autre véhicule'
  END;
$$;

-- Anomalies bloquantes d'un livreur : liste vide = permis conforme et valable.
CREATE OR REPLACE FUNCTION public.delivery_driver_issues(
  _vehicle text, _categories text[], _license_expiry date, _id_expiry date
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_issues text[] := '{}';
  v_required text[] := public.delivery_required_license_categories(_vehicle);
BEGIN
  IF _categories IS NULL OR cardinality(_categories) = 0 THEN
    v_issues := array_append(v_issues, 'Aucune catégorie de permis déclarée.');
  ELSIF NOT (_categories && v_required) THEN
    v_issues := array_append(v_issues, format(
      'Permis non conforme : catégorie %s requise pour %s (déclaré : %s).',
      array_to_string(v_required, ' ou '), public.delivery_vehicle_label(_vehicle), array_to_string(_categories, ', ')));
  END IF;

  IF _license_expiry IS NULL THEN
    v_issues := array_append(v_issues, 'Date d''expiration du permis non renseignée.');
  ELSIF _license_expiry < current_date THEN
    v_issues := array_append(v_issues, format(
      'Permis expiré le %s.', to_char(_license_expiry, 'DD/MM/YYYY')));
  END IF;

  IF _id_expiry IS NOT NULL AND _id_expiry < current_date THEN
    v_issues := array_append(v_issues, format(
      'Pièce d''identité expirée le %s.', to_char(_id_expiry, 'DD/MM/YYYY')));
  END IF;
  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_driver_issues(text, text[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_driver_issues(text, text[], date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_required_license_categories(text) TO authenticated, service_role;

-- Conditions d'approbation d'un livreur : permis conforme et valable + pièces et numéro de permis présents.
CREATE OR REPLACE FUNCTION public.delivery_driver_approval_issues(_d public.delivery_drivers)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text[] := public.delivery_driver_issues(_d.vehicle_type, _d.license_categories, _d.license_expiry, _d.id_expiry);
BEGIN
  IF _d.photo_url IS NULL OR _d.national_id_photo_url IS NULL OR _d.license_photo_url IS NULL THEN
    v := array_append(v, 'Photo, pièce d''identité ou permis de conduire manquant.');
  END IF;
  IF COALESCE(btrim(_d.license_number), '') = '' THEN
    v := array_append(v, 'Numéro de permis manquant.');
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_driver_approval_issues(public.delivery_drivers) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_driver_approval_issues(public.delivery_drivers) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Journal d'audit (ajout seul) et notifications
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,                       -- sans clé étrangère : le journal survit à la suppression du dossier
  driver_id uuid,
  company_name text,
  subject text NOT NULL CHECK (subject IN ('company', 'driver')),
  action text NOT NULL,
  from_status text,
  to_status text,
  reason_code text,
  reason text,                                    -- visible du candidat quand visibility = 'owner'
  note text,                                      -- note interne (visibility = 'internal')
  visibility text NOT NULL DEFAULT 'owner' CHECK (visibility IN ('owner', 'internal')),
  actor_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('owner', 'admin', 'system')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_audit_company ON public.delivery_verification_audit(company_id, created_at DESC);

ALTER TABLE public.delivery_verification_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_verification_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_verification_audit TO authenticated;
GRANT ALL ON public.delivery_verification_audit TO service_role;

DROP POLICY IF EXISTS "Delivery audit read" ON public.delivery_verification_audit;
CREATE POLICY "Delivery audit read" ON public.delivery_verification_audit
  FOR SELECT TO authenticated
  USING (
    public.delivery_is_platform_admin()
    OR (visibility = 'owner' AND public.delivery_company_owner(company_id))
  );

CREATE OR REPLACE FUNCTION public.delivery_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d''audit de vérification est en ajout seul.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_audit_no_change ON public.delivery_verification_audit;
CREATE TRIGGER trg_delivery_audit_no_change
  BEFORE UPDATE OR DELETE ON public.delivery_verification_audit
  FOR EACH ROW EXECUTE FUNCTION public.delivery_audit_immutable();
DROP TRIGGER IF EXISTS trg_delivery_audit_no_truncate ON public.delivery_verification_audit;
CREATE TRIGGER trg_delivery_audit_no_truncate
  BEFORE TRUNCATE ON public.delivery_verification_audit
  FOR EACH STATEMENT EXECUTE FUNCTION public.delivery_audit_immutable();

CREATE OR REPLACE FUNCTION public.delivery_audit_write(
  _company_id uuid, _driver_id uuid, _company_name text, _subject text, _action text,
  _from text, _to text, _reason_code text, _reason text, _note text, _visibility text, _details jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.delivery_verification_audit
    (company_id, driver_id, company_name, subject, action, from_status, to_status, reason_code, reason, note,
     visibility, actor_id, actor_kind, details)
  VALUES
    (_company_id, _driver_id, _company_name, _subject, _action, _from, _to, _reason_code, _reason, _note,
     COALESCE(_visibility, 'owner'), auth.uid(), public.delivery_actor_kind(), COALESCE(_details, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_audit_write(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.delivery_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  driver_id uuid,
  kind text NOT NULL,
  tone text NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'success', 'warning', 'error')),
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_user ON public.delivery_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_unread ON public.delivery_notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.delivery_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.delivery_notifications TO authenticated;
GRANT ALL ON public.delivery_notifications TO service_role;

DROP POLICY IF EXISTS "Delivery notifications read own" ON public.delivery_notifications;
CREATE POLICY "Delivery notifications read own" ON public.delivery_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Delivery notifications mark own read" ON public.delivery_notifications;
CREATE POLICY "Delivery notifications mark own read" ON public.delivery_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.delivery_notify(
  _user uuid, _company uuid, _driver uuid, _kind text, _tone text, _title text, _body text, _link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  INSERT INTO public.delivery_notifications (user_id, company_id, driver_id, kind, tone, title, body, link)
  VALUES (_user, _company, _driver, _kind, COALESCE(_tone, 'info'), _title, _body, _link);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_notify(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_notify_admins(
  _company uuid, _driver uuid, _kind text, _tone text, _title text, _body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin'::app_role, 'founder'::app_role, 'co_founder'::app_role) LOOP
    PERFORM public.delivery_notify(r.user_id, _company, _driver, _kind, _tone, _title, _body, '/delivery-admin');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_notify_admins(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_notifications;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Gardes (structure, identité, livreur)
-- ---------------------------------------------------------------------------------------------------------------

-- Re-vérification imposée par le serveur quand un dossier approuvé change de pièces ou d'identité.
CREATE OR REPLACE FUNCTION public.delivery_reverify_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('ecomfy.delivery_internal', '1', true);
  UPDATE public.delivery_companies
     SET verification_status = 'pending_verification', trust_badge_active = false,
         verified_at = NULL, verified_by = NULL, verification_requested_at = now()
   WHERE id = _company_id AND verification_status = 'approved';
  PERFORM set_config('ecomfy.delivery_internal', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_reverify_company(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_delivery_company_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols constant text[] := ARRAY['company_name', 'manager_name', 'manager_first_name', 'manager_last_name',
    'manager_photo_url', 'manager_id_photo_url', 'manager_selfie_with_id_url', 'owner_photo_url',
    'tax_id_number', 'tax_document_url', 'trade_register_number', 'trade_register_document_url'];
  v_changed text[];
  v_col text;
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('ecomfy.delivery_internal', true) = '1'
     OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  FOREACH v_col IN ARRAY ARRAY['manager_photo_url', 'manager_id_photo_url', 'manager_selfie_with_id_url', 'owner_photo_url',
                               'warehouse_photo_url', 'tax_document_url', 'trade_register_document_url'] LOOP
    IF (to_jsonb(NEW) ->> v_col) IS NOT NULL
       AND (TG_OP = 'INSERT' OR (to_jsonb(NEW) ->> v_col) IS DISTINCT FROM (to_jsonb(OLD) ->> v_col)) THEN
      PERFORM public.delivery_assert_doc_path(to_jsonb(NEW) ->> v_col, v_col);
    END IF;
  END LOOP;

  -- INSERT : toute demande démarre en attente, sans badge ni décision.
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.verification_status := 'pending_verification';
    NEW.trust_badge_active := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.rejection_reason_code := NULL;
    NEW.reviewer_comments := NULL;
    NEW.admin_notes := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.profile_type IS DISTINCT FROM OLD.profile_type THEN
    RAISE EXCEPTION 'Le propriétaire et le type de profil ne sont pas modifiables.' USING ERRCODE = '42501';
  END IF;

  IF NEW.trust_badge_active IS DISTINCT FROM OLD.trust_badge_active
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.rejection_reason_code IS DISTINCT FROM OLD.rejection_reason_code
     OR NEW.reviewer_comments IS DISTINCT FROM OLD.reviewer_comments
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Les champs de vérification sont réservés aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  -- Seule la resoumission est permise, et jamais depuis un dossier approuvé ou suspendu.
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT (NEW.verification_status = 'pending_verification' AND OLD.verification_status NOT IN ('approved', 'suspended')) THEN
    RAISE EXCEPTION 'Le statut de vérification est réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
   WHERE n.key = ANY (v_cols) AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  -- Dossier approuvé dont les pièces ou l'identité changent : badge retiré, nouvelle vérification.
  IF OLD.verification_status = 'approved' AND v_changed IS NOT NULL THEN
    NEW.verification_status := 'pending_verification';
    NEW.trust_badge_active := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;

  IF NEW.verification_status = 'pending_verification' AND OLD.verification_status IS DISTINCT FROM 'pending_verification' THEN
    NEW.verification_requested_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_company_verification() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_company_verification ON public.delivery_companies;
CREATE TRIGGER trg_guard_delivery_company_verification
  BEFORE INSERT OR UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_verification();

-- Identité du responsable : majeur, pas de doublon avec un autre dossier (même refusé : un administrateur tranche), re-vérification si elle change.
CREATE OR REPLACE FUNCTION public.guard_delivery_company_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'Le responsable doit être majeur.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.delivery_company_kyc k
     WHERE k.company_id <> NEW.company_id
       AND k.id_type = NEW.id_type
       AND k.id_number_norm = upper(regexp_replace(NEW.id_number, '[^A-Za-z0-9]', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Cette pièce d''identité est déjà associée à un autre dossier.' USING ERRCODE = '23505';
  END IF;

  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NOT public.delivery_is_platform_admin()
     AND (NEW.id_type, NEW.id_number, NEW.id_expiry, NEW.date_of_birth)
         IS DISTINCT FROM (OLD.id_type, OLD.id_number, OLD.id_expiry, OLD.date_of_birth) THEN
    PERFORM public.delivery_reverify_company(NEW.company_id);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_company_kyc() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_company_kyc ON public.delivery_company_kyc;
CREATE TRIGGER trg_guard_delivery_company_kyc
  BEFORE INSERT OR UPDATE ON public.delivery_company_kyc
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_kyc();

-- Livreur : décision réservée aux administrateurs, pièces dans le bucket privé, invariant « actif = approuvé + permis valable ».
CREATE OR REPLACE FUNCTION public.guard_delivery_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols constant text[] := ARRAY['full_name', 'first_name', 'last_name', 'date_of_birth', 'vehicle_type', 'id_type',
    'id_number', 'id_expiry', 'license_number', 'license_categories', 'license_expiry', 'photo_url',
    'national_id_photo_url', 'license_photo_url', 'selfie_with_id_url'];
  v_changed text[];
  v_issues text[];
  v_col text;
  v_privileged boolean := auth.uid() IS NULL OR public.delivery_is_platform_admin();
BEGIN
  NEW.license_categories := COALESCE((SELECT array_agg(DISTINCT upper(btrim(c)) ORDER BY upper(btrim(c)))
                                        FROM unnest(NEW.license_categories) c), '{}');

  IF NOT v_privileged THEN
    FOREACH v_col IN ARRAY ARRAY['photo_url', 'national_id_photo_url', 'license_photo_url', 'selfie_with_id_url'] LOOP
      IF (to_jsonb(NEW) ->> v_col) IS NOT NULL
         AND (TG_OP = 'INSERT' OR (to_jsonb(NEW) ->> v_col) IS DISTINCT FROM (to_jsonb(OLD) ->> v_col)) THEN
        PERFORM public.delivery_assert_doc_path(to_jsonb(NEW) ->> v_col, v_col);
      END IF;
    END LOOP;

    IF TG_OP = 'INSERT' THEN
      v_issues := public.delivery_driver_issues(NEW.vehicle_type, NEW.license_categories, NEW.license_expiry, NEW.id_expiry);
      IF cardinality(v_issues) > 0 THEN
        RAISE EXCEPTION '%', array_to_string(v_issues, ' ') USING ERRCODE = '23514';
      END IF;
      NEW.verification_status := 'pending';
      NEW.is_active := false;
      NEW.rejection_reason := NULL;
      NEW.rejection_reason_code := NULL;
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    ELSE
      IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'Un livreur ne peut pas changer de structure.' USING ERRCODE = '42501';
      END IF;
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         OR NEW.rejection_reason_code IS DISTINCT FROM OLD.rejection_reason_code
         OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
         OR NEW.verified_by IS DISTINCT FROM OLD.verified_by THEN
        RAISE EXCEPTION 'Les champs de vérification sont réservés aux administrateurs.' USING ERRCODE = '42501';
      END IF;

      SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
        FROM jsonb_each(to_jsonb(NEW)) n
       WHERE n.key = ANY (v_cols) AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

      -- Permis, identité ou véhicule modifiés : le livreur est suspendu de fait jusqu'à nouvelle vérification.
      IF v_changed IS NOT NULL THEN
        IF v_changed && ARRAY['vehicle_type', 'license_categories', 'license_expiry', 'id_expiry'] THEN
          v_issues := public.delivery_driver_issues(NEW.vehicle_type, NEW.license_categories, NEW.license_expiry, NEW.id_expiry);
          IF cardinality(v_issues) > 0 THEN
            RAISE EXCEPTION '%', array_to_string(v_issues, ' ') USING ERRCODE = '23514';
          END IF;
        END IF;
        NEW.verification_status := 'pending';
        NEW.is_active := false;
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
      END IF;
    END IF;
  END IF;

  IF NEW.is_active AND (
       NEW.verification_status <> 'approved'
       OR cardinality(public.delivery_driver_issues(NEW.vehicle_type, NEW.license_categories, NEW.license_expiry, NEW.id_expiry)) > 0
     ) THEN
    RAISE EXCEPTION 'Un livreur ne peut être actif que s''il est approuvé et que son permis est conforme et valable.'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_driver() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_driver ON public.delivery_drivers;
CREATE TRIGGER trg_guard_delivery_driver
  BEFORE INSERT OR UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_driver();

-- Une course ne va qu'à une structure approuvée, et à un livreur approuvé, actif et de cette structure.
CREATE OR REPLACE FUNCTION public.guard_delivery_dispatch_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT EXISTS (
       SELECT 1 FROM public.delivery_companies c
        WHERE c.id = NEW.company_id AND c.verification_status = 'approved' AND c.trust_badge_active) THEN
    RAISE EXCEPTION 'Cette structure de livraison n''est pas vérifiée.' USING ERRCODE = '23514';
  END IF;

  IF NEW.assigned_driver_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_drivers d
        WHERE d.id = NEW.assigned_driver_id AND d.company_id = NEW.company_id
          AND d.is_active AND d.verification_status = 'approved') THEN
    RAISE EXCEPTION 'Ce livreur n''est pas vérifié, pas actif, ou n''appartient pas à cette structure.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_dispatch_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_dispatch_assignment ON public.delivery_dispatches;
CREATE TRIGGER trg_guard_delivery_dispatch_assignment
  BEFORE INSERT OR UPDATE OF assigned_driver_id ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_dispatch_assignment();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Déclencheurs d'audit et de notification
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delivery_company_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols constant text[] := ARRAY['company_name', 'manager_name', 'manager_first_name', 'manager_last_name',
    'manager_photo_url', 'manager_id_photo_url', 'manager_selfie_with_id_url', 'owner_photo_url',
    'tax_id_number', 'tax_document_url', 'trade_register_number', 'trade_register_document_url'];
  v_kind text := public.delivery_actor_kind();
  v_changed text[];
  v_old text;
  v_new text;
  v_action text;
  v_reason text;
  v_title text;
  v_body text;
  v_tone text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.delivery_audit_write(NEW.id, NULL, NEW.company_name, 'company', 'submitted', NULL,
      NEW.verification_status::text, NULL, NULL, NULL, 'owner', jsonb_build_object('profile_type', NEW.profile_type));
    PERFORM public.delivery_notify_admins(NEW.id, NULL, 'submitted', 'info', 'Nouveau dossier de livraison',
      format('%s (%s) a soumis son dossier.', NEW.company_name, NEW.city));
    RETURN NEW;
  END IF;

  v_old := OLD.verification_status::text;
  v_new := NEW.verification_status::text;

  SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
   WHERE n.key = ANY (v_cols) AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF v_old IS DISTINCT FROM v_new THEN
    IF v_new = 'pending_verification' AND v_kind = 'owner' THEN
      v_action := CASE WHEN v_old = 'approved' THEN 'reverification_required' ELSE 'resubmitted' END;
    ELSIF v_new = 'pending_verification' THEN
      v_action := 'reverification_required';
    ELSE
      v_action := 'status_changed';
    END IF;
    v_reason := CASE WHEN v_new = 'action_required' THEN NEW.reviewer_comments ELSE NEW.rejection_reason END;

    PERFORM public.delivery_audit_write(NEW.id, NULL, NEW.company_name, 'company', v_action, v_old, v_new,
      NEW.rejection_reason_code, v_reason, NULL, 'owner',
      jsonb_build_object('trust_badge', NEW.trust_badge_active, 'changed', COALESCE(to_jsonb(v_changed), '[]'::jsonb)));

    IF v_new = 'pending_verification' THEN
      PERFORM public.delivery_notify_admins(NEW.id, NULL, v_action, 'info',
        CASE WHEN v_action = 'reverification_required' THEN 'Re-vérification requise' ELSE 'Dossier resoumis' END,
        format('%s : %s.', NEW.company_name,
               CASE WHEN v_action = 'reverification_required' THEN 'pièces ou identité modifiées' ELSE 'nouveaux documents à examiner' END));
    END IF;

    IF v_kind <> 'owner' AND NEW.user_id IS NOT NULL AND v_new IN ('approved', 'rejected', 'action_required', 'suspended') THEN
      v_title := CASE v_new WHEN 'approved' THEN 'Dossier approuvé'
                            WHEN 'rejected' THEN 'Dossier refusé'
                            WHEN 'action_required' THEN 'Complément demandé'
                            ELSE 'Compte suspendu' END;
      v_tone := CASE v_new WHEN 'approved' THEN 'success' WHEN 'action_required' THEN 'warning' ELSE 'error' END;
      v_body := CASE v_new WHEN 'approved' THEN 'Votre structure est vérifiée : vous pouvez recevoir des livraisons.'
                           ELSE COALESCE(v_reason, 'Consultez votre dossier pour le détail.') END;
      PERFORM public.delivery_notify(NEW.user_id, NEW.id, NULL, 'company_' || v_new, v_tone, v_title, v_body, '/delivery/status');
    END IF;
  ELSIF v_changed IS NOT NULL THEN
    PERFORM public.delivery_audit_write(NEW.id, NULL, NEW.company_name, 'company', 'documents_updated', v_old, v_new,
      NULL, NULL, NULL, 'owner', jsonb_build_object('changed', to_jsonb(v_changed)));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_delivery_company_audit ON public.delivery_companies;
CREATE TRIGGER trg_delivery_company_audit
  AFTER INSERT OR UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.delivery_company_audit();

CREATE OR REPLACE FUNCTION public.delivery_company_kyc_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_changed text[] := '{}';
BEGIN
  SELECT company_name INTO v_name FROM public.delivery_companies WHERE id = NEW.company_id;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id_type IS DISTINCT FROM OLD.id_type THEN v_changed := array_append(v_changed, 'id_type'); END IF;
    IF NEW.id_number IS DISTINCT FROM OLD.id_number THEN v_changed := array_append(v_changed, 'id_number'); END IF;
    IF NEW.id_expiry IS DISTINCT FROM OLD.id_expiry THEN v_changed := array_append(v_changed, 'id_expiry'); END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN v_changed := array_append(v_changed, 'date_of_birth'); END IF;
    IF cardinality(v_changed) = 0 THEN RETURN NEW; END IF;
  END IF;
  PERFORM public.delivery_audit_write(NEW.company_id, NULL, v_name, 'company',
    CASE WHEN TG_OP = 'INSERT' THEN 'identity_recorded' ELSE 'identity_updated' END,
    NULL, NULL, NULL, NULL, NULL, 'owner', jsonb_build_object('changed', to_jsonb(v_changed), 'id_type', NEW.id_type));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_kyc_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_delivery_company_kyc_audit ON public.delivery_company_kyc;
CREATE TRIGGER trg_delivery_company_kyc_audit
  AFTER INSERT OR UPDATE ON public.delivery_company_kyc
  FOR EACH ROW EXECUTE FUNCTION public.delivery_company_kyc_audit();

CREATE OR REPLACE FUNCTION public.delivery_driver_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols constant text[] := ARRAY['full_name', 'first_name', 'last_name', 'date_of_birth', 'vehicle_type', 'id_type',
    'id_number', 'id_expiry', 'license_number', 'license_categories', 'license_expiry', 'photo_url',
    'national_id_photo_url', 'license_photo_url', 'selfie_with_id_url'];
  v_kind text := public.delivery_actor_kind();
  v_company record;
  v_changed text[];
  v_title text;
  v_tone text;
BEGIN
  SELECT id, company_name, user_id, verification_status::text AS status INTO v_company
    FROM public.delivery_companies WHERE id = NEW.company_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.delivery_audit_write(NEW.company_id, NEW.id, v_company.company_name, 'driver', 'driver_added', NULL,
      NEW.verification_status, NULL, NULL, NULL, 'owner',
      jsonb_build_object('driver', NEW.full_name, 'vehicle_type', NEW.vehicle_type, 'license_categories', to_jsonb(NEW.license_categories)));
    IF v_company.status = 'approved' THEN
      PERFORM public.delivery_notify_admins(NEW.company_id, NEW.id, 'driver_added', 'info', 'Nouveau livreur à vérifier',
        format('%s a ajouté %s.', v_company.company_name, NEW.full_name));
    END IF;
    RETURN NEW;
  END IF;

  SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
   WHERE n.key = ANY (v_cols) AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    PERFORM public.delivery_audit_write(NEW.company_id, NEW.id, v_company.company_name, 'driver', 'driver_status_changed',
      OLD.verification_status, NEW.verification_status, NEW.rejection_reason_code, NEW.rejection_reason, NULL, 'owner',
      jsonb_build_object('driver', NEW.full_name, 'is_active', NEW.is_active, 'changed', COALESCE(to_jsonb(v_changed), '[]'::jsonb)));

    IF NEW.verification_status = 'pending' AND v_kind = 'owner' THEN
      PERFORM public.delivery_notify_admins(NEW.company_id, NEW.id, 'driver_resubmitted', 'info', 'Livreur à re-vérifier',
        format('%s : informations de %s modifiées.', v_company.company_name, NEW.full_name));
    ELSIF v_kind <> 'owner' AND v_company.user_id IS NOT NULL AND NEW.verification_status IN ('approved', 'rejected', 'suspended') THEN
      v_title := CASE NEW.verification_status WHEN 'approved' THEN 'Livreur approuvé : ' || NEW.full_name
                                              WHEN 'rejected' THEN 'Livreur refusé : ' || NEW.full_name
                                              ELSE 'Livreur suspendu : ' || NEW.full_name END;
      v_tone := CASE NEW.verification_status WHEN 'approved' THEN 'success' ELSE 'error' END;
      PERFORM public.delivery_notify(v_company.user_id, NEW.company_id, NEW.id, 'driver_' || NEW.verification_status, v_tone, v_title,
        CASE WHEN NEW.verification_status = 'approved' THEN 'Ce livreur peut recevoir des courses.'
             ELSE COALESCE(NEW.rejection_reason, 'Consultez votre dossier pour le détail.') END,
        '/delivery/status');
    END IF;
  ELSIF v_changed IS NOT NULL THEN
    PERFORM public.delivery_audit_write(NEW.company_id, NEW.id, v_company.company_name, 'driver', 'driver_documents_updated',
      OLD.verification_status, NEW.verification_status, NULL, NULL, NULL, 'owner',
      jsonb_build_object('driver', NEW.full_name, 'changed', to_jsonb(v_changed)));
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.delivery_audit_write(NEW.company_id, NEW.id, v_company.company_name, 'driver',
      CASE WHEN NEW.is_active THEN 'driver_activated' ELSE 'driver_deactivated' END,
      OLD.verification_status, NEW.verification_status, NULL, NULL, NULL, 'owner', jsonb_build_object('driver', NEW.full_name));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_driver_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_delivery_driver_audit ON public.delivery_drivers;
CREATE TRIGGER trg_delivery_driver_audit
  AFTER INSERT OR UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.delivery_driver_audit();

-- Nombre de livreurs affiché aux vendeurs = livreurs ACTIFS (approuvés, permis valable), tenu à jour par la base.
CREATE OR REPLACE FUNCTION public.sync_delivery_driver_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := COALESCE(NEW.company_id, OLD.company_id);
BEGIN
  PERFORM set_config('ecomfy.delivery_internal', '1', true);
  UPDATE public.delivery_companies
     SET total_drivers_count = (SELECT count(*) FROM public.delivery_drivers d WHERE d.company_id = v_company AND d.is_active)
   WHERE id = v_company;
  PERFORM set_config('ecomfy.delivery_internal', '', true);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_delivery_driver_count() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_delivery_driver_count ON public.delivery_drivers;
CREATE TRIGGER trg_sync_delivery_driver_count
  AFTER INSERT OR DELETE OR UPDATE OF is_active, company_id ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_driver_count();

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Politiques RLS
-- ---------------------------------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['delivery_companies', 'delivery_hubs', 'delivery_drivers', 'delivery_company_kyc', 'delivery_company_review_notes'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON public.delivery_company_kyc, public.delivery_company_review_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_company_kyc TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_company_review_notes TO authenticated;
GRANT ALL ON public.delivery_company_kyc, public.delivery_company_review_notes TO service_role;
REVOKE ALL ON public.delivery_companies, public.delivery_hubs, public.delivery_drivers FROM anon;

-- Structures : le propriétaire et les administrateurs ; les structures approuvées sont visibles des utilisateurs connectés
-- (annuaire des vendeurs), plus des visiteurs anonymes.
CREATE POLICY "Delivery companies owner read" ON public.delivery_companies
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delivery companies directory read" ON public.delivery_companies
  FOR SELECT TO authenticated USING (verification_status = 'approved' AND trust_badge_active = true);
CREATE POLICY "Delivery companies owner insert" ON public.delivery_companies
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delivery companies owner update" ON public.delivery_companies
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delivery companies admin all" ON public.delivery_companies
  FOR ALL TO authenticated USING (public.delivery_is_platform_admin()) WITH CHECK (public.delivery_is_platform_admin());

CREATE POLICY "Delivery hubs read" ON public.delivery_hubs
  FOR SELECT TO authenticated
  USING (
    public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.delivery_companies c
                WHERE c.id = delivery_hubs.company_id AND c.verification_status = 'approved' AND c.trust_badge_active)
  );
CREATE POLICY "Delivery hubs owner write" ON public.delivery_hubs
  FOR ALL TO authenticated
  USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin())
  WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());

-- Livreurs : pièces d'identité et permis, donc propriétaire et administrateurs seulement.
CREATE POLICY "Delivery drivers owner or admin" ON public.delivery_drivers
  FOR ALL TO authenticated
  USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin())
  WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());

CREATE POLICY "Delivery kyc owner or admin read" ON public.delivery_company_kyc
  FOR SELECT TO authenticated USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());
CREATE POLICY "Delivery kyc owner or admin insert" ON public.delivery_company_kyc
  FOR INSERT TO authenticated WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());
CREATE POLICY "Delivery kyc owner or admin update" ON public.delivery_company_kyc
  FOR UPDATE TO authenticated
  USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin())
  WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());

CREATE POLICY "Delivery review notes admin only" ON public.delivery_company_review_notes
  FOR ALL TO authenticated USING (public.delivery_is_platform_admin()) WITH CHECK (public.delivery_is_platform_admin());

-- Transferts d'argent : plus d'insertion libre (WITH CHECK (true)). Seule la boutique ou la structure de la course,
-- avec des montants rattachés à cette course, ou un administrateur.
DROP POLICY IF EXISTS "System or company creates cash transfers" ON public.delivery_cash_transfers;
CREATE POLICY "System or company creates cash transfers" ON public.delivery_cash_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.delivery_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.delivery_dispatches d
       WHERE d.id = delivery_cash_transfers.dispatch_id
         AND d.company_id = delivery_cash_transfers.company_id
         AND d.shop_id = delivery_cash_transfers.shop_id
         AND (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = d.shop_id AND s.user_id = auth.uid())
              OR public.delivery_company_owner(d.company_id))
    )
  );

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Stockage privé des pièces
-- ---------------------------------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-kyc', 'delivery-kyc', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "delivery_kyc_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "delivery_kyc_select" ON storage.objects;

-- Dépôt dans son propre dossier (<id utilisateur>/<fichier>) ; lecture : son dossier ou un administrateur (liens signés).
CREATE POLICY "delivery_kyc_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "delivery_kyc_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-kyc'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.delivery_is_platform_admin()));

-- ---------------------------------------------------------------------------------------------------------------
-- 9. RPC : inscription et resoumission (atomiques, contrôlées par le serveur)
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delivery_validate_driver_json(_d jsonb, _label text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_issues text[];
  v_cats text[];
BEGIN
  IF COALESCE(btrim(_d ->> 'first_name'), '') = '' OR COALESCE(btrim(_d ->> 'last_name'), '') = '' THEN
    RAISE EXCEPTION '% : nom et prénom requis.', _label USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_d ->> 'phone', '') = '' THEN
    RAISE EXCEPTION '% : téléphone requis.', _label USING ERRCODE = '22023';
  END IF;
  IF (_d ->> 'date_of_birth') IS NULL OR (_d ->> 'date_of_birth')::date > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION '% : le livreur doit être majeur (date de naissance requise).', _label USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_d ->> 'license_number', '') = '' THEN
    RAISE EXCEPTION '% : numéro de permis requis.', _label USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_d ->> 'national_id_photo_url', '') = '' OR COALESCE(_d ->> 'license_photo_url', '') = ''
     OR COALESCE(_d ->> 'selfie_with_id_url', '') = '' THEN
    RAISE EXCEPTION '% : pièce d''identité, permis et selfie requis.', _label USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(upper(btrim(c))), '{}') INTO v_cats
    FROM jsonb_array_elements_text(COALESCE(_d -> 'license_categories', '[]'::jsonb)) c;
  v_issues := public.delivery_driver_issues(COALESCE(_d ->> 'vehicle_type', 'motorcycle'), v_cats,
                                            NULLIF(_d ->> 'license_expiry', '')::date, NULLIF(_d ->> 'id_expiry', '')::date);
  IF cardinality(v_issues) > 0 THEN
    RAISE EXCEPTION '% : %', _label, array_to_string(v_issues, ' ') USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_delivery_application(
  p_company jsonb, p_kyc jsonb, p_hubs jsonb DEFAULT '[]'::jsonb, p_drivers jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_type text := COALESCE(p_company ->> 'profile_type', 'manager');
  d jsonb;
  h jsonb;
  v_n int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_companies WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Vous avez déjà un dossier de livraison : consultez son statut.' USING ERRCODE = '23505';
  END IF;
  IF v_type NOT IN ('manager', 'driver') THEN RAISE EXCEPTION 'Type de profil invalide.' USING ERRCODE = '22023'; END IF;

  IF COALESCE(btrim(p_company ->> 'company_name'), '') = '' THEN RAISE EXCEPTION 'Le nom de la structure est requis.' USING ERRCODE = '22023'; END IF;
  IF COALESCE(btrim(p_company ->> 'manager_first_name'), '') = '' OR COALESCE(btrim(p_company ->> 'manager_last_name'), '') = '' THEN
    RAISE EXCEPTION 'Le nom et le prénom du responsable sont requis.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_company ->> 'manager_phone', '') = '' OR COALESCE(btrim(p_company ->> 'city'), '') = '' THEN
    RAISE EXCEPTION 'Téléphone et ville requis.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_company ->> 'manager_id_photo_url', '') = '' THEN RAISE EXCEPTION 'La pièce d''identité est requise.' USING ERRCODE = '22023'; END IF;
  IF COALESCE(p_company ->> 'manager_selfie_with_id_url', '') = '' THEN RAISE EXCEPTION 'Le selfie avec la pièce d''identité est requis.' USING ERRCODE = '22023'; END IF;
  IF v_type = 'manager' AND COALESCE(p_company ->> 'warehouse_photo_url', '') = '' THEN
    RAISE EXCEPTION 'La photo de l''entrepôt principal est requise.' USING ERRCODE = '22023';
  END IF;
  IF p_kyc IS NULL OR COALESCE(p_kyc ->> 'id_number', '') = '' OR COALESCE(p_kyc ->> 'date_of_birth', '') = '' THEN
    RAISE EXCEPTION 'Numéro de pièce et date de naissance requis.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_kyc ->> 'id_expiry', '') IS NOT NULL AND (p_kyc ->> 'id_expiry')::date < current_date THEN
    RAISE EXCEPTION 'La pièce d''identité est expirée.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE((p_company ->> 'has_tax_registration')::boolean, false)
     AND COALESCE(p_company ->> 'tax_id_number', '') = '' AND COALESCE(p_company ->> 'trade_register_number', '') = '' THEN
    RAISE EXCEPTION 'Indiquez votre numéro fiscal (NIF) ou de registre du commerce (RCCM).' USING ERRCODE = '22023';
  END IF;
  IF v_type = 'driver' AND jsonb_array_length(COALESCE(p_drivers, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Un livreur indépendant doit renseigner son permis.' USING ERRCODE = '22023';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_drivers, '[]'::jsonb)) LOOP
    v_n := v_n + 1;
    PERFORM public.delivery_validate_driver_json(d, format('Livreur %s', v_n));
  END LOOP;

  INSERT INTO public.delivery_companies (
    user_id, profile_type, company_name, country, country_code, city, headquarters_address,
    manager_name, manager_first_name, manager_last_name, manager_phone, manager_whatsapp,
    manager_photo_url, manager_id_photo_url, manager_selfie_with_id_url, owner_photo_url, warehouse_photo_url,
    has_tax_registration, tax_id_number, tax_document_url, trade_register_number, trade_register_document_url,
    covered_cities, total_drivers_count)
  VALUES (
    v_uid, v_type, btrim(p_company ->> 'company_name'), COALESCE(p_company ->> 'country', 'Côte d''Ivoire'),
    COALESCE(p_company ->> 'country_code', 'CI'), btrim(p_company ->> 'city'),
    COALESCE(NULLIF(btrim(p_company ->> 'headquarters_address'), ''), btrim(p_company ->> 'city')),
    btrim((p_company ->> 'manager_first_name') || ' ' || (p_company ->> 'manager_last_name')),
    btrim(p_company ->> 'manager_first_name'), btrim(p_company ->> 'manager_last_name'),
    p_company ->> 'manager_phone', COALESCE(NULLIF(p_company ->> 'manager_whatsapp', ''), p_company ->> 'manager_phone'),
    COALESCE(NULLIF(p_company ->> 'manager_photo_url', ''), p_company ->> 'manager_selfie_with_id_url'),
    p_company ->> 'manager_id_photo_url', p_company ->> 'manager_selfie_with_id_url',
    p_company ->> 'manager_selfie_with_id_url', NULLIF(p_company ->> 'warehouse_photo_url', ''),
    COALESCE((p_company ->> 'has_tax_registration')::boolean, false),
    NULLIF(btrim(p_company ->> 'tax_id_number'), ''), NULLIF(p_company ->> 'tax_document_url', ''),
    NULLIF(btrim(p_company ->> 'trade_register_number'), ''), NULLIF(p_company ->> 'trade_register_document_url', ''),
    CASE WHEN jsonb_typeof(p_company -> 'covered_cities') = 'array' AND jsonb_array_length(p_company -> 'covered_cities') > 0
         THEN ARRAY(SELECT jsonb_array_elements_text(p_company -> 'covered_cities'))
         ELSE ARRAY[btrim(p_company ->> 'city')] END,
    jsonb_array_length(COALESCE(p_drivers, '[]'::jsonb)))
  RETURNING id INTO v_id;

  INSERT INTO public.delivery_company_kyc (company_id, id_type, id_number, id_expiry, date_of_birth)
  VALUES (v_id, COALESCE(p_kyc ->> 'id_type', 'cni'), btrim(p_kyc ->> 'id_number'),
          NULLIF(p_kyc ->> 'id_expiry', '')::date, (p_kyc ->> 'date_of_birth')::date);

  FOR h IN SELECT * FROM jsonb_array_elements(COALESCE(p_hubs, '[]'::jsonb)) LOOP
    INSERT INTO public.delivery_hubs (company_id, city, address, hub_name, phone)
    VALUES (v_id, btrim(h ->> 'city'), btrim(COALESCE(h ->> 'address', h ->> 'city')),
            COALESCE(NULLIF(btrim(h ->> 'hub_name'), ''), 'Point de stockage - ' || btrim(h ->> 'city')),
            COALESCE(NULLIF(h ->> 'phone', ''), p_company ->> 'manager_phone'));
  END LOOP;

  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_drivers, '[]'::jsonb)) LOOP
    INSERT INTO public.delivery_drivers (
      company_id, full_name, first_name, last_name, date_of_birth, phone, whatsapp, vehicle_type, vehicle_license_plate,
      id_type, id_number, id_expiry, license_number, license_categories, license_expiry,
      photo_url, national_id_photo_url, license_photo_url, selfie_with_id_url)
    VALUES (
      v_id, btrim((d ->> 'first_name') || ' ' || (d ->> 'last_name')), btrim(d ->> 'first_name'), btrim(d ->> 'last_name'),
      (d ->> 'date_of_birth')::date, d ->> 'phone', NULLIF(d ->> 'whatsapp', ''), COALESCE(d ->> 'vehicle_type', 'motorcycle'),
      NULLIF(btrim(d ->> 'vehicle_license_plate'), ''), COALESCE(NULLIF(d ->> 'id_type', ''), 'cni'),
      NULLIF(btrim(d ->> 'id_number'), ''), NULLIF(d ->> 'id_expiry', '')::date, btrim(d ->> 'license_number'),
      ARRAY(SELECT upper(btrim(c)) FROM jsonb_array_elements_text(COALESCE(d -> 'license_categories', '[]'::jsonb)) c),
      NULLIF(d ->> 'license_expiry', '')::date,
      COALESCE(NULLIF(d ->> 'photo_url', ''), d ->> 'selfie_with_id_url'), d ->> 'national_id_photo_url',
      d ->> 'license_photo_url', d ->> 'selfie_with_id_url');
  END LOOP;

  RETURN v_id;
END;
$$;

-- Resoumission : met à jour pièces et informations manquantes, puis remet le dossier en file d'attente.
CREATE OR REPLACE FUNCTION public.resubmit_delivery_application(
  p_company_id uuid, p_company jsonb DEFAULT '{}'::jsonb, p_kyc jsonb DEFAULT '{}'::jsonb, p_drivers jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  d jsonb;
  v_drv public.delivery_drivers%ROWTYPE;
  v_n int := 0;
BEGIN
  SELECT verification_status::text INTO v_status FROM public.delivery_companies WHERE id = p_company_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable.' USING ERRCODE = '42501'; END IF;
  IF v_status IN ('approved', 'suspended') THEN
    RAISE EXCEPTION 'Ce dossier ne peut pas être resoumis dans son état actuel (%).', v_status USING ERRCODE = '42501';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_drivers, '[]'::jsonb)) LOOP
    v_n := v_n + 1;
    SELECT * INTO v_drv FROM public.delivery_drivers WHERE id = (d ->> 'id')::uuid AND company_id = p_company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Livreur introuvable.' USING ERRCODE = '42501'; END IF;

    PERFORM public.delivery_validate_driver_json(
      jsonb_build_object(
        'first_name', COALESCE(d ->> 'first_name', v_drv.first_name), 'last_name', COALESCE(d ->> 'last_name', v_drv.last_name),
        'phone', COALESCE(d ->> 'phone', v_drv.phone), 'date_of_birth', COALESCE(d ->> 'date_of_birth', v_drv.date_of_birth::text),
        'license_number', COALESCE(d ->> 'license_number', v_drv.license_number),
        'national_id_photo_url', COALESCE(d ->> 'national_id_photo_url', v_drv.national_id_photo_url),
        'license_photo_url', COALESCE(d ->> 'license_photo_url', v_drv.license_photo_url),
        'selfie_with_id_url', COALESCE(d ->> 'selfie_with_id_url', v_drv.selfie_with_id_url),
        'vehicle_type', COALESCE(d ->> 'vehicle_type', v_drv.vehicle_type),
        'license_categories', COALESCE(d -> 'license_categories', to_jsonb(v_drv.license_categories)),
        'license_expiry', COALESCE(d ->> 'license_expiry', v_drv.license_expiry::text),
        'id_expiry', COALESCE(d ->> 'id_expiry', v_drv.id_expiry::text)),
      format('Livreur %s', v_n));

    UPDATE public.delivery_drivers SET
      first_name = COALESCE(btrim(d ->> 'first_name'), first_name), last_name = COALESCE(btrim(d ->> 'last_name'), last_name),
      full_name = btrim(COALESCE(d ->> 'first_name', first_name, '') || ' ' || COALESCE(d ->> 'last_name', last_name, '')),
      phone = COALESCE(d ->> 'phone', phone), date_of_birth = COALESCE((d ->> 'date_of_birth')::date, date_of_birth),
      vehicle_type = COALESCE(d ->> 'vehicle_type', vehicle_type),
      vehicle_license_plate = COALESCE(NULLIF(btrim(d ->> 'vehicle_license_plate'), ''), vehicle_license_plate),
      id_type = COALESCE(d ->> 'id_type', id_type), id_number = COALESCE(NULLIF(btrim(d ->> 'id_number'), ''), id_number),
      id_expiry = COALESCE(NULLIF(d ->> 'id_expiry', '')::date, id_expiry),
      license_number = COALESCE(NULLIF(btrim(d ->> 'license_number'), ''), license_number),
      license_categories = CASE WHEN jsonb_typeof(d -> 'license_categories') = 'array'
                                THEN ARRAY(SELECT upper(btrim(c)) FROM jsonb_array_elements_text(d -> 'license_categories') c)
                                ELSE license_categories END,
      license_expiry = COALESCE(NULLIF(d ->> 'license_expiry', '')::date, license_expiry),
      photo_url = COALESCE(NULLIF(d ->> 'photo_url', ''), photo_url),
      national_id_photo_url = COALESCE(NULLIF(d ->> 'national_id_photo_url', ''), national_id_photo_url),
      license_photo_url = COALESCE(NULLIF(d ->> 'license_photo_url', ''), license_photo_url),
      selfie_with_id_url = COALESCE(NULLIF(d ->> 'selfie_with_id_url', ''), selfie_with_id_url)
     WHERE id = v_drv.id;
  END LOOP;

  IF p_kyc IS NOT NULL AND p_kyc <> '{}'::jsonb THEN
    IF NULLIF(p_kyc ->> 'id_expiry', '') IS NOT NULL AND (p_kyc ->> 'id_expiry')::date < current_date THEN
      RAISE EXCEPTION 'La pièce d''identité est expirée.' USING ERRCODE = '23514';
    END IF;
    UPDATE public.delivery_company_kyc SET
      id_type = COALESCE(p_kyc ->> 'id_type', id_type), id_number = COALESCE(NULLIF(btrim(p_kyc ->> 'id_number'), ''), id_number),
      id_expiry = COALESCE(NULLIF(p_kyc ->> 'id_expiry', '')::date, id_expiry),
      date_of_birth = COALESCE(NULLIF(p_kyc ->> 'date_of_birth', '')::date, date_of_birth)
     WHERE company_id = p_company_id;
  END IF;

  UPDATE public.delivery_companies SET
    manager_photo_url = COALESCE(NULLIF(p_company ->> 'manager_photo_url', ''), manager_photo_url),
    manager_id_photo_url = COALESCE(NULLIF(p_company ->> 'manager_id_photo_url', ''), manager_id_photo_url),
    manager_selfie_with_id_url = COALESCE(NULLIF(p_company ->> 'manager_selfie_with_id_url', ''), manager_selfie_with_id_url),
    owner_photo_url = COALESCE(NULLIF(p_company ->> 'manager_selfie_with_id_url', ''), owner_photo_url),
    warehouse_photo_url = COALESCE(NULLIF(p_company ->> 'warehouse_photo_url', ''), warehouse_photo_url),
    tax_id_number = COALESCE(NULLIF(btrim(p_company ->> 'tax_id_number'), ''), tax_id_number),
    tax_document_url = COALESCE(NULLIF(p_company ->> 'tax_document_url', ''), tax_document_url),
    trade_register_number = COALESCE(NULLIF(btrim(p_company ->> 'trade_register_number'), ''), trade_register_number),
    trade_register_document_url = COALESCE(NULLIF(p_company ->> 'trade_register_document_url', ''), trade_register_document_url),
    verification_status = 'pending_verification'
   WHERE id = p_company_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 10. RPC : décisions des administrateurs
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_decide_delivery_company(
  p_company_id uuid, p_decision text, p_reason_code text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_message text DEFAULT NULL, p_note text DEFAULT NULL, p_cascade_drivers boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.delivery_companies%ROWTYPE;
  v_k public.delivery_company_kyc%ROWTYPE;
  v_d public.delivery_drivers%ROWTYPE;
  v_issues text[];
  v_ok jsonb := '[]'::jsonb;
  v_blocked jsonb := '[]'::jsonb;
  v_cnt int;
BEGIN
  IF NOT public.delivery_is_platform_admin() THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'action_required', 'suspended') THEN
    RAISE EXCEPTION 'Décision invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_c FROM public.delivery_companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable.' USING ERRCODE = 'P0002'; END IF;

  IF p_decision IN ('rejected', 'suspended') AND (COALESCE(btrim(p_reason), '') = '' OR COALESCE(p_reason_code, '') = '') THEN
    RAISE EXCEPTION 'Un code de motif et une explication sont obligatoires.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'action_required' AND COALESCE(btrim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Précisez le complément demandé au candidat.' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT * INTO v_k FROM public.delivery_company_kyc WHERE company_id = p_company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Identité du responsable non renseignée : approbation impossible.' USING ERRCODE = '23514'; END IF;
    IF v_c.manager_id_photo_url IS NULL OR v_c.manager_selfie_with_id_url IS NULL THEN
      RAISE EXCEPTION 'Pièce d''identité ou selfie manquant : approbation impossible.' USING ERRCODE = '23514';
    END IF;
    IF v_k.id_expiry IS NOT NULL AND v_k.id_expiry < current_date THEN
      RAISE EXCEPTION 'La pièce d''identité du responsable est expirée.' USING ERRCODE = '23514';
    END IF;
    IF v_c.profile_type = 'manager' AND v_c.warehouse_photo_url IS NULL THEN
      RAISE EXCEPTION 'Photo de l''entrepôt manquante.' USING ERRCODE = '23514';
    END IF;
    IF v_c.profile_type = 'driver' THEN
      SELECT count(*) INTO v_cnt FROM public.delivery_drivers WHERE company_id = p_company_id;
      IF v_cnt = 0 THEN RAISE EXCEPTION 'Aucun livreur rattaché à ce profil.' USING ERRCODE = '23514'; END IF;
    END IF;
  END IF;

  UPDATE public.delivery_companies SET
    verification_status = p_decision::delivery_verification_status,
    trust_badge_active = (p_decision = 'approved'),
    rejection_reason = CASE WHEN p_decision IN ('rejected', 'suspended') THEN btrim(p_reason) ELSE NULL END,
    rejection_reason_code = CASE WHEN p_decision IN ('rejected', 'suspended') THEN p_reason_code ELSE NULL END,
    reviewer_comments = CASE WHEN p_decision = 'action_required' THEN btrim(p_message) ELSE NULL END,
    verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
    verified_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END
   WHERE id = p_company_id;

  IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
    INSERT INTO public.delivery_company_review_notes (company_id, internal_note, updated_by, updated_at)
    VALUES (p_company_id, btrim(p_note), auth.uid(), now())
    ON CONFLICT (company_id) DO UPDATE SET internal_note = EXCLUDED.internal_note, updated_by = EXCLUDED.updated_by, updated_at = now();
    PERFORM public.delivery_audit_write(p_company_id, NULL, v_c.company_name, 'company', 'note_added', NULL, NULL, NULL, NULL,
      btrim(p_note), 'internal', '{}'::jsonb);
  END IF;

  IF p_decision = 'approved' AND p_cascade_drivers THEN
    FOR v_d IN SELECT * FROM public.delivery_drivers WHERE company_id = p_company_id AND verification_status = 'pending' LOOP
      v_issues := public.delivery_driver_approval_issues(v_d);
      IF cardinality(v_issues) = 0 THEN
        UPDATE public.delivery_drivers SET verification_status = 'approved', is_active = true,
               rejection_reason = NULL, rejection_reason_code = NULL, verified_at = now(), verified_by = auth.uid()
         WHERE id = v_d.id;
        v_ok := v_ok || to_jsonb(v_d.id);
      ELSE
        v_blocked := v_blocked || jsonb_build_object('id', v_d.id, 'name', v_d.full_name, 'issues', to_jsonb(v_issues));
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('company_id', p_company_id, 'status', p_decision, 'owner_user_id', v_c.user_id,
                            'drivers_approved', v_ok, 'drivers_blocked', v_blocked);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_delivery_driver(
  p_driver_id uuid, p_decision text, p_reason_code text DEFAULT NULL, p_reason text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d public.delivery_drivers%ROWTYPE;
  v_name text;
  v_user uuid;
  v_issues text[];
BEGIN
  IF NOT public.delivery_is_platform_admin() THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Décision invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_d FROM public.delivery_drivers WHERE id = p_driver_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Livreur introuvable.' USING ERRCODE = 'P0002'; END IF;
  SELECT company_name, user_id INTO v_name, v_user FROM public.delivery_companies WHERE id = v_d.company_id;

  IF p_decision IN ('rejected', 'suspended') AND (COALESCE(btrim(p_reason), '') = '' OR COALESCE(p_reason_code, '') = '') THEN
    RAISE EXCEPTION 'Un code de motif et une explication sont obligatoires.' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' THEN
    v_issues := public.delivery_driver_approval_issues(v_d);
    IF cardinality(v_issues) > 0 THEN
      RAISE EXCEPTION 'Approbation impossible : %', array_to_string(v_issues, ' ') USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.delivery_drivers SET
    verification_status = p_decision,
    is_active = (p_decision = 'approved'),
    rejection_reason = CASE WHEN p_decision = 'approved' THEN NULL ELSE btrim(p_reason) END,
    rejection_reason_code = CASE WHEN p_decision = 'approved' THEN NULL ELSE p_reason_code END,
    verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
    verified_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END
   WHERE id = p_driver_id;

  IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
    PERFORM public.delivery_audit_write(v_d.company_id, p_driver_id, v_name, 'driver', 'note_added', NULL, NULL, NULL, NULL,
      btrim(p_note), 'internal', jsonb_build_object('driver', v_d.full_name));
  END IF;

  RETURN jsonb_build_object('driver_id', p_driver_id, 'company_id', v_d.company_id, 'status', p_decision, 'owner_user_id', v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.register_delivery_application(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resubmit_delivery_application(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_validate_driver_json(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_delivery_company(uuid, text, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decide_delivery_driver(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_delivery_application(jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_delivery_application(uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_validate_driver_json(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_delivery_company(uuid, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_delivery_driver(uuid, text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 11. Expiration des pièces : suspension automatique et rappels
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delivery_enforce_document_expiry()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_susp_drivers int := 0;
  v_flagged_companies int := 0;
  v_reminders int := 0;
  v_left int;
BEGIN
  -- Livreurs approuvés dont le permis ou la pièce a expiré : suspendus (et inactifs).
  FOR r IN
    SELECT d.id, d.license_expiry, d.id_expiry FROM public.delivery_drivers d
     WHERE d.verification_status = 'approved'
       AND ((d.license_expiry IS NOT NULL AND d.license_expiry < current_date) OR (d.id_expiry IS NOT NULL AND d.id_expiry < current_date))
  LOOP
    UPDATE public.delivery_drivers SET
      verification_status = 'suspended', is_active = false,
      rejection_reason_code = CASE WHEN r.license_expiry IS NOT NULL AND r.license_expiry < current_date THEN 'EXPIRED_LICENSE' ELSE 'EXPIRED_ID' END,
      rejection_reason = CASE WHEN r.license_expiry IS NOT NULL AND r.license_expiry < current_date
                              THEN format('Permis expiré le %s. Importez un permis valable pour être de nouveau vérifié.', to_char(r.license_expiry, 'DD/MM/YYYY'))
                              ELSE format('Pièce d''identité expirée le %s. Importez une pièce valable pour être de nouveau vérifié.', to_char(r.id_expiry, 'DD/MM/YYYY')) END,
      verified_at = NULL, verified_by = NULL
     WHERE id = r.id;
    v_susp_drivers := v_susp_drivers + 1;
  END LOOP;

  -- Responsables approuvés dont la pièce d'identité a expiré : complément demandé, badge retiré.
  FOR r IN
    SELECT c.id, k.id_expiry FROM public.delivery_companies c
      JOIN public.delivery_company_kyc k ON k.company_id = c.id
     WHERE c.verification_status = 'approved' AND k.id_expiry IS NOT NULL AND k.id_expiry < current_date
  LOOP
    UPDATE public.delivery_companies SET
      verification_status = 'action_required', trust_badge_active = false, verified_at = NULL, verified_by = NULL,
      rejection_reason_code = 'EXPIRED_ID',
      reviewer_comments = format('Votre pièce d''identité a expiré le %s. Importez une pièce valable et resoumettez votre dossier.', to_char(r.id_expiry, 'DD/MM/YYYY'))
     WHERE id = r.id;
    v_flagged_companies := v_flagged_companies + 1;
  END LOOP;

  -- Rappels à 30 et 7 jours (une seule fois par jour et par pièce).
  FOR r IN
    SELECT d.id AS driver_id, d.company_id, d.full_name, c.user_id, d.license_expiry AS exp, 'permis' AS what
      FROM public.delivery_drivers d JOIN public.delivery_companies c ON c.id = d.company_id
     WHERE d.verification_status = 'approved' AND d.license_expiry IN (current_date + 30, current_date + 7)
    UNION ALL
    SELECT d.id, d.company_id, d.full_name, c.user_id, d.id_expiry, 'pièce d''identité'
      FROM public.delivery_drivers d JOIN public.delivery_companies c ON c.id = d.company_id
     WHERE d.verification_status = 'approved' AND d.id_expiry IN (current_date + 30, current_date + 7)
  LOOP
    v_left := r.exp - current_date;
    IF r.user_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.delivery_notifications n
          WHERE n.kind = 'expiry_reminder' AND n.driver_id = r.driver_id AND n.title ILIKE '%' || r.what || '%'
            AND n.created_at::date = current_date) THEN
      PERFORM public.delivery_notify(r.user_id, r.company_id, r.driver_id, 'expiry_reminder', 'warning',
        format('%s de %s : expire dans %s jours', upper(left(r.what, 1)) || substr(r.what, 2), r.full_name, v_left),
        format('Expiration le %s. Mettez le document à jour avant cette date pour éviter la suspension du livreur.', to_char(r.exp, 'DD/MM/YYYY')),
        '/delivery/status');
      v_reminders := v_reminders + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT c.id AS company_id, c.user_id, k.id_expiry AS exp
      FROM public.delivery_companies c JOIN public.delivery_company_kyc k ON k.company_id = c.id
     WHERE c.verification_status = 'approved' AND k.id_expiry IN (current_date + 30, current_date + 7)
  LOOP
    IF r.user_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.delivery_notifications n
          WHERE n.kind = 'expiry_reminder' AND n.company_id = r.company_id AND n.driver_id IS NULL AND n.created_at::date = current_date) THEN
      PERFORM public.delivery_notify(r.user_id, r.company_id, NULL, 'expiry_reminder', 'warning',
        format('Votre pièce d''identité expire dans %s jours', r.exp - current_date),
        format('Expiration le %s. Mettez-la à jour avant cette date pour conserver votre badge.', to_char(r.exp, 'DD/MM/YYYY')),
        '/delivery/status');
      v_reminders := v_reminders + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('drivers_suspended', v_susp_drivers, 'companies_flagged', v_flagged_companies, 'reminders', v_reminders);
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_enforce_document_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_enforce_document_expiry() TO service_role;

DO $$
DECLARE v_jobid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'delivery-document-expiry';
    IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
    PERFORM cron.schedule('delivery-document-expiry', '30 3 * * *', $cron$ SELECT public.delivery_enforce_document_expiry(); $cron$);
  END IF;
END $$;
