-- Audit C2 (suite) : apply_shop_activation et prepare_shop_activation_payment ne sont exécutables
-- que par service_role.
--
-- Les migrations d'origine (20260516133834, 20260516161922) font seulement
-- REVOKE ... FROM PUBLIC. Sur Supabase, anon et authenticated reçoivent EXECUTE directement
-- (privilèges par défaut du schéma public) : ce REVOKE ne les retire pas.
-- Appelants légitimes : edge functions (service_role). L'activation manuelle d'un fondateur passe
-- par l'edge function founder-activate-shop.
-- Idempotent ; chaque fonction est protégée par to_regprocedure.

DO $$
BEGIN
  IF to_regprocedure('public.apply_shop_activation(uuid, uuid, numeric, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text)
      TO service_role;
  END IF;

  IF to_regprocedure('public.prepare_shop_activation_payment(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid)
      TO service_role;
  END IF;
END $$;
