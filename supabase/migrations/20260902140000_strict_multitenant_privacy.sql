-- Migration: 20260902140000_strict_multitenant_privacy.sql
-- Description: Enforce strict multi-tenant isolation and role-based access security for Governance, Corporate Cap Table, and SEO Intelligence.

-- ====================================================================
-- 1. SECURING CORPORATE GOVERNANCE & FINANCIAL DATA (STRICT PRIVACY)
-- ====================================================================

-- Function to check if current user is an authorized Corporate Shareholder or Admin
CREATE OR REPLACE FUNCTION public.is_authorized_corporate_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_shareholders sh
    WHERE sh.user_id = auth.uid()
       OR LOWER(sh.email) = LOWER(auth.jwt() ->> 'email')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_admin = true)
  ) OR (
    LOWER(auth.jwt() ->> 'email') = 'djateulrich@gmail.com'
  );
$$;

-- Revoke loose public policies on Corporate Governance tables
DROP POLICY IF EXISTS "Allow read corporate_companies" ON public.corporate_companies;
DROP POLICY IF EXISTS "Allow read corporate_shareholders" ON public.corporate_shareholders;
DROP POLICY IF EXISTS "Allow read corporate_share_allocations" ON public.corporate_share_allocations;
DROP POLICY IF EXISTS "Allow read corporate_vesting_plans" ON public.corporate_vesting_plans;
DROP POLICY IF EXISTS "Allow read corporate_documents" ON public.corporate_documents;
DROP POLICY IF EXISTS "Allow read corporate_proposals" ON public.corporate_proposals;

DROP POLICY IF EXISTS "Allow write corporate_companies" ON public.corporate_companies;
DROP POLICY IF EXISTS "Allow write corporate_shareholders" ON public.corporate_shareholders;
DROP POLICY IF EXISTS "Allow write corporate_share_allocations" ON public.corporate_share_allocations;
DROP POLICY IF EXISTS "Allow write corporate_vesting_plans" ON public.corporate_vesting_plans;
DROP POLICY IF EXISTS "Allow write corporate_documents" ON public.corporate_documents;
DROP POLICY IF EXISTS "Allow write corporate_proposals" ON public.corporate_proposals;

-- Re-enable RLS on all Corporate Governance tables
ALTER TABLE public.corporate_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_vesting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_proposals ENABLE ROW LEVEL SECURITY;

-- Strict Corporate Policies
CREATE POLICY "Strict read corporate_companies" ON public.corporate_companies
  FOR SELECT USING (public.is_authorized_corporate_member());

CREATE POLICY "Strict read corporate_shareholders" ON public.corporate_shareholders
  FOR SELECT USING (public.is_authorized_corporate_member());

CREATE POLICY "Strict read corporate_share_allocations" ON public.corporate_share_allocations
  FOR SELECT USING (public.is_authorized_corporate_member());

CREATE POLICY "Strict read corporate_vesting_plans" ON public.corporate_vesting_plans
  FOR SELECT USING (public.is_authorized_corporate_member());

CREATE POLICY "Strict read corporate_documents" ON public.corporate_documents
  FOR SELECT USING (public.is_authorized_corporate_member());

CREATE POLICY "Strict read corporate_proposals" ON public.corporate_proposals
  FOR SELECT USING (public.is_authorized_corporate_member());

-- Only main founder / admin can write/modify corporate governance & cap table
CREATE POLICY "Founder write corporate_shareholders" ON public.corporate_shareholders
  FOR ALL USING (
    LOWER(auth.jwt() ->> 'email') = 'djateulrich@gmail.com'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Founder write corporate_share_allocations" ON public.corporate_share_allocations
  FOR ALL USING (
    LOWER(auth.jwt() ->> 'email') = 'djateulrich@gmail.com'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Founder write corporate_vesting_plans" ON public.corporate_vesting_plans
  FOR ALL USING (
    LOWER(auth.jwt() ->> 'email') = 'djateulrich@gmail.com'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Founder write corporate_documents" ON public.corporate_documents
  FOR ALL USING (
    LOWER(auth.jwt() ->> 'email') = 'djateulrich@gmail.com'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- ====================================================================
-- 2. MULTI-TENANT SHOP ISOLATION FOR SEO INTELLIGENCE
-- ====================================================================

-- Function to verify if user owns or collaborates on a specific shop
CREATE OR REPLACE FUNCTION public.is_shop_owner_or_collaborator(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = target_shop_id
      AND s.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.shop_collaborators sc
    WHERE sc.shop_id = target_shop_id
      AND sc.user_id = auth.uid()
      AND sc.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_admin = true)
  );
$$;

-- Enforce strict shop isolation on SEO Intelligence tables
DROP POLICY IF EXISTS "Shop owners can manage their SEO settings" ON public.shop_seo_settings;
DROP POLICY IF EXISTS "Shop owners can manage their SEO connections" ON public.shop_seo_connections;
DROP POLICY IF EXISTS "Shop owners can read and create their SEO audits" ON public.shop_seo_audits;
DROP POLICY IF EXISTS "Shop owners can manage their queries cache" ON public.shop_seo_queries_cache;
DROP POLICY IF EXISTS "Shop owners can manage their pages cache" ON public.shop_seo_pages_cache;
DROP POLICY IF EXISTS "Shop owners can view their SEO history" ON public.shop_seo_history;

CREATE POLICY "Tenant isolation shop_seo_settings" ON public.shop_seo_settings
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

CREATE POLICY "Tenant isolation shop_seo_connections" ON public.shop_seo_connections
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

CREATE POLICY "Tenant isolation shop_seo_audits" ON public.shop_seo_audits
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

CREATE POLICY "Tenant isolation shop_seo_queries_cache" ON public.shop_seo_queries_cache
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

CREATE POLICY "Tenant isolation shop_seo_pages_cache" ON public.shop_seo_pages_cache
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

CREATE POLICY "Tenant isolation shop_seo_history" ON public.shop_seo_history
  FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));
