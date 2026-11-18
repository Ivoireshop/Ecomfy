-- Migration: 20261117100000_meta_ads_oauth.sql
-- Description: Connect Ads — connexion Meta par OAuth (Business Manager) et jetons publicitaires illisibles
--              depuis le navigateur.
--
-- Avant : le marchand collait un jeton d'accès Meta dans un formulaire ; la ligne ad_accounts était lisible (colonne
--         access_token comprise) et modifiable par le propriétaire via l'API REST. Un script injecté (XSS) pouvait
--         donc exfiltrer le jeton, et n'importe quel jeton, y compris celui d'un autre compte, pouvait être inséré.
-- Après : le jeton est obtenu par OAuth côté serveur (Edge Function meta-ads-oauth), stocké dans une table que ni
--         anon ni authenticated ne peuvent lire, et ad_accounts n'est plus écrite que par le service role.
-- Rétrocompatible : les comptes déjà connectés avec un jeton manuel continuent de se synchroniser.

-- 1. Connexion Meta d'une boutique (un utilisateur Meta autorisé par boutique). Service role uniquement.
CREATE TABLE IF NOT EXISTS public.meta_ads_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,
  meta_user_id     text NOT NULL,
  meta_user_name   text,
  access_token     text NOT NULL,
  token_expires_at timestamptz,
  scopes           text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ads_connections ENABLE ROW LEVEL SECURITY;
-- Aucune politique : RLS active sans politique = aucun accès pour anon / authenticated. Le service role la contourne.
REVOKE ALL ON public.meta_ads_connections FROM anon, authenticated;

COMMENT ON TABLE public.meta_ads_connections IS
  'Jeton OAuth Meta (long-lived) par boutique. Lu et écrit uniquement par l''Edge Function meta-ads-oauth et les fonctions de synchronisation (service role). Ne jamais accorder de droit à authenticated.';

DROP TRIGGER IF EXISTS update_meta_ads_connections_updated_at ON public.meta_ads_connections;
CREATE TRIGGER update_meta_ads_connections_updated_at
  BEFORE UPDATE ON public.meta_ads_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ad_accounts : rattachement à la connexion et au Business Manager
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.meta_ads_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_id text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS connection_method text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_accounts_connection_method_check') THEN
    ALTER TABLE public.ad_accounts
      ADD CONSTRAINT ad_accounts_connection_method_check CHECK (connection_method IN ('manual', 'oauth'));
  END IF;
END $$;

-- Un compte connecté par OAuth n'a pas de jeton propre : il utilise celui de sa connexion.
ALTER TABLE public.ad_accounts ALTER COLUMN access_token DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_connection ON public.ad_accounts (connection_id);

-- 3. Jeton illisible depuis le navigateur : lecture limitée aux colonnes non sensibles
REVOKE SELECT ON public.ad_accounts FROM anon, authenticated;
GRANT SELECT (
  id, shop_id, user_id, provider, account_id, account_label, currency, total_spend,
  last_synced_at, last_sync_status, last_sync_error, is_active, created_at, updated_at,
  token_expires_at, token_expiry_notified_at,
  connection_id, business_id, business_name, connection_method
) ON public.ad_accounts TO authenticated;

-- 4. Écriture réservée au service role (OAuth côté serveur). La suppression (déconnexion d'un compte) reste permise
--    au propriétaire par la RLS.
REVOKE INSERT, UPDATE ON public.ad_accounts FROM anon, authenticated;

COMMENT ON COLUMN public.ad_accounts.access_token IS
  'Jeton manuel hérité (comptes connectés avant le 17/11/2026). Illisible depuis le navigateur ; les nouveaux comptes utilisent meta_ads_connections.access_token.';
