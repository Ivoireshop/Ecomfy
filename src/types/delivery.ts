export type DeliveryVerificationStatus =
  | 'pending_verification'
  | 'under_review'
  | 'action_required'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type DriverVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type DeliveryProfileType = 'manager' | 'driver';

export type DeliveryVehicleType = 'motorcycle' | 'car' | 'tricycle' | 'van' | 'other';

export type LicenseCategory = 'A' | 'B' | 'C' | 'D' | 'E';

export type IdDocumentType = 'cni' | 'passport';

export type DeliveryDispatchStatus =
  | 'transmitted'
  | 'accepted'
  | 'refused'
  | 'preparing'
  | 'failed'
  | 'returned'
  | 'pending_assignment'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cod_collected'
  | 'deposit_pending'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type DeliveryCashStatus =
  | 'pending_collection'
  | 'collected_by_driver'
  | 'deposited_to_company'
  | 'transfer_initiated_to_seller'
  | 'confirmed_by_seller'
  | 'disputed';

export type StructuredRejectionReasonCode =
  | 'EXPIRED_ID'
  | 'EXPIRED_LICENSE'
  | 'NAME_MISMATCH'
  | 'DOB_MISMATCH'
  | 'NON_ID_DOCUMENT'
  | 'LICENSE_CATEGORY_MISMATCH'
  | 'LIVENESS_FAILED'
  | 'DOCUMENT_UNREADABLE'
  | 'DUPLICATE_IDENTITY'
  | 'SUSPICIOUS_MANIPULATION'
  | 'MISSING_BACK_SIDE'
  | 'OTHER';

export const REJECTION_REASON_LABELS: Record<StructuredRejectionReasonCode, string> = {
  EXPIRED_ID: "Pièce d'identité expirée",
  EXPIRED_LICENSE: "Permis de conduire expiré",
  NAME_MISMATCH: "Incohérence entre le nom déclaré et le document",
  DOB_MISMATCH: "Incohérence de date de naissance",
  NON_ID_DOCUMENT: "Document non conforme (facture/quittance au lieu d'une pièce d'identité)",
  LICENSE_CATEGORY_MISMATCH: "Catégorie de permis incompatible avec le véhicule",
  LIVENESS_FAILED: "Échec de la vérification faciale liveness",
  DOCUMENT_UNREADABLE: "Document illisible ou flou",
  DUPLICATE_IDENTITY: "Usurpation ou pièce d'identité déjà enregistrée",
  SUSPICIOUS_MANIPULATION: "Image suspecte ou falsifiée",
  MISSING_BACK_SIDE: "Verso de la pièce ou du permis manquant",
  OTHER: "Autre motif spécifié par l'administrateur",
};

/** Ligne du journal d'audit (table delivery_verification_audit, en ajout seul, écrite par la base). */
export interface DeliveryAuditEntry {
  id: string;
  company_id: string;
  driver_id?: string | null;
  company_name?: string | null;
  subject: 'company' | 'driver';
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  reason_code?: StructuredRejectionReasonCode | null;
  reason?: string | null;
  note?: string | null;
  visibility: 'owner' | 'internal';
  actor_id?: string | null;
  actor_kind: 'owner' | 'admin' | 'system';
  details: Record<string, unknown>;
  created_at: string;
}

export interface DeliveryNotification {
  id: string;
  user_id: string;
  company_id?: string | null;
  driver_id?: string | null;
  kind: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string | null;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
}

/** Identité du responsable (table delivery_company_kyc, lisible du seul propriétaire et des administrateurs). */
export interface DeliveryCompanyKyc {
  company_id: string;
  id_type: IdDocumentType;
  id_number: string;
  id_expiry?: string | null;
  date_of_birth: string;
}

/** Position précise de l'entrepôt (table delivery_company_location, lisible du seul propriétaire et des administrateurs). */
export interface DeliveryCompanyLocation {
  company_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  source: 'gps' | 'map';
  updated_at?: string;
}

export interface DeliveryCompany {
  id: string;
  user_id?: string | null;
  profile_type?: DeliveryProfileType;
  company_name: string;
  country: string;
  country_code: string;
  city: string;
  headquarters_address: string;
  manager_name: string;
  manager_first_name?: string | null;
  manager_last_name?: string | null;
  manager_phone: string;
  manager_whatsapp: string;
  /** Chemins dans le bucket privé « delivery-kyc » (jamais des URL publiques). */
  manager_photo_url?: string | null;
  manager_id_photo_url?: string | null;
  /** Verso de la pièce d'identité (absent pour un passeport et pour les dossiers antérieurs au verso). */
  manager_id_back_photo_url?: string | null;
  manager_selfie_with_id_url?: string | null;
  owner_photo_url?: string | null;
  warehouse_photo_url?: string | null;

  has_tax_registration: boolean;
  tax_id_number?: string | null;
  tax_document_url?: string | null;
  trade_register_number?: string | null;
  trade_register_document_url?: string | null;
  
  covered_cities: string[];
  total_drivers_count: number;

  /** Fiche publique (répertoire). */
  description?: string | null;
  services_info?: string | null;
  logo_url?: string | null;
  public_phone?: string | null;
  public_email?: string | null;
  
  verification_status: DeliveryVerificationStatus;
  trust_badge_active: boolean;
  rejection_reason?: string | null;
  rejection_reason_code?: StructuredRejectionReasonCode | null;
  /** Message de l'équipe au candidat (complément demandé). Les notes internes sont dans un registre à part. */
  reviewer_comments?: string | null;
  verification_requested_at?: string;
  verified_at?: string | null;
  verified_by?: string | null;

  successful_deliveries_count: number;
  total_dispatches_count: number;
  average_payout_delay_hours: number;
  rating_score: number;
  reviews_count: number;
  
  created_at: string;
  updated_at: string;
  
  // Joins / expanded relations
  hubs?: DeliveryHub[];
  drivers?: DeliveryDriver[];
  kyc?: DeliveryCompanyKyc | null;
  location?: DeliveryCompanyLocation | null;
}

export interface DeliveryHub {
  id: string;
  company_id: string;
  city: string;
  address: string;
  hub_name?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  created_at?: string;
}

export interface DeliveryDriver {
  id: string;
  company_id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  phone: string;
  whatsapp?: string | null;
  vehicle_type: DeliveryVehicleType;
  vehicle_license_plate?: string | null;
  id_type?: IdDocumentType | null;
  id_number?: string | null;
  id_expiry?: string | null;
  license_number?: string | null;
  license_categories: LicenseCategory[];
  license_expiry?: string | null;
  photo_url: string;
  national_id_photo_url: string;
  national_id_back_photo_url?: string | null;
  license_photo_url?: string | null;
  license_back_photo_url?: string | null;
  selfie_with_id_url?: string | null;
  /** Actif = approuvé ET permis valable (invariant appliqué par la base). */
  is_active: boolean;
  verification_status: DriverVerificationStatus;
  rejection_reason?: string | null;
  rejection_reason_code?: StructuredRejectionReasonCode | null;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryDispatch {
  id: string;
  order_id?: string | null;
  shop_id?: string | null;
  company_id: string;
  assigned_driver_id?: string | null;
  
  status: DeliveryDispatchStatus;
  
  customer_parcel_photo_url?: string | null;
  delivery_note?: string | null;
  delivery_address: string;
  recipient_name: string;
  recipient_phone: string;
  city: string;
  
  cod_amount: number;
  delivery_fee: number;
  currency: string;
  
  assigned_at?: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  cod_collected_at?: string | null;
  seller_payout_completed_at?: string | null;
  transmitted_at?: string | null;
  received_at?: string | null;
  accepted_at?: string | null;
  refused_at?: string | null;
  refusal_reason?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  returned_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Relations
  company?: DeliveryCompany;
  driver?: DeliveryDriver;
  cash_transfer?: DeliveryCashTransfer;
}

export interface DeliveryCashTransfer {
  id: string;
  dispatch_id: string;
  company_id: string;
  shop_id: string;
  
  cod_amount: number;
  delivery_fee: number;
  net_seller_amount: number;
  currency: string;
  
  status: DeliveryCashStatus;
  
  deposit_proof_url?: string | null;
  deposit_method?: string | null;
  transaction_reference?: string | null;
  deposited_at?: string | null;
  seller_confirmed_at?: string | null;
  
  dispute_raised: boolean;
  dispute_reason?: string | null;
  dispute_raised_at?: string | null;
  dispute_resolved_at?: string | null;
  admin_notes?: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface DeliveryCompanyReview {
  id: string;
  company_id: string;
  shop_id: string;
  dispatch_id?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface DeliveryDispatchHistoryEntry {
  id: string;
  dispatch_id: string;
  event: string;
  from_status?: string | null;
  to_status?: string | null;
  driver_id?: string | null;
  reason?: string | null;
  note?: string | null;
  actor_id?: string | null;
  actor_kind: 'seller' | 'company' | 'admin' | 'system' | 'other';
  created_at: string;
}

export type DeliveryStaffRole = 'admin' | 'operations' | 'reception' | 'driver';
export type DeliveryWorkspaceRole = DeliveryStaffRole | 'owner';
export type DeliveryPerm = 'member' | 'read' | 'operate' | 'assign' | 'cash' | 'stats' | 'manage_team';

export const DELIVERY_ROLE_LABELS: Record<DeliveryWorkspaceRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur de la structure',
  operations: 'Responsable des opérations',
  reception: 'Agent de réception',
  driver: 'Livreur',
};

/** Espace de travail du compte connecté : propriétaire ou collaborateur d'une structure. */
export interface DeliveryWorkspace {
  company_id: string;
  company_name: string;
  city: string;
  country: string;
  verification_status: DeliveryVerificationStatus;
  trust_badge_active: boolean;
  rating_score: number | null;
  drivers_count: number;
  role: DeliveryWorkspaceRole;
  perms: DeliveryPerm[];
  driver_id: string | null;
}

export interface DeliveryStaffMember {
  id: string;
  invited_email: string;
  role: DeliveryStaffRole;
  status: 'invited' | 'active' | 'inactive';
  driver_id: string | null;
  driver_name: string | null;
  invitation_token: string | null;
  invited_at: string;
  accepted_at: string | null;
  assigned_total: number;
  in_progress: number;
  delivered: number;
  actions_30d: number;
}

export interface DeliveryAssignableDriver {
  id: string;
  full_name: string;
  vehicle_type: string;
  is_active: boolean;
  verification_status: string;
}

export interface DeliveryDriverStats {
  driver_id: string;
  full_name: string;
  is_active: boolean;
  in_progress: number;
  delivered: number;
  failed: number;
  success_rate: number | null;
  avg_delivery_minutes: number | null;
}

export interface DeliveryAdminOperations {
  days: number;
  totals: {
    transmitted: number; accepted: number; refused: number; in_progress: number; delivered: number;
    failed: number; returned: number; cancelled: number; cod_total: number;
  };
  companies: {
    company_id: string; company_name: string; verification_status: string; transmitted: number; accepted: number;
    refused: number; delivered: number; failed: number; success_rate: number | null; active_drivers: number;
  }[];
  disputes: {
    dispatch_id: string; company_name: string; shop_name: string | null; recipient_name: string;
    cod_amount: number; currency: string; reason: string | null; raised_at: string | null;
  }[];
  incidents: {
    dispatch_id: string; company_name: string; recipient_name: string; city: string; reason: string | null; failed_at: string | null;
  }[];
}

/** Fiche publique d'une structure ou d'un livreur indépendant, telle que la renvoie le répertoire (cahier §2). */
export interface DeliveryDirectoryCard {
  id: string;
  profile_type: DeliveryProfileType;
  company_name: string;
  /** Chemin dans le bucket public « delivery-logos » (pas une URL). */
  logo_url: string | null;
  description: string | null;
  services_info: string | null;
  city: string;
  country: string;
  /** Absente pour un livreur indépendant (c'est son domicile). */
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  covered_cities: string[];
  rating_score: number | null;
  reviews_count: number;
  successful_deliveries_count: number;
  drivers_count: number;
  verified: boolean;
  verified_at: string | null;
}

export interface DeliveryDirectoryResult {
  total: number;
  items: DeliveryDirectoryCard[];
}

/** Champs de la fiche que le responsable peut modifier lui-même. */
export interface DeliveryProfileInput {
  company_name: string;
  description: string;
  services_info: string;
  headquarters_address: string;
  city: string;
  manager_phone: string;
  manager_whatsapp: string;
  public_phone: string;
  public_email: string;
  covered_cities: string[];
  logo_url: string | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Vérification physique (cahier §5)
// ---------------------------------------------------------------------------------------------------------------

/** Statut de vérification présenté à l'utilisateur (§5.3), déduit du dossier et de la visite. */
export type DeliveryFieldStatus =
  | 'not_verified' | 'requested' | 'info_requested' | 'visit_scheduled' | 'in_progress' | 'verified' | 'rejected' | 'suspended';

export const FIELD_STATUS_LABELS: Record<DeliveryFieldStatus, string> = {
  not_verified: 'Non vérifiée',
  requested: 'Vérification demandée',
  info_requested: 'Informations complémentaires demandées',
  visit_scheduled: 'Visite programmée',
  in_progress: 'Vérification en cours',
  verified: 'Vérifiée',
  rejected: 'Vérification refusée',
  suspended: 'Vérification suspendue',
};

export type DeliveryVisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type DeliveryVisitOutcome = 'passed' | 'failed' | 'info_needed';

export const VISIT_STATUS_LABELS: Record<DeliveryVisitStatus, string> = {
  scheduled: 'Programmée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
};
export const VISIT_OUTCOME_LABELS: Record<DeliveryVisitOutcome, string> = {
  passed: 'Concluante', failed: 'Non concluante', info_needed: 'Informations à compléter',
};

/** Contrôles que l'agent coche sur place (§5.1). Ceux marqués « required » sont obligatoires pour une visite concluante. */
export const VISIT_CHECKS = [
  { key: 'premises_exist', label: 'Les locaux existent réellement', required: true },
  { key: 'address_matches', label: "L'adresse communiquée est exacte", required: true },
  { key: 'company_exists', label: "L'entreprise existe effectivement", required: true },
  { key: 'delivery_activity', label: "Une activité de livraison est présente", required: true },
  { key: 'equipment_adequate', label: 'Les équipements et moyens sont suffisants', required: false },
  { key: 'info_consistent', label: "Les informations d'inscription sont cohérentes", required: true },
] as const;
export type VisitCheckKey = (typeof VISIT_CHECKS)[number]['key'];
export type VisitChecks = Partial<Record<VisitCheckKey, boolean | null>>;

export interface DeliveryFieldAgent {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  open_visits: number;
  completed_visits: number;
}

export interface DeliveryFieldVisitAdmin {
  id: string;
  company_id: string;
  company_name: string;
  company_city: string;
  company_address: string;
  profile_type: DeliveryProfileType;
  verification_status: DeliveryVerificationStatus;
  field_status: DeliveryFieldStatus;
  agent_id: string;
  agent_name: string;
  scheduled_for: string;
  status: DeliveryVisitStatus;
  instructions: string | null;
  started_at: string | null;
  completed_at: string | null;
  visited_on: string | null;
  outcome: DeliveryVisitOutcome | null;
  checks: VisitChecks;
  observations: string | null;
  photos: string[];
  cancelled_reason: string | null;
  created_at: string;
}

export interface DeliveryPendingVerification {
  id: string;
  company_name: string;
  city: string;
  address: string;
  profile_type: DeliveryProfileType;
  verification_status: DeliveryVerificationStatus;
  field_status: DeliveryFieldStatus;
  requested_at: string | null;
  last_visit_outcome: DeliveryVisitOutcome | null;
}

export interface DeliveryAgentVisit {
  id: string;
  status: DeliveryVisitStatus;
  scheduled_for: string;
  instructions: string | null;
  started_at: string | null;
  completed_at: string | null;
  visited_on: string | null;
  outcome: DeliveryVisitOutcome | null;
  checks: VisitChecks;
  observations: string | null;
  photos: string[];
  company: {
    id: string;
    name: string;
    profile_type: DeliveryProfileType;
    city: string;
    address: string;
    manager_name: string;
    manager_phone: string;
    covered_cities: string[];
    description: string | null;
  };
}

export interface DeliveryVisitSummary {
  field_status: DeliveryFieldStatus;
  visit: { status: DeliveryVisitStatus; scheduled_for: string; visited_on: string | null } | null;
}
