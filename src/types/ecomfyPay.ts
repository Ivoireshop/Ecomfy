export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
export type WithdrawalStatus = 'REQUESTED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REVERSED' | 'CANCELLED';

export interface MerchantKyc {
  id: string;
  user_id: string;
  full_name: string;
  country: string;
  phone_number: string;
  address?: string | null;
  seller_type: 'individual' | 'business';
  document_type: 'cni' | 'passport' | 'consular_card' | 'trade_register';
  document_number: string;
  document_expiry_date?: string | null;
  document_front_url: string;
  document_back_url?: string | null;
  selfie_url?: string | null;
  verification_status: KycStatus;
  rejection_reason?: string | null;
  verified_at?: string | null;
  ocr_extracted_name?: string | null;
  face_match_score?: number | null;
  face_match_passed?: boolean | null;
  doc_type_validated?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  link_key: string;
  shop_id: string;
  product_id?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  is_active: boolean;
  is_sandbox?: boolean;
  allow_custom_amount: boolean;
  redirect_url?: string | null;
  created_at: string;
  updated_at: string;
  products?: {
    name: string;
    image_url?: string | null;
  } | null;
}

export interface EcomfyPayment {
  id: string;
  internal_reference: string;
  provider_reference?: string | null;
  order_id?: string | null;
  merchant_id: string;
  shop_id?: string | null;
  product_id?: string | null;
  payment_link_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  provider: string;
  payment_method: string;
  amount: number;
  currency: string;
  fee_provider: number;
  fee_ecomfy: number;
  net_merchant_amount: number;
  status: PaymentStatus;
  is_sandbox?: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  shops?: {
    business_name: string;
  } | null;
}

export interface Wallet {
  id: string;
  merchant_id: string;
  pending_balance: number;
  available_balance: number;
  total_withdrawn: number;
  total_received: number;
  currency: string;
  is_frozen: boolean;
  default_payout_phone?: string | null;
  default_payout_name?: string | null;
  default_payout_provider?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerEntry {
  id: string;
  wallet_id: string;
  merchant_id: string;
  entry_type: 'PAYMENT_PENDING' | 'SETTLEMENT_AVAILABLE' | 'WITHDRAWAL_REQUESTED' | 'WITHDRAWAL_COMPLETED' | 'WITHDRAWAL_FAILED' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  currency: string;
  reference_id?: string | null;
  description: string;
  balance_type: 'PENDING' | 'AVAILABLE';
  running_pending_balance: number;
  running_available_balance: number;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  withdrawal_reference: string;
  merchant_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  payout_method: 'mobile_money' | 'bank_transfer';
  destination_phone?: string | null;
  destination_name?: string | null;
  destination_bank_iban?: string | null;
  provider: string;
  provider_reference?: string | null;
  status: WithdrawalStatus;
  failure_reason?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}
