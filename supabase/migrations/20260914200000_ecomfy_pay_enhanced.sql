-- ========================================================
-- ECOMFY PAY — ENHANCEMENTS (PAYOUT CONFIG, SANDBOX MODE, STRICT KYC)
-- ========================================================

-- 1. MODIFICATION TABLE WALLETS (CONFIG RETRAIT PAR DÉFAUT)
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS default_payout_phone TEXT,
ADD COLUMN IF NOT EXISTS default_payout_name TEXT,
ADD COLUMN IF NOT EXISTS default_payout_provider TEXT DEFAULT 'wave';

-- 2. MODIFICATION PAYMENT_LINKS & PAYMENTS (MODE SANDBOX vs PRODUCTION)
ALTER TABLE public.ecomfy_payment_links
ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.ecomfy_payments
ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. MODIFICATION MERCHANT_KYC (DÉTAILS SÉCURITÉ ET AI INSPECTION)
ALTER TABLE public.merchant_kyc
ADD COLUMN IF NOT EXISTS ocr_extracted_name TEXT,
ADD COLUMN IF NOT EXISTS face_match_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS face_match_passed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS doc_type_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 4. FONCTION RPC : ENREGISTRER CONFIGURATION DE RETRAIT PAR DÉFAUT
-- Le marchand est l'appelant authentifié (auth.uid()) : aucun p_merchant_id en paramètre (audit C1).
CREATE OR REPLACE FUNCTION public.save_merchant_payout_config(
    p_payout_phone TEXT,
    p_payout_name TEXT,
    p_payout_provider TEXT DEFAULT 'wave'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    p_merchant_id UUID := auth.uid();
    v_wallet public.wallets;
BEGIN
    IF p_merchant_id IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    v_wallet := public.get_or_create_merchant_wallet(p_merchant_id);
    
    UPDATE public.wallets
    SET default_payout_phone = p_payout_phone,
        default_payout_name = p_payout_name,
        default_payout_provider = p_payout_provider,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
    
    RETURN jsonb_build_object(
        'success', true,
        'default_payout_phone', v_wallet.default_payout_phone,
        'default_payout_name', v_wallet.default_payout_name,
        'default_payout_provider', v_wallet.default_payout_provider
    );
END;
$$;

-- Réservée aux marchands connectés (anon n'a aucun droit).
REVOKE ALL ON FUNCTION public.save_merchant_payout_config(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_merchant_payout_config(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3b. VERROUILLAGE DES COLONNES DE DÉCISION KYC (audit C4)
-- Le marchand dépose et corrige son dossier mais ne décide jamais de son statut : toute écriture de ces colonnes
-- depuis un rôle API (anon / authenticated) est ignorée. Seuls service_role, le propriétaire et
-- review_merchant_kyc() (ci-dessous) peuvent les modifier.
CREATE OR REPLACE FUNCTION public.merchant_kyc_guard_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Fonction volontairement NON "SECURITY DEFINER" : current_user reste le rôle de la session
    -- (anon / authenticated pour l'API, service_role ou propriétaire pour les accès serveur).
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.verification_status := 'PENDING';
        NEW.rejection_reason := NULL;
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
        NEW.face_match_score := NULL;
        NEW.face_match_passed := FALSE;
        NEW.doc_type_validated := FALSE;
        NEW.ocr_extracted_name := NULL;
        NEW.verification_notes := NULL;
        RETURN NEW;
    END IF;

    -- UPDATE : les colonnes de décision gardent leur valeur.
    NEW.verification_status := OLD.verification_status;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.face_match_score := OLD.face_match_score;
    NEW.face_match_passed := OLD.face_match_passed;
    NEW.doc_type_validated := OLD.doc_type_validated;
    NEW.ocr_extracted_name := OLD.ocr_extracted_name;
    NEW.verification_notes := OLD.verification_notes;
    NEW.user_id := OLD.user_id;

    -- Changer une pièce ou une identité déjà vérifiée annule la vérification : nouvelle revue obligatoire.
    IF OLD.verification_status IN ('VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED')
       AND (NEW.full_name, NEW.document_type, NEW.document_number, NEW.document_front_url,
            NEW.document_back_url, NEW.selfie_url)
           IS DISTINCT FROM
           (OLD.full_name, OLD.document_type, OLD.document_number, OLD.document_front_url,
            OLD.document_back_url, OLD.selfie_url) THEN
        NEW.verification_status := 'PENDING';
        NEW.rejection_reason := NULL;
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_kyc_guard_review_columns ON public.merchant_kyc;
CREATE TRIGGER merchant_kyc_guard_review_columns
    BEFORE INSERT OR UPDATE ON public.merchant_kyc
    FOR EACH ROW EXECUTE FUNCTION public.merchant_kyc_guard_review_columns();

-- 5. FONCTION RPC : REVUE MANUELLE DU KYC (audit C4)
-- Remplace l'ancienne evaluate_merchant_kyc_security, qui passait tout le monde en VERIFIED avec un score de visage
-- codé en dur. Aucune analyse automatique n'existe : la décision est humaine (fondateur / co-fondateur) ou vient
-- d'un prestataire KYC branché plus tard côté serveur avec service_role.
DO $$
DECLARE
    f record;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'evaluate_merchant_kyc_security'
    LOOP
        EXECUTE 'DROP FUNCTION ' || f.sig;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_merchant_kyc(
    p_user_id UUID,
    p_decision TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reviewer UUID := auth.uid();
    v_kyc public.merchant_kyc;
BEGIN
    IF NOT (auth.role() = 'service_role' OR public.is_corporate_founder()) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_reviewer IS NOT NULL AND v_reviewer = p_user_id THEN
        RAISE EXCEPTION 'Un relecteur ne peut pas valider son propre dossier.' USING ERRCODE = '42501';
    END IF;

    IF p_decision NOT IN ('VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED', 'UNDER_REVIEW') THEN
        RAISE EXCEPTION 'Décision invalide : %', p_decision USING ERRCODE = '22023';
    END IF;

    IF p_decision IN ('REJECTED', 'RESUBMISSION_REQUIRED') AND COALESCE(TRIM(p_reason), '') = '' THEN
        RAISE EXCEPTION 'Un motif est obligatoire pour un rejet.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.merchant_kyc
    SET verification_status = p_decision,
        rejection_reason = CASE WHEN p_decision IN ('REJECTED', 'RESUBMISSION_REQUIRED') THEN p_reason ELSE NULL END,
        verified_at = CASE WHEN p_decision = 'VERIFIED' THEN NOW() ELSE NULL END,
        verified_by = CASE WHEN p_decision = 'VERIFIED' THEN v_reviewer ELSE NULL END,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_kyc;

    IF v_kyc.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dossier KYC introuvable.');
    END IF;

    RETURN jsonb_build_object('success', true, 'kyc_id', v_kyc.id, 'status', v_kyc.verification_status);
END;
$$;

REVOKE ALL ON FUNCTION public.review_merchant_kyc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_merchant_kyc(UUID, TEXT, TEXT) TO authenticated, service_role;
