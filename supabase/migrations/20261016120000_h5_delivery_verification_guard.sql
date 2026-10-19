-- H5 : un propriétaire de structure de livraison ne doit pas pouvoir se valider lui-même.
-- La politique « Owners can update own delivery company » n'a pas de restriction de colonnes :
-- sans ce garde-fou, `verification_status` / `trust_badge_active` restent modifiables en direct,
-- ce qui contourne le contrôle de rôle de l'Edge Function verify-delivery-identity.
--
-- Règles pour un appelant authentifié (auth.uid() non nul) qui n'est ni admin, ni founder, ni co_founder :
--   * à l'INSERT, la ligne est forcée en 'pending_verification', sans badge ;
--   * à l'UPDATE, trust_badge_active, verified_at, verified_by, rejection_reason, admin_notes : immuables ;
--   * verification_status : seule la transition vers 'pending_verification' (resoumission) est permise,
--     et jamais depuis 'approved'.
-- Les appels sans JWT utilisateur (clé de service, SQL direct, Edge Functions) ne sont pas bridés.

CREATE OR REPLACE FUNCTION public.guard_delivery_company_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'founder'::app_role)
     OR public.has_role(auth.uid(), 'co_founder'::app_role) THEN
    RETURN NEW;
  END IF;

  -- INSERT (la politique d'insertion est ouverte à tout utilisateur connecté) : toute demande démarre en attente.
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending_verification';
    NEW.trust_badge_active := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.admin_notes := NULL;
    RETURN NEW;
  END IF;

  IF NEW.trust_badge_active IS DISTINCT FROM OLD.trust_badge_active
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Les champs de vérification sont réservés aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT (NEW.verification_status = 'pending_verification' AND OLD.verification_status <> 'approved') THEN
    RAISE EXCEPTION 'Le statut de vérification est réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_delivery_company_verification() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_company_verification ON public.delivery_companies;
CREATE TRIGGER trg_guard_delivery_company_verification
  BEFORE INSERT OR UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_verification();
