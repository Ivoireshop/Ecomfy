-- Ecomfy Livraison : verso des pièces, localisation précise de l'entrepôt, motif « verso manquant » (09/11/2026).
--
-- Retour du 09/11 sur la partie livraison :
--  1. pièce d'identité et permis : recto ET verso (le passeport n'a qu'une page) ;
--  2. l'administrateur peut demander le verso d'un dossier déjà déposé (complément, ou refus motivé d'un livreur) ;
--  3. localisation GPS précise de l'entrepôt, pour que l'équipe s'y rende sans chercher.
--
-- À appliquer APRÈS 20261106110000. Rejouable. Additive : aucun dossier existant n'est modifié ni invalidé ; un dossier
-- déjà approuvé le reste. Les nouveaux dossiers, les resoumissions et toute NOUVELLE approbation exigent le verso
-- (pièce d'identité hors passeport, permis) et, pour une société, la localisation de l'entrepôt.
--
-- La localisation est dans une table à part (comme l'identité du responsable) : delivery_companies est lisible de tout
-- utilisateur connecté quand la structure est approuvée (annuaire des vendeurs), pas les coordonnées d'un entrepôt.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Colonnes, motif de refus et table de localisation
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE public.delivery_companies
  ADD COLUMN IF NOT EXISTS manager_id_back_photo_url text;

ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS national_id_back_photo_url text,
  ADD COLUMN IF NOT EXISTS license_back_photo_url text;

ALTER TABLE public.delivery_companies DROP CONSTRAINT IF EXISTS delivery_companies_reason_code_check;
ALTER TABLE public.delivery_companies
  ADD CONSTRAINT delivery_companies_reason_code_check CHECK (rejection_reason_code IS NULL OR rejection_reason_code IN (
    'EXPIRED_ID', 'EXPIRED_LICENSE', 'NAME_MISMATCH', 'DOB_MISMATCH', 'NON_ID_DOCUMENT', 'LICENSE_CATEGORY_MISMATCH',
    'LIVENESS_FAILED', 'DOCUMENT_UNREADABLE', 'DUPLICATE_IDENTITY', 'SUSPICIOUS_MANIPULATION', 'MISSING_BACK_SIDE', 'OTHER'));

ALTER TABLE public.delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_reason_code_check;
ALTER TABLE public.delivery_drivers
  ADD CONSTRAINT delivery_drivers_reason_code_check CHECK (rejection_reason_code IS NULL OR rejection_reason_code IN (
    'EXPIRED_ID', 'EXPIRED_LICENSE', 'NAME_MISMATCH', 'DOB_MISMATCH', 'NON_ID_DOCUMENT', 'LICENSE_CATEGORY_MISMATCH',
    'LIVENESS_FAILED', 'DOCUMENT_UNREADABLE', 'DUPLICATE_IDENTITY', 'SUSPICIOUS_MANIPULATION', 'MISSING_BACK_SIDE', 'OTHER'));

CREATE TABLE IF NOT EXISTS public.delivery_company_location (
  company_id uuid PRIMARY KEY REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m integer CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  source text NOT NULL DEFAULT 'map' CHECK (source IN ('gps', 'map')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (latitude = 0 AND longitude = 0))
);

ALTER TABLE public.delivery_company_location ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_company_location FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_company_location TO authenticated;
GRANT ALL ON public.delivery_company_location TO service_role;

DROP POLICY IF EXISTS "Delivery location owner or admin read" ON public.delivery_company_location;
DROP POLICY IF EXISTS "Delivery location owner or admin insert" ON public.delivery_company_location;
DROP POLICY IF EXISTS "Delivery location owner or admin update" ON public.delivery_company_location;
CREATE POLICY "Delivery location owner or admin read" ON public.delivery_company_location
  FOR SELECT TO authenticated USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());
CREATE POLICY "Delivery location owner or admin insert" ON public.delivery_company_location
  FOR INSERT TO authenticated WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());
CREATE POLICY "Delivery location owner or admin update" ON public.delivery_company_location
  FOR UPDATE TO authenticated
  USING (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin())
  WITH CHECK (public.delivery_company_owner(company_id) OR public.delivery_is_platform_admin());

CREATE OR REPLACE FUNCTION public.delivery_company_location_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT company_name INTO v_name FROM public.delivery_companies WHERE id = NEW.company_id;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF NEW.latitude IS NOT DISTINCT FROM OLD.latitude AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM public.delivery_audit_write(NEW.company_id, NULL, v_name, 'company',
    CASE WHEN TG_OP = 'INSERT' THEN 'location_recorded' ELSE 'location_updated' END,
    NULL, NULL, NULL, NULL, NULL, 'owner', jsonb_build_object('source', NEW.source, 'accuracy_m', NEW.accuracy_m));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_location_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_delivery_company_location_audit ON public.delivery_company_location;
CREATE TRIGGER trg_delivery_company_location_audit
  BEFORE INSERT OR UPDATE ON public.delivery_company_location
  FOR EACH ROW EXECUTE FUNCTION public.delivery_company_location_audit();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Conditions d'approbation : verso et localisation
-- ---------------------------------------------------------------------------------------------------------------

-- Anomalies documentaires d'une structure. Liste vide = approuvable. Un dossier ancien sans verso ni localisation n'est
-- pas invalidé, mais ne peut plus être approuvé tant que l'administrateur n'a pas obtenu ces éléments.
CREATE OR REPLACE FUNCTION public.delivery_company_document_issues(_c public.delivery_companies)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text[] := '{}';
  v_id_type text;
BEGIN
  SELECT id_type INTO v_id_type FROM public.delivery_company_kyc WHERE company_id = _c.id;
  IF COALESCE(v_id_type, 'cni') <> 'passport' AND COALESCE(_c.manager_id_back_photo_url, '') = '' THEN
    v := array_append(v, 'Verso de la pièce d''identité manquant : demandez-le au candidat.');
  END IF;
  IF _c.profile_type = 'manager'
     AND NOT EXISTS (SELECT 1 FROM public.delivery_company_location l WHERE l.company_id = _c.id) THEN
    v := array_append(v, 'Localisation de l''entrepôt manquante : demandez-la au candidat.');
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_document_issues(public.delivery_companies) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_document_issues(public.delivery_companies) TO authenticated, service_role;

-- Livreur : verso de la pièce (hors passeport) et du permis en plus des conditions existantes.
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
  IF COALESCE(_d.id_type, 'cni') <> 'passport' AND COALESCE(_d.national_id_back_photo_url, '') = '' THEN
    v := array_append(v, 'Verso de la pièce d''identité manquant.');
  END IF;
  IF COALESCE(_d.license_back_photo_url, '') = '' THEN
    v := array_append(v, 'Verso du permis de conduire manquant.');
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
-- 3. Gardes complémentaires (déclencheurs additifs : ceux de 20261106110000 restent inchangés)
-- ---------------------------------------------------------------------------------------------------------------

-- Structure : verso déposé dans le dossier de l'appelant ; verso modifié sur un dossier approuvé = nouvelle vérification ;
-- passage à « approuvé » conditionné au verso et à la localisation, quel que soit l'acteur (administrateur compris).
CREATE OR REPLACE FUNCTION public.guard_delivery_company_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues text[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verification_status = 'approved' AND OLD.verification_status IS DISTINCT FROM 'approved' THEN
    v_issues := public.delivery_company_document_issues(NEW);
    IF cardinality(v_issues) > 0 THEN
      RAISE EXCEPTION 'Approbation impossible : %', array_to_string(v_issues, ' ') USING ERRCODE = '23514';
    END IF;
  END IF;

  IF auth.uid() IS NULL
     OR current_setting('ecomfy.delivery_internal', true) = '1'
     OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.manager_id_back_photo_url IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.manager_id_back_photo_url IS DISTINCT FROM OLD.manager_id_back_photo_url) THEN
    PERFORM public.delivery_assert_doc_path(NEW.manager_id_back_photo_url, 'manager_id_back_photo_url');
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.manager_id_back_photo_url IS DISTINCT FROM OLD.manager_id_back_photo_url THEN
    IF OLD.verification_status = 'approved' THEN
      NEW.verification_status := 'pending_verification';
      NEW.trust_badge_active := false;
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
      NEW.verification_requested_at := now();
    END IF;
    PERFORM public.delivery_audit_write(NEW.id, NULL, NEW.company_name, 'company', 'documents_updated',
      OLD.verification_status::text, NEW.verification_status::text, NULL, NULL, NULL, 'owner',
      jsonb_build_object('changed', jsonb_build_array('manager_id_back_photo_url')));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_company_documents() FROM PUBLIC;

-- Le nom trie après trg_guard_delivery_company_verification : il s'exécute à sa suite.
DROP TRIGGER IF EXISTS trg_guard_delivery_company_verification_docs ON public.delivery_companies;
CREATE TRIGGER trg_guard_delivery_company_verification_docs
  BEFORE INSERT OR UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_documents();

-- Livreur : verso déposé dans le dossier de l'appelant ; verso modifié = livreur repassé « en attente » et inactif,
-- comme pour toute autre pièce (même règle que guard_delivery_driver).
CREATE OR REPLACE FUNCTION public.guard_delivery_driver_back_sides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed text[] := '{}';
  v_col text;
  v_name text;
BEGIN
  IF auth.uid() IS NULL OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  FOREACH v_col IN ARRAY ARRAY['national_id_back_photo_url', 'license_back_photo_url'] LOOP
    IF (to_jsonb(NEW) ->> v_col) IS NOT NULL
       AND (TG_OP = 'INSERT' OR (to_jsonb(NEW) ->> v_col) IS DISTINCT FROM (to_jsonb(OLD) ->> v_col)) THEN
      PERFORM public.delivery_assert_doc_path(to_jsonb(NEW) ->> v_col, v_col);
      IF TG_OP = 'UPDATE' THEN v_changed := array_append(v_changed, v_col); END IF;
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' AND cardinality(v_changed) > 0 THEN
    NEW.verification_status := 'pending';
    NEW.is_active := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    SELECT company_name INTO v_name FROM public.delivery_companies WHERE id = NEW.company_id;
    PERFORM public.delivery_audit_write(NEW.company_id, NEW.id, v_name, 'driver', 'driver_documents_updated',
      OLD.verification_status, NEW.verification_status, NULL, NULL, NULL, 'owner',
      jsonb_build_object('driver', NEW.full_name, 'changed', to_jsonb(v_changed)));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_driver_back_sides() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_driver_verification_back_sides ON public.delivery_drivers;
CREATE TRIGGER trg_guard_delivery_driver_verification_back_sides
  BEFORE INSERT OR UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_driver_back_sides();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. RPC : inscription et resoumission (mêmes signatures, verso et localisation en plus)
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
  IF COALESCE(NULLIF(_d ->> 'id_type', ''), 'cni') <> 'passport' AND COALESCE(_d ->> 'national_id_back_photo_url', '') = '' THEN
    RAISE EXCEPTION '% : le verso de la pièce d''identité est requis.', _label USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_d ->> 'license_back_photo_url', '') = '' THEN
    RAISE EXCEPTION '% : le verso du permis de conduire est requis.', _label USING ERRCODE = '22023';
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

-- Coordonnées lues dans le JSON de la structure : (latitude, longitude) ou NULL ; refuse les valeurs hors limites.
CREATE OR REPLACE FUNCTION public.delivery_parse_location(_company jsonb, OUT lat double precision, OUT lng double precision)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  lat := NULL; lng := NULL;
  IF NULLIF(_company ->> 'warehouse_latitude', '') IS NULL AND NULLIF(_company ->> 'warehouse_longitude', '') IS NULL THEN
    RETURN;
  END IF;
  IF NULLIF(_company ->> 'warehouse_latitude', '') IS NULL OR NULLIF(_company ->> 'warehouse_longitude', '') IS NULL THEN
    RAISE EXCEPTION 'Localisation de l''entrepôt incomplète : latitude et longitude sont toutes deux requises.' USING ERRCODE = '22023';
  END IF;
  lat := (_company ->> 'warehouse_latitude')::double precision;
  lng := (_company ->> 'warehouse_longitude')::double precision;
  IF lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 OR (lat = 0 AND lng = 0) THEN
    RAISE EXCEPTION 'Localisation de l''entrepôt invalide : choisissez un point sur la carte ou utilisez votre position.' USING ERRCODE = '22023';
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
  v_id_type text := COALESCE(NULLIF(p_kyc ->> 'id_type', ''), 'cni');
  v_lat double precision;
  v_lng double precision;
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
  IF v_id_type <> 'passport' AND COALESCE(p_company ->> 'manager_id_back_photo_url', '') = '' THEN
    RAISE EXCEPTION 'Le verso de la pièce d''identité est requis.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_company ->> 'manager_selfie_with_id_url', '') = '' THEN RAISE EXCEPTION 'Le selfie avec la pièce d''identité est requis.' USING ERRCODE = '22023'; END IF;
  IF v_type = 'manager' AND COALESCE(p_company ->> 'warehouse_photo_url', '') = '' THEN
    RAISE EXCEPTION 'La photo de l''entrepôt principal est requise.' USING ERRCODE = '22023';
  END IF;
  SELECT lat, lng INTO v_lat, v_lng FROM public.delivery_parse_location(p_company);
  IF v_type = 'manager' AND v_lat IS NULL THEN
    RAISE EXCEPTION 'La localisation de l''entrepôt est requise : utilisez votre position ou placez le point sur la carte.' USING ERRCODE = '22023';
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
    manager_photo_url, manager_id_photo_url, manager_id_back_photo_url, manager_selfie_with_id_url, owner_photo_url, warehouse_photo_url,
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
    p_company ->> 'manager_id_photo_url', NULLIF(p_company ->> 'manager_id_back_photo_url', ''), p_company ->> 'manager_selfie_with_id_url',
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
  VALUES (v_id, v_id_type, btrim(p_kyc ->> 'id_number'),
          NULLIF(p_kyc ->> 'id_expiry', '')::date, (p_kyc ->> 'date_of_birth')::date);

  IF v_lat IS NOT NULL THEN
    INSERT INTO public.delivery_company_location (company_id, latitude, longitude, accuracy_m, source)
    VALUES (v_id, v_lat, v_lng, round(NULLIF(p_company ->> 'warehouse_accuracy_m', '')::numeric)::int,
            COALESCE(NULLIF(p_company ->> 'warehouse_location_source', ''), 'map'));
  END IF;

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
      photo_url, national_id_photo_url, national_id_back_photo_url, license_photo_url, license_back_photo_url, selfie_with_id_url)
    VALUES (
      v_id, btrim((d ->> 'first_name') || ' ' || (d ->> 'last_name')), btrim(d ->> 'first_name'), btrim(d ->> 'last_name'),
      (d ->> 'date_of_birth')::date, d ->> 'phone', NULLIF(d ->> 'whatsapp', ''), COALESCE(d ->> 'vehicle_type', 'motorcycle'),
      NULLIF(btrim(d ->> 'vehicle_license_plate'), ''), COALESCE(NULLIF(d ->> 'id_type', ''), 'cni'),
      NULLIF(btrim(d ->> 'id_number'), ''), NULLIF(d ->> 'id_expiry', '')::date, btrim(d ->> 'license_number'),
      ARRAY(SELECT upper(btrim(c)) FROM jsonb_array_elements_text(COALESCE(d -> 'license_categories', '[]'::jsonb)) c),
      NULLIF(d ->> 'license_expiry', '')::date,
      COALESCE(NULLIF(d ->> 'photo_url', ''), d ->> 'selfie_with_id_url'), d ->> 'national_id_photo_url',
      NULLIF(d ->> 'national_id_back_photo_url', ''), d ->> 'license_photo_url', NULLIF(d ->> 'license_back_photo_url', ''),
      d ->> 'selfie_with_id_url');
  END LOOP;

  RETURN v_id;
END;
$$;

-- Resoumission : met à jour pièces et informations manquantes, puis remet le dossier en file d'attente. Le dossier
-- résultant doit être approuvable sur le plan documentaire (verso et localisation), sinon la resoumission est refusée.
CREATE OR REPLACE FUNCTION public.resubmit_delivery_application(
  p_company_id uuid, p_company jsonb DEFAULT '{}'::jsonb, p_kyc jsonb DEFAULT '{}'::jsonb, p_drivers jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_profile text;
  v_back text;
  v_id_type text;
  v_lat double precision;
  v_lng double precision;
  d jsonb;
  v_drv public.delivery_drivers%ROWTYPE;
  v_n int := 0;
BEGIN
  SELECT verification_status::text, profile_type, manager_id_back_photo_url INTO v_status, v_profile, v_back
    FROM public.delivery_companies WHERE id = p_company_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable.' USING ERRCODE = '42501'; END IF;
  IF v_status IN ('approved', 'suspended') THEN
    RAISE EXCEPTION 'Ce dossier ne peut pas être resoumis dans son état actuel (%).', v_status USING ERRCODE = '42501';
  END IF;

  v_id_type := COALESCE(NULLIF(p_kyc ->> 'id_type', ''), (SELECT id_type FROM public.delivery_company_kyc WHERE company_id = p_company_id), 'cni');
  v_back := COALESCE(NULLIF(p_company ->> 'manager_id_back_photo_url', ''), v_back);
  IF v_id_type <> 'passport' AND COALESCE(v_back, '') = '' THEN
    RAISE EXCEPTION 'Le verso de la pièce d''identité est requis.' USING ERRCODE = '22023';
  END IF;
  SELECT lat, lng INTO v_lat, v_lng FROM public.delivery_parse_location(p_company);
  IF v_profile = 'manager' AND v_lat IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.delivery_company_location WHERE company_id = p_company_id) THEN
    RAISE EXCEPTION 'La localisation de l''entrepôt est requise : utilisez votre position ou placez le point sur la carte.' USING ERRCODE = '22023';
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
        'id_type', COALESCE(NULLIF(d ->> 'id_type', ''), v_drv.id_type, 'cni'),
        'national_id_photo_url', COALESCE(d ->> 'national_id_photo_url', v_drv.national_id_photo_url),
        'national_id_back_photo_url', COALESCE(NULLIF(d ->> 'national_id_back_photo_url', ''), v_drv.national_id_back_photo_url),
        'license_photo_url', COALESCE(d ->> 'license_photo_url', v_drv.license_photo_url),
        'license_back_photo_url', COALESCE(NULLIF(d ->> 'license_back_photo_url', ''), v_drv.license_back_photo_url),
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
      national_id_back_photo_url = COALESCE(NULLIF(d ->> 'national_id_back_photo_url', ''), national_id_back_photo_url),
      license_photo_url = COALESCE(NULLIF(d ->> 'license_photo_url', ''), license_photo_url),
      license_back_photo_url = COALESCE(NULLIF(d ->> 'license_back_photo_url', ''), license_back_photo_url),
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

  IF v_lat IS NOT NULL THEN
    INSERT INTO public.delivery_company_location (company_id, latitude, longitude, accuracy_m, source)
    VALUES (p_company_id, v_lat, v_lng, round(NULLIF(p_company ->> 'warehouse_accuracy_m', '')::numeric)::int,
            COALESCE(NULLIF(p_company ->> 'warehouse_location_source', ''), 'map'))
    ON CONFLICT (company_id) DO UPDATE
      SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
          accuracy_m = EXCLUDED.accuracy_m, source = EXCLUDED.source;
  END IF;

  UPDATE public.delivery_companies SET
    manager_photo_url = COALESCE(NULLIF(p_company ->> 'manager_photo_url', ''), manager_photo_url),
    manager_id_photo_url = COALESCE(NULLIF(p_company ->> 'manager_id_photo_url', ''), manager_id_photo_url),
    manager_id_back_photo_url = COALESCE(NULLIF(p_company ->> 'manager_id_back_photo_url', ''), manager_id_back_photo_url),
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

REVOKE ALL ON FUNCTION public.delivery_parse_location(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_parse_location(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_delivery_application(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resubmit_delivery_application(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_validate_driver_json(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_delivery_application(jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_delivery_application(uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_validate_driver_json(jsonb, text) TO authenticated;
