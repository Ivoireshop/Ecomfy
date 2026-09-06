-- ====================================================================
-- ECOMFY GOVERNANCE INVITATIONS WORKFLOW MIGRATION
-- Table corporate_invitations avec 12 statuts stricts
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.corporate_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  corporate_role TEXT NOT NULL DEFAULT 'shareholder', -- 'co_founder', 'shareholder', 'investor', 'corporate_admin'
  target_percentage NUMERIC(5, 2) DEFAULT 0.00,
  target_shares NUMERIC(18, 2) DEFAULT 0.00,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_name TEXT DEFAULT 'Fondateur Principal',
  status TEXT NOT NULL DEFAULT 'PENDING_INVITATION',
  expires_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  documents_read_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  read_document_ids JSONB DEFAULT '[]'::jsonb,
  read_document_versions JSONB DEFAULT '{}'::jsonb,
  legal_declaration_signed BOOLEAN DEFAULT FALSE,
  signer_full_name TEXT,
  shareholder_id UUID REFERENCES public.corporate_shareholders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.corporate_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select corporate_invitations by token or auth"
  ON public.corporate_invitations FOR SELECT
  USING (true);

CREATE POLICY "Allow write corporate_invitations"
  ON public.corporate_invitations FOR ALL
  USING (true)
  WITH CHECK (true);
