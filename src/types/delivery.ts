export type DeliveryVerificationStatus = 
  | 'pending_verification'
  | 'under_review'
  | 'action_required'
  | 'approved'
  | 'rejected'
  | 'suspended';

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

export interface DeliveryCompany {
  id: string;
  user_id?: string | null;
  company_name: string;
  country: string;
  country_code: string;
  city: string;
  headquarters_address: string;
  manager_name: string;
  manager_phone: string;
  manager_whatsapp: string;
  manager_photo_url?: string | null;
  manager_id_photo_url?: string | null;
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
  admin_notes?: string | null;
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
  phone: string;
  whatsapp?: string | null;
  vehicle_type: 'motorcycle' | 'car' | 'tricycle' | 'van' | string;
  photo_url: string;
  national_id_photo_url: string;
  license_photo_url?: string | null;
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
