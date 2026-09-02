-- Migration: 20260902120000_ecomfy_seo_intelligence.sql
-- Description: System tables, caches, and RLS policies for Ecomfy SEO Intelligence module.

-- 1. Shop SEO Settings (Pondérations et préférences)
CREATE TABLE IF NOT EXISTS public.shop_seo_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    weight_technical NUMERIC DEFAULT 25.0,
    weight_performance NUMERIC DEFAULT 20.0,
    weight_content NUMERIC DEFAULT 20.0,
    weight_indexability NUMERIC DEFAULT 15.0,
    weight_metadata NUMERIC DEFAULT 10.0,
    weight_mobile NUMERIC DEFAULT 10.0,
    auto_generate_sitemap BOOLEAN DEFAULT TRUE,
    auto_index_on_product_save BOOLEAN DEFAULT TRUE,
    target_keywords TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_shop_seo_settings UNIQUE(shop_id)
);

-- 2. Shop SEO Connections (Google Search Console OAuth & Keys)
CREATE TABLE IF NOT EXISTS public.shop_seo_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    gsc_connected BOOLEAN DEFAULT FALSE,
    gsc_property_id TEXT,
    gsc_property_type TEXT DEFAULT 'sc-domain',
    google_refresh_token TEXT,
    google_access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'idle',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_shop_seo_connection UNIQUE(shop_id)
);

-- 3. Shop SEO Audits (Historique des scans d'audit technique réels)
CREATE TABLE IF NOT EXISTS public.shop_seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    technical_score INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 0,
    content_score INTEGER DEFAULT 0,
    indexability_score INTEGER DEFAULT 0,
    metadata_score INTEGER DEFAULT 0,
    mobile_score INTEGER DEFAULT 0,
    issues_critical INTEGER DEFAULT 0,
    issues_important INTEGER DEFAULT 0,
    issues_optimization INTEGER DEFAULT 0,
    audit_data JSONB DEFAULT '{}'::jsonb,
    scanned_domain TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shop SEO Queries Cache (Stockage des requêtesSearch Console réelles)
CREATE TABLE IF NOT EXISTS public.shop_seo_queries_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- '7d', '28d', '3m', '6m', '12m'
    query TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    position NUMERIC DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Shop SEO Pages Cache (Stockage des pages Search Console réelles)
CREATE TABLE IF NOT EXISTS public.shop_seo_pages_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    page_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    position NUMERIC DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Shop SEO History (Historique journalier des performances)
CREATE TABLE IF NOT EXISTS public.shop_seo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    score INTEGER,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    position NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_shop_seo_history_date UNIQUE(shop_id, record_date)
);

-- RLS Enablement
ALTER TABLE public.shop_seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_seo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_seo_queries_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_seo_pages_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_seo_history ENABLE ROW LEVEL SECURITY;

-- Helper policies (Access limited to shop owners / admins)
CREATE POLICY "Shop owners can manage their SEO settings" ON public.shop_seo_settings
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Shop owners can manage their SEO connections" ON public.shop_seo_connections
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Shop owners can read and create their SEO audits" ON public.shop_seo_audits
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Shop owners can manage their queries cache" ON public.shop_seo_queries_cache
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Shop owners can manage their pages cache" ON public.shop_seo_pages_cache
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Shop owners can view their SEO history" ON public.shop_seo_history
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.shops WHERE id = shop_id)
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

-- Indexation
CREATE INDEX IF NOT EXISTS idx_shop_seo_audits_shop ON public.shop_seo_audits(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_seo_queries_shop_period ON public.shop_seo_queries_cache(shop_id, period);
CREATE INDEX IF NOT EXISTS idx_shop_seo_pages_shop_period ON public.shop_seo_pages_cache(shop_id, period);
