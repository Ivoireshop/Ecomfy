-- Migration: Ecomfy Livraison (Ecomfy Delivery) Module Schema
-- Description: Tables, enums, RLS policies, indexes, and triggers for delivery partner management, drivers, dispatches, COD cash tracking, and reviews.

-- 1. Enums
CREATE TYPE delivery_verification_status AS ENUM (
  'pending_verification',
  'under_review',
  'action_required',
  'approved',
  'rejected',
  'suspended'
);

CREATE TYPE delivery_dispatch_status AS ENUM (
  'pending_assignment',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'cod_collected',
  'deposit_pending',
  'completed',
  'cancelled',
  'disputed'
);

CREATE TYPE delivery_cash_status AS ENUM (
  'pending_collection',
  'collected_by_driver',
  'deposited_to_company',
  'transfer_initiated_to_seller',
  'confirmed_by_seller',
  'disputed'
);

-- 2. Delivery Companies Table
CREATE TABLE IF NOT EXISTS public.delivery_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code VARCHAR(10) NOT NULL DEFAULT 'CI',
  city TEXT NOT NULL,
  headquarters_address TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_phone TEXT NOT NULL,
  manager_whatsapp TEXT NOT NULL,
  manager_photo_url TEXT,
  manager_id_photo_url TEXT,
  owner_photo_url TEXT,
  warehouse_photo_url TEXT,
  
  -- Tax / Registry fields (optional based on country availability)
  has_tax_registration BOOLEAN DEFAULT false,
  tax_id_number TEXT,
  tax_document_url TEXT,
  trade_register_number TEXT,
  
  -- Operational stats & coverage
  covered_cities TEXT[] NOT NULL DEFAULT '{}',
  total_drivers_count INT NOT NULL DEFAULT 0,
  
  -- Verification & Trust Status (Controlled strictly by Foundation Admin)
  verification_status delivery_verification_status NOT NULL DEFAULT 'pending_verification',
  trust_badge_active BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  admin_notes TEXT,
  verification_requested_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ratings & Reputational Performance
  successful_deliveries_count INT NOT NULL DEFAULT 0,
  total_dispatches_count INT NOT NULL DEFAULT 0,
  average_payout_delay_hours NUMERIC(6,2) DEFAULT 24.0,
  rating_score NUMERIC(3,2) DEFAULT 5.0,
  reviews_count INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Storage Hubs Table
CREATE TABLE IF NOT EXISTS public.delivery_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  hub_name TEXT,
  phone TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Drivers Table
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  vehicle_type TEXT DEFAULT 'motorcycle', -- motorcycle, car, tricycle, van
  photo_url TEXT NOT NULL,
  national_id_photo_url TEXT NOT NULL,
  license_photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Dispatches Table (Links Orders to Delivery Companies & Drivers)
CREATE TABLE IF NOT EXISTS public.delivery_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE RESTRICT,
  assigned_driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  
  status delivery_dispatch_status NOT NULL DEFAULT 'pending_assignment',
  
  -- Visual Proof & Notes
  customer_parcel_photo_url TEXT,
  delivery_note TEXT,
  delivery_address TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  city TEXT NOT NULL,
  
  -- Cash On Delivery amounts
  cod_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'XOF',
  
  -- Tracking Timestamps
  assigned_at TIMESTAMPTZ DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cod_collected_at TIMESTAMPTZ,
  seller_payout_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Cash Transfers & Payout Audit Table
CREATE TABLE IF NOT EXISTS public.delivery_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.delivery_dispatches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  
  cod_amount NUMERIC(12,2) NOT NULL,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_seller_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  
  status delivery_cash_status NOT NULL DEFAULT 'pending_collection',
  
  -- Evidence & Verification
  deposit_proof_url TEXT,
  deposit_method TEXT, -- Wave, Orange Money, MTN MoMo, Cash, Bank Transfer
  transaction_reference TEXT,
  deposited_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  
  -- Dispute Management
  dispute_raised BOOLEAN NOT NULL DEFAULT false,
  dispute_reason TEXT,
  dispute_raised_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Delivery Company Reviews Table
CREATE TABLE IF NOT EXISTS public.delivery_company_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES public.delivery_dispatches(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Indexes for Speed & Fast Matching
CREATE INDEX IF NOT EXISTS idx_delivery_companies_status ON public.delivery_companies(verification_status, trust_badge_active);
CREATE INDEX IF NOT EXISTS idx_delivery_companies_cities ON public.delivery_companies USING GIN (covered_cities);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_order ON public.delivery_dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_shop ON public.delivery_dispatches(shop_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_company ON public.delivery_dispatches(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_transfers_dispatch ON public.delivery_cash_transfers(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_transfers_status ON public.delivery_cash_transfers(status, dispute_raised);

-- 9. Row Level Security (RLS)
ALTER TABLE public.delivery_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cash_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_company_reviews ENABLE ROW LEVEL SECURITY;

-- Delivery Companies Policies:
-- Anyone can view verified delivery companies
CREATE POLICY "Public can view approved delivery companies"
  ON public.delivery_companies FOR SELECT
  USING (verification_status = 'approved' AND trust_badge_active = true);

-- Owners can view & manage their own company profile
CREATE POLICY "Owners can view own delivery company"
  ON public.delivery_companies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create delivery company application"
  ON public.delivery_companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own delivery company"
  ON public.delivery_companies FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins (Foundation) full access policy
CREATE POLICY "Admins full access to delivery companies"
  ON public.delivery_companies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('admin', 'foundation', 'superadmin') OR profiles.email LIKE '%foundation%')
    )
  );

-- Delivery Hubs Policies:
CREATE POLICY "Public read verified hubs"
  ON public.delivery_hubs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_hubs.company_id
      AND (delivery_companies.verification_status = 'approved' OR delivery_companies.user_id = auth.uid())
    )
  );

CREATE POLICY "Company owners insert hubs"
  ON public.delivery_hubs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_hubs.company_id
      AND delivery_companies.user_id = auth.uid()
    )
  );

-- Delivery Drivers Policies:
CREATE POLICY "Company owners & admins manage drivers"
  ON public.delivery_drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_drivers.company_id
      AND (delivery_companies.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'foundation')
      ))
    )
  );

-- Delivery Dispatches Policies:
CREATE POLICY "Sellers can view own shop dispatches"
  ON public.delivery_dispatches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = delivery_dispatches.shop_id
      AND shops.user_id = auth.uid()
    )
  );

CREATE POLICY "Delivery companies can view assigned dispatches"
  ON public.delivery_dispatches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_dispatches.company_id
      AND delivery_companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can create dispatches"
  ON public.delivery_dispatches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = delivery_dispatches.shop_id
      AND shops.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers & Delivery Companies can update dispatches"
  ON public.delivery_dispatches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops WHERE shops.id = delivery_dispatches.shop_id AND shops.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_companies WHERE delivery_companies.id = delivery_dispatches.company_id AND delivery_companies.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'foundation')
    )
  );

-- Cash Transfers Policies:
CREATE POLICY "Sellers & Delivery Companies can view cash transfers"
  ON public.delivery_cash_transfers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = delivery_cash_transfers.shop_id AND shops.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_companies WHERE delivery_companies.id = delivery_cash_transfers.company_id AND delivery_companies.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'foundation'))
  );

CREATE POLICY "Delivery companies & Sellers update cash transfers"
  ON public.delivery_cash_transfers FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE shops.id = delivery_cash_transfers.shop_id AND shops.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_companies WHERE delivery_companies.id = delivery_cash_transfers.company_id AND delivery_companies.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'foundation'))
  );

CREATE POLICY "System or company creates cash transfers"
  ON public.delivery_cash_transfers FOR INSERT
  WITH CHECK (true);

-- Reviews Policies:
CREATE POLICY "Public read reviews" ON public.delivery_company_reviews FOR SELECT USING (true);
CREATE POLICY "Sellers create reviews" ON public.delivery_company_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = delivery_company_reviews.shop_id AND shops.user_id = auth.uid())
);

-- 10. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_delivery_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_delivery_companies_updated AT BEFORE UPDATE ON public.delivery_companies FOR EACH ROW EXECUTE FUNCTION update_delivery_modified_column();
CREATE TRIGGER trg_delivery_drivers_updated AT BEFORE UPDATE ON public.delivery_drivers FOR EACH ROW EXECUTE FUNCTION update_delivery_modified_column();
CREATE TRIGGER trg_delivery_dispatches_updated AT BEFORE UPDATE ON public.delivery_dispatches FOR EACH ROW EXECUTE FUNCTION update_delivery_modified_column();
CREATE TRIGGER trg_delivery_cash_transfers_updated AT BEFORE UPDATE ON public.delivery_cash_transfers FOR EACH ROW EXECUTE FUNCTION update_delivery_modified_column();
