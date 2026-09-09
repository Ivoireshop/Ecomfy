export type DeliveryVerificationStatus = 
  | 'draft'
  | 'documents_required'
  | 'pending_verification'
  | 'processing'
  | 'under_review'
  | 'action_required'
  | 'manual_review'
  | 'approved'
  | 'rejected'
  | 'resubmission_required'
  | 'suspended';

export type DeliveryProfileType = 'manager' | 'driver';

export type DeliveryVehicleType = 'motorcycle' | 'car' | 'tricycle' | 'van' | 'other';

export type LicenseCategory = 'A' | 'B' | 'C' | 'D' | 'E';

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

export interface VerificationDocumentItem {
  id: string;
  type: 'cni' | 'passport' | 'driver_license' | 'selfie_liveness' | 'selfie_with_id' | 'proof_of_residence' | 'tax_document';
  url: string;
  status: 'received' | 'processing' | 'verified' | 'rejected' | 'action_required';
  uploaded_at: string;
  rejection_reason?: string;
  ocr_extracted_data?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    document_number?: string;
    expiry_date?: string;
    country_code?: string;
  };
}

export interface VerificationAuditLog {
  id: string;
  request_id: string;
  user_id?: string;
  actor_role: 'system_ai' | 'admin' | 'user';
  action: 'document_uploaded' | 'ocr_extracted' | 'face_matched' | 'category_verified' | 'auto_approved' | 'auto_rejected' | 'manual_reviewed' | 'resubmission_requested' | 'status_changed';
  details: string;
  confidence_score?: number;
  created_at: string;
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
  manager_dob?: string | null;
  manager_phone: string;
  manager_whatsapp: string;
  manager_photo_url?: string | null;
  manager_id_photo_url?: string | null;
  manager_selfie_with_id_url?: string | null;
  owner_photo_url?: string | null;
  warehouse_photo_url?: string | null;
  
  has_tax_registration: boolean;
  tax_id_number?: string | null;
  tax_document_url?: string | null;
  trade_register_number?: string | null;
  
  covered_cities: string[];
  total_drivers_count: number;
  
  verification_status: DeliveryVerificationStatus;
  trust_badge_active: boolean;
  rejection_reason?: string | null;
  rejection_reason_code?: StructuredRejectionReasonCode | null;
  admin_notes?: string | null;
  reviewer_comments?: string | null;
  verification_requested_at?: string;
  verified_at?: string | null;
  verified_by?: string | null;
  
  // Verification AI & Audit Scores
  ai_confidence_score?: number;
  face_match_score?: number;
  document_checklist?: VerificationDocumentItem[];
  
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
  license_categories?: LicenseCategory[];
  photo_url: string;
  national_id_photo_url: string;
  license_photo_url?: string | null;
  selfie_with_id_url?: string | null;
  is_active: boolean;
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
