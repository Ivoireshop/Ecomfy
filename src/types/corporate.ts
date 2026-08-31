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
  is_mandatory: boolean;
  target_roles: CorporateRole[];
  current_version: string;
  storage_path: string | null;
  content_markdown: string | null;
  created_at: string;
  updated_at: string;
  user_acceptance?: CorporateDocumentAcceptance | null;
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
