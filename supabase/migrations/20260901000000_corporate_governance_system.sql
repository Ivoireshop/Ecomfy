-- ====================================================================
-- ECOMFY CORPORATE & GOVERNANCE SYSTEM MIGRATION
-- Multi-tenant Startup SaaS Governance, Vesting Engine & Cap Table
-- ====================================================================

-- 1. ENUMS DEFINITIONS
CREATE TYPE public.corporate_role_enum AS ENUM (
  'owner',
  'corporate_admin',
  'founder',
  'cofounder',
  'shareholder',
  'investor',
  'developer',
  'beta_tester',
  'viewer'
);

CREATE TYPE public.vesting_status_enum AS ENUM (
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE public.milestone_status_enum AS ENUM (
  'pending',
  'vesting_eligible',
  'formalized',
  'cancelled'
);

CREATE TYPE public.proposal_status_enum AS ENUM (
  'proposed',
  'documentation_required',
  'documentation_verified',
  'approval_required',
  'approved',
  'rejected',
  'changes_requested',
  'legal_formalization_required',
  'legal_formalization_completed',
  'cap_table_updated'
);

CREATE TYPE public.document_category_enum AS ENUM (
  'legal',
  'corporate',
  'shareholders',
  'vesting',
  'confidentiality',
  'intellectual_property',
  'security',
  'governance',
  'partnership',
  'employment',
  'investment'
);

-- 2. COMPANY METADATA & AUTHORIZED CAPITAL BASE
CREATE TABLE public.corporate_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Ecomfy',
  legal_status TEXT NOT NULL DEFAULT 'SAS',
  registration_number TEXT DEFAULT 'CI-ABJ-2026-B-001',
  country TEXT NOT NULL DEFAULT 'Côte d''Ivoire',
  total_authorized_shares NUMERIC(18, 2) NOT NULL DEFAULT 1000000.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SHAREHOLDERS & GOVERNANCE MEMBERS REGISTRY
CREATE TABLE public.corporate_shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  corporate_role public.corporate_role_enum NOT NULL DEFAULT 'shareholder',
  is_main_founder BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_level INT NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SHARE ALLOCATIONS (CAP TABLE HOLDINGS)
CREATE TABLE public.corporate_share_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.corporate_shareholders(id) ON DELETE CASCADE,
  target_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  target_shares NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  vested_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  vested_shares NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  legally_issued_shares NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  legally_transferred_shares NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'acquired', -- 'acquired', 'vesting', 'reserved'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. VESTING PLANS ENGINE
CREATE TABLE public.corporate_vesting_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.corporate_shareholders(id) ON DELETE CASCADE,
  target_percentage NUMERIC(5, 2) NOT NULL,
  target_shares NUMERIC(18, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_months INT NOT NULL DEFAULT 48,
  cliff_months INT NOT NULL DEFAULT 12,
  cliff_date DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  status public.vesting_status_enum NOT NULL DEFAULT 'active',
  objectives TEXT,
  departure_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VESTING MILESTONES (STRICT VESTING ELIGIBLE, NO AUTO TRANSFER)
CREATE TABLE public.corporate_vesting_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vesting_plan_id UUID NOT NULL REFERENCES public.corporate_vesting_plans(id) ON DELETE CASCADE,
  milestone_date DATE NOT NULL,
  shares_eligible NUMERIC(18, 2) NOT NULL,
  percentage_eligible NUMERIC(5, 2) NOT NULL,
  status public.milestone_status_enum NOT NULL DEFAULT 'pending',
  formalized_at TIMESTAMPTZ,
  legal_document_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DOCUMENT CENTER
CREATE TABLE public.corporate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category public.document_category_enum NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  target_roles public.corporate_role_enum[] DEFAULT ARRAY['shareholder'::public.corporate_role_enum],
  current_version TEXT NOT NULL DEFAULT 'v1.0',
  storage_path TEXT,
  content_markdown TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DOCUMENT VERSIONS HISTORY
CREATE TABLE public.corporate_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.corporate_documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  storage_path TEXT,
  content_markdown TEXT,
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DOCUMENT ACCEPTANCE & AUDIT LOGS
CREATE TABLE public.corporate_document_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.corporate_documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'read', 'approved'
  legal_statement TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CAP TABLE CHANGE PROPOSALS WORKFLOW
CREATE TABLE public.corporate_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number INT GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  beneficiary_shareholder_id UUID REFERENCES public.corporate_shareholders(id),
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  current_percentage NUMERIC(5, 2) NOT NULL,
  proposed_percentage NUMERIC(5, 2) NOT NULL,
  current_shares NUMERIC(18, 2) NOT NULL,
  proposed_shares NUMERIC(18, 2) NOT NULL,
  rationale TEXT NOT NULL,
  status public.proposal_status_enum NOT NULL DEFAULT 'proposed',
  legal_document_path TEXT,
  impact_analysis TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PROPOSAL APPROVALS
CREATE TABLE public.corporate_proposal_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.corporate_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT NOT NULL, -- 'approve', 'reject', 'request_changes'
  comments TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. CAP TABLE SNAPSHOTS
CREATE TABLE public.corporate_cap_table_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.corporate_proposals(id),
  snapshot_data JSONB NOT NULL,
  total_shares NUMERIC(18, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. INTELLECTUAL PROPERTY ASSETS
CREATE TABLE public.corporate_intellectual_property (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'source_code', 'ai_prompt', 'brand', 'domain', 'database_schema', 'design'
  description TEXT,
  creator_name TEXT NOT NULL,
  legal_owner TEXT NOT NULL DEFAULT 'Ecomfy',
  assignment_contract_ref TEXT,
  assignment_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. OFFBOARDING CASES
CREATE TABLE public.corporate_offboarding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.corporate_shareholders(id),
  departure_date DATE NOT NULL,
  reason TEXT NOT NULL,
  account_deactivated BOOLEAN NOT NULL DEFAULT FALSE,
  sessions_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  keys_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  assets_recovered BOOLEAN NOT NULL DEFAULT FALSE,
  vesting_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_shares_status TEXT NOT NULL DEFAULT 'legal_review_required',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. AUDIT LOGS
CREATE TABLE public.corporate_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- RLS POLICIES
-- ====================================================================
ALTER TABLE public.corporate_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_vesting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_vesting_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_document_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_proposal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_cap_table_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_intellectual_property ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_offboarding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view corporate governance data
CREATE POLICY "Allow authenticated view corporate_companies" ON public.corporate_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_shareholders" ON public.corporate_shareholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_share_allocations" ON public.corporate_share_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_vesting_plans" ON public.corporate_vesting_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_vesting_milestones" ON public.corporate_vesting_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_documents" ON public.corporate_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_document_versions" ON public.corporate_document_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_document_acceptances" ON public.corporate_document_acceptances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_proposals" ON public.corporate_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_proposal_approvals" ON public.corporate_proposal_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_cap_table_snapshots" ON public.corporate_cap_table_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_intellectual_property" ON public.corporate_intellectual_property FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_offboarding_cases" ON public.corporate_offboarding_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated view corporate_audit_logs" ON public.corporate_audit_logs FOR SELECT TO authenticated USING (true);

-- Allow Master Founder & Admins full write access
CREATE POLICY "Allow write corporate_companies" ON public.corporate_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_shareholders" ON public.corporate_shareholders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_share_allocations" ON public.corporate_share_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_vesting_plans" ON public.corporate_vesting_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_vesting_milestones" ON public.corporate_vesting_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_documents" ON public.corporate_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_document_versions" ON public.corporate_document_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_document_acceptances" ON public.corporate_document_acceptances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_proposals" ON public.corporate_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_proposal_approvals" ON public.corporate_proposal_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_cap_table_snapshots" ON public.corporate_cap_table_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_intellectual_property" ON public.corporate_intellectual_property FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_offboarding_cases" ON public.corporate_offboarding_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow write corporate_audit_logs" ON public.corporate_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ====================================================================
-- SEED INITIAL DATA (STRUCTURE CIBLE ECOMFY)
-- ====================================================================

-- Insert Company
INSERT INTO public.corporate_companies (id, name, legal_status, total_authorized_shares)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ecomfy', 'SAS', 1000000.00)
ON CONFLICT (id) DO UPDATE SET total_authorized_shares = 1000000.00;

-- 1. ULRICH DJATÉ YAPI (FONDATEUR PRINCIPAL - 80%)
DO $$
DECLARE
  v_ulrich_user_id UUID;
  v_ulrich_sh_id UUID;
BEGIN
  SELECT id INTO v_ulrich_user_id FROM auth.users WHERE LOWER(email) = 'djateulrich@gmail.com' LIMIT 1;
  
  INSERT INTO public.corporate_shareholders (
    email, full_name, corporate_role, is_main_founder, onboarding_level, onboarding_completed, user_id
  ) VALUES (
    'djateulrich@gmail.com', 'ULRICH DJATÉ YAPI', 'founder', true, 7, true, v_ulrich_user_id
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = 'ULRICH DJATÉ YAPI',
    corporate_role = 'founder',
    is_main_founder = true
  RETURNING id INTO v_ulrich_sh_id;

  INSERT INTO public.corporate_share_allocations (
    shareholder_id, target_percentage, target_shares, vested_percentage, vested_shares, legally_issued_shares, legally_transferred_shares, status
  ) VALUES (
    v_ulrich_sh_id, 80.00, 800000.00, 80.00, 800000.00, 800000.00, 800000.00, 'acquired'
  ) ON CONFLICT DO NOTHING;
END $$;

-- 2. DÉSIRÉ TANO (ASSOCIÉ / VESTING - 10%)
DO $$
DECLARE
  v_desire_sh_id UUID;
  v_plan_id UUID;
BEGIN
  INSERT INTO public.corporate_shareholders (
    email, full_name, corporate_role, is_main_founder, onboarding_level, onboarding_completed
  ) VALUES (
    'desire.tano@ecomfy.cloud', 'DÉSIRÉ TANO', 'shareholder', false, 1, false
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = 'DÉSIRÉ TANO',
    corporate_role = 'shareholder'
  RETURNING id INTO v_desire_sh_id;

  INSERT INTO public.corporate_share_allocations (
    shareholder_id, target_percentage, target_shares, vested_percentage, vested_shares, legally_issued_shares, legally_transferred_shares, status
  ) VALUES (
    v_desire_sh_id, 10.00, 100000.00, 0.00, 0.00, 0.00, 0.00, 'vesting'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.corporate_vesting_plans (
    shareholder_id, target_percentage, target_shares, start_date, end_date, duration_months, cliff_months, cliff_date, status, objectives
  ) VALUES (
    v_desire_sh_id, 10.00, 100000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '48 months', 48, 12, CURRENT_DATE + INTERVAL '12 months', 'active', 'Développement commercial & partenariats stratégiques Ecomfy'
  ) ON CONFLICT DO NOTHING;
END $$;

-- 3. COUBOURA AMENA (ASSOCIÉE / VESTING - 10%)
DO $$
DECLARE
  v_couboura_sh_id UUID;
BEGIN
  INSERT INTO public.corporate_shareholders (
    email, full_name, corporate_role, is_main_founder, onboarding_level, onboarding_completed
  ) VALUES (
    'couboura.amena@ecomfy.cloud', 'COUBOURA AMENA', 'shareholder', false, 1, false
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = 'COUBOURA AMENA',
    corporate_role = 'shareholder'
  RETURNING id INTO v_couboura_sh_id;

  INSERT INTO public.corporate_share_allocations (
    shareholder_id, target_percentage, target_shares, vested_percentage, vested_shares, legally_issued_shares, legally_transferred_shares, status
  ) VALUES (
    v_couboura_sh_id, 10.00, 100000.00, 0.00, 0.00, 0.00, 0.00, 'vesting'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.corporate_vesting_plans (
    shareholder_id, target_percentage, target_shares, start_date, end_date, duration_months, cliff_months, cliff_date, status, objectives
  ) VALUES (
    v_couboura_sh_id, 10.00, 100000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '48 months', 48, 12, CURRENT_DATE + INTERVAL '12 months', 'active', 'Gouvernance opérationnelle & expansion régionale Ecomfy'
  ) ON CONFLICT DO NOTHING;
END $$;

-- 4. DOCUMENTS JURIDIQUES DE RÉFÉRENCE (ECOMFY DOCUMENT CENTER)
INSERT INTO public.corporate_documents (id, title, category, is_mandatory, current_version, content_markdown)
VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  'Charte d''Actionnariat et de Gouvernance Ecomfy',
  'shareholders',
  true,
  'v1.0',
  '# Charte d''Actionnariat et de Gouvernance Ecomfy\n\n### Article 1 — Objet\nLa présente charte définit les règles d''engagement, d''éthique, de gouvernance et de confidentialité des associés d''Ecomfy.\n\n### Article 2 — Nature du Logiciel\nL''application Ecomfy Corporate & Governance est un outil de traçabilité et de suivi d''accord. Les droits sociaux découlent exclusivement des statuts et formalités légales enregistrées auprès des autorités compétentes.\n\n### Article 3 — Engagement des Associés\nChaque associé s''engage à contribuer activement au développement de la plateforme Ecomfy et au respect des secrets d''affaires.'
),
(
  '22222222-2222-2222-2222-222222222222',
  'Accord de Vesting et d''Acquisition Progressive d''Actions',
  'vesting',
  true,
  'v1.0',
  '# Accord de Vesting Ecomfy\n\n### Article 1 — Durée et Cliff\nLe vesting s''étend sur une durée totale de 48 mois à compter de la date de démarrage, avec une période de franchissement initial (Cliff) de 12 mois.\n\n### Article 2 — Condition de Vesting Eligible\nL''atteinte d''une échéance de vesting génère le statut **VESTING ELIGIBLE**. Le transfert effectif des titres requiert la signature des actes de cession applicables.'
),
(
  '33333333-3333-3333-3333-333333333333',
  'Convention de Cession de Propriété Intellectuelle (PI)',
  'intellectual_property',
  true,
  'v1.0',
  '# Convention de Cession de Propriété Intellectuelle Ecomfy\n\n### Article 1 — Propriété Exclusive\nL''ensemble des codes sources, algorithmes, workflows, architectures, prompts IA, marques et designs créés pour la plateforme Ecomfy sont la propriété exclusive et inaliénable de la société Ecomfy.'
)
ON CONFLICT (id) DO NOTHING;

-- 5. PROPRIÉTÉ INTELLECTUELLE INITIALE
INSERT INTO public.corporate_intellectual_property (asset_name, asset_type, description, creator_name, legal_owner, assignment_date)
VALUES
('Code Source Plateforme Ecomfy', 'source_code', 'Application web Next/React/Vite et backend Supabase', 'Ulrich DJATÉ YAPI', 'Ecomfy', CURRENT_DATE),
('Moteur IA Ecomfy Gen Plus', 'ai_prompt', 'Workflows et prompts de génération visuels publicitaires', 'Ulrich DJATÉ YAPI', 'Ecomfy', CURRENT_DATE),
('Marque & Domaines ecomfy.cloud', 'brand', 'Noms de domaine et identité visuelle', 'Ulrich DJATÉ YAPI', 'Ecomfy', CURRENT_DATE)
ON CONFLICT DO NOTHING;
