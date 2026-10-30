-- Un propriétaire de fiche de livraison ne doit pas pouvoir se marquer « vérifié » ou « recommandé ».
-- Les politiques « Users can create their own delivery provider » (INSERT) et
-- « Owners can update their delivery provider » (UPDATE) n'ont aucune restriction de colonnes :
-- sans ce garde-fou, is_verified et is_recommended restent modifiables en direct,
-- ce qui affiche un badge « vérifié » trompeur aux marchands (ShopDeliveryPartners).
--
-- Règles pour un appelant authentifié (auth.uid() non nul) qui n'est ni admin, ni founder, ni co_founder :
--   * à l'INSERT, is_verified et is_recommended sont forcés à false ;
--   * à l'UPDATE, is_verified et is_recommended sont immuables.
-- Les appels sans JWT utilisateur (clé de service, SQL direct, Edge Functions) ne sont pas bridés.
-- Idempotente. Contrôle de prod du 30/10/2026 : une seule fiche vérifiée (DLK Services, user_id nul,
-- fiche de la plateforme), aucun abus constaté.

CREATE OR REPLACE FUNCTION public.guard_delivery_provider_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'founder'::app_role)
     OR public.has_role(auth.uid(), 'co_founder'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.is_recommended := false;
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_recommended IS DISTINCT FROM OLD.is_recommended THEN
    RAISE EXCEPTION 'Les champs de vérification sont réservés aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_delivery_provider_verification() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_provider_verification ON public.delivery_providers;
CREATE TRIGGER trg_guard_delivery_provider_verification
  BEFORE INSERT OR UPDATE ON public.delivery_providers
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_provider_verification();
