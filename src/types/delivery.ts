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
  license_photo_url?: string | null;
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
