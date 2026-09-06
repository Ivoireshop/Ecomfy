export type CorporateRole =
  | 'owner'
  | 'corporate_admin'
  | 'founder'
  | 'cofounder'
  | 'shareholder'
  | 'investor'
  | 'developer'
  | 'beta_tester'
  | 'viewer';

export type VestingStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type MilestoneStatus = 'pending' | 'vesting_eligible' | 'formalized' | 'cancelled';

export type ProposalStatus =
  | 'proposed'
  | 'documentation_required'
  | 'documentation_verified'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'legal_formalization_required'
  | 'legal_formalization_completed'
  | 'cap_table_updated';

export type LegalStatus =
  | 'DRAFT'
  | 'INTERNAL POLICY'
  | 'PENDING REVIEW'
  | 'APPROVED INTERNALLY'
  | 'READY FOR LEGAL REVIEW'
  | 'EXECUTED';

export type DocumentCategory =
  | 'legal'
  | 'corporate'
  | 'shareholders'
  | 'vesting'
  | 'confidentiality'
  | 'intellectual_property'
  | 'security'
  | 'governance'
  | 'partnership'
  | 'employment'
  | 'investment';

export interface CorporateCompany {
  id: string;
  name: string;
  legal_status: string;
  registration_number: string;
  country: string;
  total_authorized_shares: number;
  created_at: string;
  updated_at: string;
}

export interface CorporateShareholder {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  corporate_role: CorporateRole;
  is_main_founder: boolean;
  onboarding_level: number;
  onboarding_completed: boolean;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;

  // Joined allocation
  allocation?: CorporateShareAllocation;
  vesting_plan?: CorporateVestingPlan;
}

export interface CorporateShareAllocation {
  id: string;
  shareholder_id: string;
  target_percentage: number;
  target_shares: number;
  vested_percentage: number;
  vested_shares: number;
  legally_issued_shares: number;
  legally_transferred_shares: number;
  status: 'acquired' | 'vesting' | 'reserved';
  created_at: string;
  updated_at: string;
}

export interface CorporateVestingPlan {
  id: string;
  shareholder_id: string;
  target_percentage: number;
  target_shares: number;
  start_date: string;
  end_date: string;
  duration_months: number;
  cliff_months: number;
  cliff_date: string;
  frequency: string;
  status: VestingStatus;
  objectives: string | null;
  departure_terms: string | null;
  created_at: string;
  updated_at: string;
  milestones?: CorporateVestingMilestone[];
}

export interface CorporateVestingMilestone {
  id: string;
  vesting_plan_id: string;
  milestone_date: string;
  shares_eligible: number;
  percentage_eligible: number;
  status: MilestoneStatus;
  formalized_at: string | null;
  legal_document_ref: string | null;
  created_at: string;
}

export interface CorporateDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  legal_status?: LegalStatus;
  summary?: string;
  author?: string;
  is_mandatory: boolean;
  target_roles: CorporateRole[];
  current_version: string;
  storage_path: string | null;
  content_markdown: string | null;
  views_count?: number;
  approvals_count?: number;
  created_at: string;
  updated_at: string;
  user_acceptance?: CorporateDocumentAcceptance | null;
  user_viewed?: boolean;
}

export interface CorporateDocumentAcceptance {
  id: string;
  document_id: string;
  version: string;
  user_id: string;
  email: string;
  action: 'read' | 'approved';
  legal_statement: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface CorporateProposal {
  id: string;
  proposal_number: number;
  title: string;
  beneficiary_shareholder_id: string | null;
  proposed_by: string;
  current_percentage: number;
  proposed_percentage: number;
  current_shares: number;
  proposed_shares: number;
  rationale: string;
  status: ProposalStatus;
  legal_document_path: string | null;
  impact_analysis: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  beneficiary_name?: string;
}

export interface CorporateIPAsset {
  id: string;
  asset_name: string;
  asset_type: 'source_code' | 'ai_prompt' | 'brand' | 'domain' | 'database_schema' | 'design';
  description: string | null;
  creator_name: string;
  legal_owner: string;
  assignment_contract_ref: string | null;
  assignment_date: string | null;
  status: string;
  created_at: string;
}

export interface CorporateAuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_entity: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  timestamp: string;
}

export type GovernanceInvitationStatus =
  | 'PENDING_INVITATION'
  | 'INVITATION_SENT'
  | 'INVITATION_OPENED'
  | 'EMAIL_VERIFIED'
  | 'DOCUMENTS_PENDING'
  | 'DOCUMENTS_READ'
  | 'APPROVAL_PENDING'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export interface CorporateInvitation {
  id: string;
  invite_token: string;
  email: string;
  full_name: string;
  corporate_role: CorporateRole;
  target_percentage: number;
  target_shares: number;
  invited_by?: string | null;
  invited_by_name?: string | null;
  status: GovernanceInvitationStatus;
  expires_at: string;
  opened_at?: string | null;
  email_verified_at?: string | null;
  documents_read_at?: string | null;
  accepted_at?: string | null;
  activated_at?: string | null;
  declined_at?: string | null;
  revoked_at?: string | null;
  read_document_ids?: string[];
  read_document_versions?: Record<string, string>;
  legal_declaration_signed?: boolean;
  signer_full_name?: string | null;
  shareholder_id?: string | null;
  created_at: string;
  updated_at: string;
}

