-- ====================================================================
-- ECOMFY AFFILIATE & AMBASSADOR SYSTEM — DATABASE MIGRATION
-- ====================================================================

-- 1. AFFILIATE PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    affiliate_code TEXT NOT NULL UNIQUE,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.20, -- 20% default
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by code and user
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates(affiliate_code);

-- 2. AFFILIATE PAYOUT METHODS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_payout_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL UNIQUE REFERENCES public.affiliates(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('orange_money', 'wave', 'mtn_money', 'moov_money', 'bank_transfer')),
    account_phone TEXT,
    account_name TEXT NOT NULL,
    bank_name TEXT,
    account_number_iban TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_methods_affiliate ON public.affiliate_payout_methods(affiliate_id);

-- 3. AFFILIATE REFERRALS (LINK REFERRED USER TO AFFILIATE)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code_used TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON public.affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred ON public.affiliate_referrals(referred_user_id);

-- 4. QUARTERLY PAYOUT PERIODS
CREATE TABLE IF NOT EXISTS public.affiliate_payout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- e.g. '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'
    name TEXT NOT NULL,        -- e.g. 'Trimestre 1 (Janvier - Mars 2026)'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default payout periods for 2026 & 2027
INSERT INTO public.affiliate_payout_periods (code, name, start_date, end_date, status)
VALUES 
  ('2026-Q1', 'Trimestre 1 2026 (Jan - Mar)', '2026-01-01', '2026-03-31', 'closed'),
  ('2026-Q2', 'Trimestre 2 2026 (Avr - Juin)', '2026-04-01', '2026-06-30', 'closed'),
  ('2026-Q3', 'Trimestre 3 2026 (Juil - Sept)', '2026-07-01', '2026-09-30', 'closed'),
  ('2026-Q4', 'Trimestre 4 2026 (Oct - Déc)', '2026-10-01', '2026-12-31', 'open'),
  ('2027-Q1', 'Trimestre 1 2027 (Jan - Mar)', '2027-01-01', '2027-03-31', 'open'),
  ('2027-Q2', 'Trimestre 2 2027 (Avr - Juin)', '2027-04-01', '2027-06-30', 'open')
ON CONFLICT (code) DO NOTHING;

-- 5. AFFILIATE PAYOUTS HISTORY
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    period_code TEXT REFERENCES public.affiliate_payout_periods(code),
    amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON public.affiliate_payouts(affiliate_id);

-- 6. AFFILIATE COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_id UUID UNIQUE REFERENCES public.payments(id) ON DELETE SET NULL, -- Prevent duplicate commissions
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount_paid NUMERIC(12,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.20,
    commission_amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PAYABLE' CHECK (status IN ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED', 'REVERSED')),
    period_code TEXT REFERENCES public.affiliate_payout_periods(code),
    payout_id UUID REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred ON public.affiliate_commissions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_period ON public.affiliate_commissions(period_code);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. SYSTEM SETTINGS TABLE (MINIMUM PAYOUT THRESHOLD = 10,000 FCFA)
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.affiliate_settings (key, value)
VALUES ('minimum_payout_threshold', '10000'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on all affiliate tables
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- RLS POLICIES
-- ====================================================================

-- AFFILIATES: Users can view & manage their own profile; Founders can manage all.
CREATE POLICY "Users can read own affiliate profile"
    ON public.affiliates FOR SELECT
    USING (auth.uid() = user_id OR public.is_founder_or_cofounder(auth.uid()));

CREATE POLICY "Users can insert own affiliate profile"
    ON public.affiliates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Founders can update affiliate profiles"
    ON public.affiliates FOR UPDATE
    USING (public.is_founder_or_cofounder(auth.uid()));

-- PAYOUT METHODS: Users manage their own; Founders read all.
CREATE POLICY "Users can manage own payout methods"
    ON public.affiliate_payout_methods FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
      OR public.is_founder_or_cofounder(auth.uid())
    );

-- REFERRALS: Affiliates can read their referrals; Founders read all.
CREATE POLICY "Affiliates can read own referrals"
    ON public.affiliate_referrals FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
      OR public.is_founder_or_cofounder(auth.uid())
    );

CREATE POLICY "Authenticated users can insert referral"
    ON public.affiliate_referrals FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- COMMISSIONS: Affiliates read their own; Founders manage all.
CREATE POLICY "Affiliates can read own commissions"
    ON public.affiliate_commissions FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
      OR public.is_founder_or_cofounder(auth.uid())
    );

CREATE POLICY "Founders manage all commissions"
    ON public.affiliate_commissions FOR ALL
    USING (public.is_founder_or_cofounder(auth.uid()));

-- PAYOUTS & PERIODS: Affiliates read their own payouts; Founders manage all.
CREATE POLICY "Affiliates can read own payouts"
    ON public.affiliate_payouts FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
      OR public.is_founder_or_cofounder(auth.uid())
    );

CREATE POLICY "Founders manage all payouts"
    ON public.affiliate_payouts FOR ALL
    USING (public.is_founder_or_cofounder(auth.uid()));

CREATE POLICY "Everyone can read payout periods"
    ON public.affiliate_payout_periods FOR SELECT
    USING (true);

CREATE POLICY "Everyone can read affiliate settings"
    ON public.affiliate_settings FOR SELECT
    USING (true);

CREATE POLICY "Founders manage affiliate settings"
    ON public.affiliate_settings FOR ALL
    USING (public.is_founder_or_cofounder(auth.uid()));

-- ====================================================================
-- RPC FUNCTIONS
-- ====================================================================

-- Function to get or create an affiliate profile for a user
CREATE OR REPLACE FUNCTION public.get_or_create_affiliate(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate public.affiliates%ROWTYPE;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = p_user_id;

  IF FOUND THEN
    RETURN to_jsonb(v_affiliate);
  END IF;

  -- Generate unique code (e.g. REF-A8F2K)
  LOOP
    v_code := 'REF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS (SELECT 1 FROM public.affiliates WHERE affiliate_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (p_user_id, v_code, 0.20, 'active')
  RETURNING * INTO v_affiliate;

  RETURN to_jsonb(v_affiliate);
END;
$$;

-- Function to record a referral link
CREATE OR REPLACE FUNCTION public.record_affiliate_referral(p_referred_user_id UUID, p_affiliate_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate public.affiliates%ROWTYPE;
  v_referral public.affiliate_referrals%ROWTYPE;
BEGIN
  IF p_referred_user_id IS NULL OR p_affiliate_code IS NULL OR TRIM(p_affiliate_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code ou utilisateur manquant');
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliates WHERE UPPER(affiliate_code) = UPPER(TRIM(p_affiliate_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code affilié invalide');
  END IF;

  -- Prevent self-referral
  IF v_affiliate.user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auto-parrainage interdit');
  END IF;

  -- Insert referral record if not already referred
  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used)
  VALUES (v_affiliate.id, p_referred_user_id, UPPER(TRIM(p_affiliate_code)))
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING * INTO v_referral;

  RETURN jsonb_build_object('success', true, 'affiliate_id', v_affiliate.id);
END;
$$;

-- Function to process commission for a completed payment transaction
CREATE OR REPLACE FUNCTION public.process_affiliate_commission_for_payment(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_referral RECORD;
  v_affiliate RECORD;
  v_period_code TEXT;
  v_commission_amount NUMERIC(12,2);
  v_commission_id UUID;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF NOT FOUND OR v_payment.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable ou non complété');
  END IF;

  -- Check if commission already generated for this payment (Anti-duplicate)
  IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Check if user was referred by an affiliate
  SELECT * INTO v_referral FROM public.affiliate_referrals WHERE referred_user_id = v_payment.user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'no_referral', true);
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliates WHERE id = v_referral.affiliate_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affilié inactif ou non trouvé');
  END IF;

  -- Determine current quarterly payout period
  SELECT code INTO v_period_code FROM public.affiliate_payout_periods
  WHERE CURRENT_DATE BETWEEN start_date AND end_date
  ORDER BY start_date DESC LIMIT 1;

  IF v_period_code IS NULL THEN
    v_period_code := '2026-Q4';
  END IF;

  -- Calculate 20% dynamic commission from actual paid amount
  v_commission_amount := ROUND((v_payment.amount * v_affiliate.commission_rate)::numeric, 2);

  INSERT INTO public.affiliate_commissions (
    affiliate_id,
    referred_user_id,
    payment_id,
    amount_paid,
    commission_rate,
    commission_amount,
    status,
    period_code,
    notes
  ) VALUES (
    v_affiliate.id,
    v_payment.user_id,
    v_payment.id,
    v_payment.amount,
    v_affiliate.commission_rate,
    v_commission_amount,
    'PAYABLE',
    v_period_code,
    'Commission automatique sur abonnement payé (' || v_payment.amount || ' FCFA)'
  ) RETURNING id INTO v_commission_id;

  RETURN jsonb_build_object(
    'success', true, 
    'commission_id', v_commission_id, 
    'amount', v_commission_amount, 
    'affiliate_id', v_affiliate.id
  );
END;
$$;

-- Function for Founder Manual Payout
CREATE OR REPLACE FUNCTION public.mark_affiliate_payout_paid(
  p_affiliate_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_reference TEXT,
  p_period_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_founder_id UUID := auth.uid();
  v_payout_id UUID;
  v_updated_count INT;
BEGIN
  IF NOT public.is_founder_or_cofounder(v_founder_id) THEN
    RAISE EXCEPTION 'Accès refusé. Seul le fondateur peut valider un paiement manuel d''affiliation.';
  END IF;

  -- Insert payout record
  INSERT INTO public.affiliate_payouts (
    affiliate_id,
    period_code,
    amount_paid,
    payment_method,
    payment_reference,
    notes,
    created_by
  ) VALUES (
    p_affiliate_id,
    p_period_code,
    p_amount,
    p_payment_method,
    p_payment_reference,
    p_notes,
    v_founder_id
  ) RETURNING id INTO v_payout_id;

  -- Update eligible commissions to PAID
  IF p_period_code IS NOT NULL AND p_period_code != '' THEN
    UPDATE public.affiliate_commissions
    SET status = 'PAID', payout_id = v_payout_id, updated_at = now()
    WHERE affiliate_id = p_affiliate_id AND status IN ('PAYABLE', 'APPROVED', 'PENDING') AND period_code = p_period_code;
  ELSE
    UPDATE public.affiliate_commissions
    SET status = 'PAID', payout_id = v_payout_id, updated_at = now()
    WHERE affiliate_id = p_affiliate_id AND status IN ('PAYABLE', 'APPROVED', 'PENDING');
  END IF;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Log action
  INSERT INTO public.affiliate_audit_logs (affiliate_id, action, performed_by, details)
  VALUES (
    p_affiliate_id,
    'MARK_PAID',
    v_founder_id,
    jsonb_build_object(
      'payout_id', v_payout_id,
      'amount', p_amount,
      'method', p_payment_method,
      'reference', p_payment_reference,
      'period', p_period_code,
      'commissions_updated', v_updated_count
    )
  );

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout_id, 'updated_commissions', v_updated_count);
END;
$$;
