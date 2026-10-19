-- Audit H1 : pièces d'identité KYC dans un bucket privé.
--
-- Constat : les dossiers KYC (recto, verso, selfie avec la pièce) étaient déposés dans le bucket PUBLIC
-- shop-images, sous kyc/..., et stockés dans merchant_kyc sous forme d'URL publique. Quiconque connaît l'URL lit la
-- pièce d'identité, sans compte.
--
-- Correctif :
--   * bucket privé kyc-documents (images uniquement, 5 Mo maximum) ;
--   * chemin imposé : <user_id>/<fichier> ; le marchand dépose et relit uniquement dans son dossier ;
--   * les fondateurs / co-fondateurs (is_corporate_founder()) lisent tout, pour l'écran de revue ;
--   * ni UPDATE ni DELETE pour les rôles API : une pièce déposée ne se remplace pas, elle s'ajoute (un nouveau
--     fichier, un nouveau chemin) ; la purge passe par service_role ;
--   * merchant_kyc.document_front_url / document_back_url / selfie_url contiennent désormais le CHEMIN dans le bucket
--     (et plus une URL) ; le front obtient des liens signés de courte durée. Le trigger ci-dessous refuse qu'un
--     marchand écrive autre chose qu'un chemin de son propre dossier (pas d'URL externe, pas de fichier d'autrui).
--
-- Les fichiers déjà présents dans shop-images/kyc/ ne sont PAS déplacés par ce script (le stockage physique ne se
-- déplace pas par SQL) : voir scripts/migrate-kyc-to-private-bucket.mjs.
-- Prérequis : table merchant_kyc (20260914190000), public.is_corporate_founder() (hotfix 20261012120000). Idempotent.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents', 'kyc-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "kyc_documents_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "kyc_documents_founders_select" ON storage.objects;

CREATE POLICY "kyc_documents_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_documents_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_documents_founders_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND public.is_corporate_founder()
  );

-- Chemins de pièces : un marchand ne peut écrire que <son user_id>/<fichier>. Les valeurs inchangées d'un ancien
-- dossier (URL publique héritée) restent tolérées tant qu'il ne les modifie pas ; service_role et le propriétaire
-- (scripts de migration, review_merchant_kyc) ne sont pas concernés.
CREATE OR REPLACE FUNCTION public.merchant_kyc_guard_document_paths()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_col text;
    v_new text;
    v_old text;
    v_uid uuid;
BEGIN
    -- Volontairement NON "SECURITY DEFINER" (comme merchant_kyc_guard_review_columns) : current_user reste le rôle de la session.
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_uid := OLD.user_id;
    ELSE
        v_uid := NEW.user_id;
    END IF;

    FOREACH v_col IN ARRAY ARRAY['document_front_url', 'document_back_url', 'selfie_url'] LOOP
        v_new := to_jsonb(NEW) ->> v_col;
        IF v_new IS NULL OR v_new = '' THEN
            CONTINUE;
        END IF;
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD) ->> v_col;
            IF v_new IS NOT DISTINCT FROM v_old THEN
                CONTINUE;
            END IF;
        END IF;
        IF left(v_new, length(v_uid::text) + 1) <> v_uid::text || '/'
           OR position('..' in v_new) > 0
           OR length(v_new) > 300 THEN
            RAISE EXCEPTION 'Chemin de pièce KYC invalide (%)', v_col USING ERRCODE = '22023';
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_kyc_guard_document_paths ON public.merchant_kyc;
CREATE TRIGGER merchant_kyc_guard_document_paths
    BEFORE INSERT OR UPDATE ON public.merchant_kyc
    FOR EACH ROW EXECUTE FUNCTION public.merchant_kyc_guard_document_paths();
