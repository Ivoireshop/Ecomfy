-- Livraison réseau — répertoire des structures (cahier §2) et profil modifiable (cahier §3.2).
--
-- 1. Champs publics de la fiche : description, services, logo, contacts, tous modifiables par le responsable.
-- 2. Verrou sur les compteurs de réputation (note, avis, courses réussies...) : jusqu'ici le propriétaire pouvait
--    les écrire lui-même, ce qui faussait le classement du répertoire.
-- 3. Modification sensible (adresse, ville, pays) d'une structure approuvée : retour en vérification, comme pour
--    les pièces (le badge « vérifiée » suppose une adresse contrôlée sur place). Chaque modification est journalisée.
-- 4. Répertoire : fonctions delivery_directory_search / delivery_directory_get. Elles ne renvoient QUE les champs
--    publics des structures approuvées avec badge (ni identité, ni pièces, ni numéros fiscaux), et ne montrent
--    pas l'adresse d'un livreur indépendant (c'est son domicile).
-- 5. Bucket public « delivery-logos » (2 Mo, images) : dépôt dans son propre dossier seulement.
--
-- Rien n'est supprimé ni renommé : le parcours actuel de choix du livreur n'est pas touché.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Colonnes de la fiche
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.delivery_companies
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS services_info text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS public_email text;

ALTER TABLE public.delivery_companies DROP CONSTRAINT IF EXISTS delivery_companies_profile_lengths;
ALTER TABLE public.delivery_companies
  ADD CONSTRAINT delivery_companies_profile_lengths CHECK (
    char_length(coalesce(description, '')) <= 2000
    AND char_length(coalesce(services_info, '')) <= 1500
    AND char_length(coalesce(public_phone, '')) <= 40
    AND char_length(coalesce(public_email, '')) <= 160
    AND cardinality(covered_cities) <= 60
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_delivery_companies_directory
  ON public.delivery_companies (rating_score DESC, successful_deliveries_count DESC)
  WHERE verification_status = 'approved' AND trust_badge_active;

-- ---------------------------------------------------------------------------------------------------------------
-- 2 et 3. Garde du profil (s'exécute APRÈS les gardes de vérification et de pièces, d'où son nom)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_delivery_company_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed text[];
  v_sensitive text[];
  v_cols constant text[] := ARRAY['company_name', 'headquarters_address', 'city', 'country', 'country_code',
    'covered_cities', 'description', 'services_info', 'logo_url', 'public_phone', 'public_email',
    'manager_phone', 'manager_whatsapp'];
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('ecomfy.delivery_internal', true) = '1'
     OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Réputation : calculée par la plateforme, jamais écrite par la structure.
  IF NEW.rating_score IS DISTINCT FROM OLD.rating_score
     OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
     OR NEW.successful_deliveries_count IS DISTINCT FROM OLD.successful_deliveries_count
     OR NEW.total_dispatches_count IS DISTINCT FROM OLD.total_dispatches_count
     OR NEW.total_drivers_count IS DISTINCT FROM OLD.total_drivers_count
     OR NEW.average_payout_delay_hours IS DISTINCT FROM OLD.average_payout_delay_hours THEN
    RAISE EXCEPTION 'Les indicateurs de performance sont calculés par la plateforme.' USING ERRCODE = '42501';
  END IF;

  -- Logo : un fichier de son propre dossier du bucket public « delivery-logos » (chemin relatif, jamais une URL).
  IF NEW.logo_url IS NOT NULL AND NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    IF left(NEW.logo_url, length(auth.uid()::text) + 1) <> auth.uid()::text || '/'
       OR NEW.logo_url LIKE '%..%' OR NEW.logo_url ~ '^[a-z]+:' THEN
      RAISE EXCEPTION 'Le logo doit être un fichier déposé dans votre dossier.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.public_email IS NOT NULL AND btrim(NEW.public_email) <> ''
     AND NEW.public_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'L''adresse e-mail de contact n''est pas valide.' USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
   WHERE n.key = ANY (v_cols) AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF v_changed IS NULL THEN
    RETURN NEW;
  END IF;

  -- Adresse, ville, pays : l'adresse a été contrôlée sur place, un changement impose une nouvelle vérification.
  v_sensitive := ARRAY(SELECT x FROM unnest(v_changed) x WHERE x IN ('headquarters_address', 'city', 'country', 'country_code'));
  IF OLD.verification_status = 'approved' AND cardinality(v_sensitive) > 0 THEN
    NEW.verification_status := 'pending_verification';
    NEW.trust_badge_active := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_requested_at := now();
  END IF;

  PERFORM public.delivery_audit_write(NEW.id, NULL, NEW.company_name, 'company', 'profile_updated',
    OLD.verification_status::text, NEW.verification_status::text, NULL, NULL, NULL, 'owner',
    jsonb_build_object('changed', to_jsonb(v_changed), 'reverification', NEW.verification_status IS DISTINCT FROM OLD.verification_status));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_company_profile() FROM PUBLIC;

-- Trie après trg_guard_delivery_company_verification et ..._docs : ils valident le statut avant que celui-ci soit remis en attente ici.
DROP TRIGGER IF EXISTS trg_guard_delivery_company_verification_profile ON public.delivery_companies;
CREATE TRIGGER trg_guard_delivery_company_verification_profile
  BEFORE UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_profile();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Répertoire
-- ---------------------------------------------------------------------------------------------------------------
-- Fiche publique d'une structure : la seule projection que les marchands voient.
CREATE OR REPLACE FUNCTION public.delivery_directory_card(c public.delivery_companies)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'profile_type', c.profile_type,
    'company_name', c.company_name,
    'logo_url', c.logo_url,
    'description', c.description,
    'services_info', c.services_info,
    'city', c.city,
    'country', c.country,
    -- Pour un livreur indépendant, l'adresse est son domicile : jamais montrée.
    'address', CASE WHEN c.profile_type = 'driver' THEN NULL ELSE c.headquarters_address END,
    'phone', COALESCE(NULLIF(btrim(c.public_phone), ''), c.manager_phone),
    'whatsapp', c.manager_whatsapp,
    'email', NULLIF(btrim(c.public_email), ''),
    'covered_cities', c.covered_cities,
    'rating_score', c.rating_score,
    'reviews_count', c.reviews_count,
    'successful_deliveries_count', c.successful_deliveries_count,
    'drivers_count', c.total_drivers_count,
    'verified', (c.verification_status = 'approved' AND c.trust_badge_active),
    'verified_at', c.verified_at
  );
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_card(public.delivery_companies) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.delivery_directory_search(
  _query text DEFAULT NULL,
  _city text DEFAULT NULL,
  _profile_type text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(btrim(COALESCE(_query, '')), '');
  v_city text := NULLIF(btrim(COALESCE(_city, '')), '');
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 24), 1), 60);
  v_offset int := GREATEST(COALESCE(_offset, 0), 0);
  v_total int;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;
  IF _profile_type IS NOT NULL AND _profile_type NOT IN ('manager', 'driver') THEN
    RAISE EXCEPTION 'Type de prestataire inconnu.' USING ERRCODE = '22023';
  END IF;

  -- Les caractères joker saisis par l'utilisateur sont littéraux.
  IF v_q IS NOT NULL THEN v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_city IS NOT NULL THEN v_city := '%' || replace(replace(replace(v_city, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;

  WITH matches AS (
    SELECT c.*
      FROM public.delivery_companies c
     WHERE c.verification_status = 'approved'
       AND c.trust_badge_active
       AND (_profile_type IS NULL OR c.profile_type::text = _profile_type)
       AND (v_q IS NULL OR c.company_name ILIKE v_q)
       AND (v_city IS NULL OR c.city ILIKE v_city
            OR EXISTS (SELECT 1 FROM unnest(c.covered_cities) z WHERE z ILIKE v_city))
  ), page AS (
    SELECT m.*
      FROM matches m
     ORDER BY COALESCE(m.rating_score, 0) DESC, m.successful_deliveries_count DESC, m.company_name ASC, m.id ASC
     LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT count(*) FROM matches),
         COALESCE((SELECT jsonb_agg(public.delivery_directory_card(p) ORDER BY COALESCE(p.rating_score, 0) DESC,
                                    p.successful_deliveries_count DESC, p.company_name ASC, p.id ASC) FROM page p), '[]'::jsonb)
    INTO v_total, v_items;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_directory_get(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.delivery_companies
   WHERE id = _company_id AND verification_status = 'approved' AND trust_badge_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Structure introuvable ou non vérifiée.' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.delivery_directory_card(c);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_directory_get(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Bucket public des logos
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-logos', 'delivery-logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
   SET public = true,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "delivery_logos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "delivery_logos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "delivery_logos_owner_delete" ON storage.objects;

CREATE POLICY "delivery_logos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delivery_logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'delivery-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'delivery-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delivery_logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
