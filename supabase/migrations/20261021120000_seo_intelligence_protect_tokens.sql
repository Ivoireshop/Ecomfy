-- Migration: 20261021120000_seo_intelligence_protect_tokens.sql
-- Description: SEO Intelligence — isolation par boutique autonome, jetons Google OAuth illisibles depuis le
--              navigateur, caches Search Console réécrivables sans doublons.
-- Prérequis : 20260902120000_ecomfy_seo_intelligence.sql (tables). Ne dépend PAS de 20260902140000, dont les
--             politiques s'appuient sur des colonnes inexistantes (profiles.role / profiles.is_admin).
--
-- Avant ce correctif, la politique RLS (FOR ALL) laissait un propriétaire de boutique lire
-- google_refresh_token / google_access_token via l'API REST : un script injecté (XSS) pouvait donc les
-- exfiltrer. Seul le service role (Edge Functions gsc-oauth-flow / gsc-analytics) doit les manipuler.

-- 1. Isolation par boutique : propriétaire, collaborateur actif ou administrateur (user_roles).
--    SECURITY DEFINER avec search_path figé, sinon un schéma malveillant pourrait masquer public.*.
CREATE OR REPLACE FUNCTION public.is_shop_owner_or_collaborator(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = target_shop_id AND s.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.shop_collaborators sc
    WHERE sc.shop_id = target_shop_id AND sc.user_id = auth.uid() AND sc.status = 'active'
  ) OR public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_shop_owner_or_collaborator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_owner_or_collaborator(UUID) TO authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shop_seo_settings', 'shop_seo_connections', 'shop_seo_audits',
    'shop_seo_queries_cache', 'shop_seo_pages_cache', 'shop_seo_history'
  ] LOOP
    -- anciennes politiques (migration 20260902120000) et éventuelles politiques d'isolation déjà posées
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can manage their SEO settings" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can manage their SEO connections" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can read and create their SEO audits" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can manage their queries cache" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can manage their pages cache" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shop owners can view their SEO history" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Tenant isolation %s" ON public.%I FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id)) WITH CHECK (public.is_shop_owner_or_collaborator(shop_id))',
      t, t
    );
  END LOOP;
END $$;

-- 2. Jetons Google : lecture limitée aux colonnes non sensibles
REVOKE SELECT ON public.shop_seo_connections FROM anon, authenticated;
GRANT SELECT (
  id, shop_id, gsc_connected, gsc_property_id, gsc_property_type,
  last_synced_at, sync_status, sync_error, created_at, updated_at
) ON public.shop_seo_connections TO authenticated;

-- 3. Écriture réservée au service role (flux OAuth côté serveur). La suppression (déconnexion) reste permise par la RLS.
REVOKE INSERT, UPDATE ON public.shop_seo_connections FROM anon, authenticated;

-- 4. Une ligne par requête / page / période, pour permettre un upsert à chaque synchronisation
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_seo_queries_cache_key
  ON public.shop_seo_queries_cache (shop_id, period, query);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_seo_pages_cache_key
  ON public.shop_seo_pages_cache (shop_id, period, page_url);
