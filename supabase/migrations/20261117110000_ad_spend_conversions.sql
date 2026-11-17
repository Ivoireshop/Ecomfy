-- Migration: 20261117110000_ad_spend_conversions.sql
-- Description: Connect Ads — conversions Meta (achats attribués, valeur, impressions, clics) à côté des dépenses,
--              et dépenses publicitaires non modifiables depuis le navigateur.
--
-- Les colonnes sont NULL tant que la ligne n'a pas été resynchronisée : « inconnu » n'est pas « zéro achat ».
-- Avant : la politique INSERT/UPDATE de ad_spend_daily laissait le propriétaire écrire ses propres dépenses via l'API
--         REST (chiffres publicitaires falsifiables). Seule l'Edge Function sync-ad-spend (service role) les écrit.

ALTER TABLE public.ad_spend_daily
  ADD COLUMN IF NOT EXISTS purchases      integer,
  ADD COLUMN IF NOT EXISTS purchase_value numeric,
  ADD COLUMN IF NOT EXISTS impressions    bigint,
  ADD COLUMN IF NOT EXISTS clicks         bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_spend_daily_conversions_nonneg') THEN
    ALTER TABLE public.ad_spend_daily
      ADD CONSTRAINT ad_spend_daily_conversions_nonneg
      CHECK (coalesce(purchases, 0) >= 0 AND coalesce(purchase_value, 0) >= 0
             AND coalesce(impressions, 0) >= 0 AND coalesce(clicks, 0) >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.ad_spend_daily.purchases IS
  'Achats attribués aux publicités par Meta (API Insights), pas le nombre d''événements CAPI reçus. NULL = non synchronisé.';
COMMENT ON COLUMN public.ad_spend_daily.purchase_value IS
  'Valeur des achats attribués par Meta, dans la devise du compte publicitaire (colonne currency). NULL = non synchronisé.';

DROP POLICY IF EXISTS "Service inserts ad_spend_daily" ON public.ad_spend_daily;
DROP POLICY IF EXISTS "Service updates ad_spend_daily" ON public.ad_spend_daily;
REVOKE INSERT, UPDATE, DELETE ON public.ad_spend_daily FROM anon, authenticated;
