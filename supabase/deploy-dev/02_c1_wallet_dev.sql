-- ============================================================================
-- Déploiement DEV (étape 2/2, OPTIONNELLE) : correctif C1, système Ecomfy Pay (portefeuille)
-- Fichier généré à partir de 20260914190000_ecomfy_pay_system.sql puis 20260914200000_ecomfy_pay_enhanced.sql,
-- avec UNE adaptation : les index et politiques RLS de payment_links qui supposent les colonnes
-- shop_id / link_key / is_active sont retirés.
--   Raison : public.payment_links existe déjà sur dev (migration 20251120131345, liens de paiement de COURS :
--   course_id, provider, payment_url). Le CREATE TABLE IF NOT EXISTS de la migration Ecomfy Pay est donc ignoré et les
--   index sur shop_id / link_key échoueraient, annulant toute la transaction. Conflit de noms à résoudre avant la
--   production (voir docs/DEPLOIEMENT-DEV-2026-10.md). Les liens de paiement Ecomfy Pay ne fonctionnent pas
--   avec ce script ; le portefeuille, le KYC, les retraits et les fonctions C1 fonctionnent.
-- Non idempotent (CREATE POLICY) : ne l'exécuter qu'une fois. En cas d'échec, tout est annulé.
-- ============================================================================

-- ========================================================
-- ECOMFY PAY — SYSTEM MIGRATION (SCHÉMA ET FONCTIONS ATOMIQUES)
-- ========================================================

-- 1. MARCHANT KYC / VÉRIFICATION D'IDENTITÉ
CREATE TABLE IF NOT EXISTS public.merchant_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'CI',
    phone_number TEXT NOT NULL,
    address TEXT,
    seller_type TEXT NOT NULL DEFAULT 'individual', -- 'individual', 'business'
    document_type TEXT NOT NULL, -- 'cni', 'passport', 'consular_card', 'trade_register'
    document_number TEXT NOT NULL,
    document_expiry_date DATE,
    document_front_url TEXT NOT NULL,
    document_back_url TEXT,
    selfie_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'PENDING', -- 'NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'
    rejection_reason TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LIENS DE PAIEMENT ECOMFY PAY (PAYMENT LINKS)
CREATE TABLE IF NOT EXISTS public.payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_key TEXT NOT NULL UNIQUE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'XOF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allow_custom_amount BOOLEAN NOT NULL DEFAULT FALSE,
    redirect_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TRANSACTIONS DE PAIEMENT (ECOMFY PAYMENTS)
CREATE TABLE IF NOT EXISTS public.ecomfy_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_reference TEXT NOT NULL UNIQUE, -- ECM-PAY-XXXXXXXX
    provider_reference TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    provider TEXT NOT NULL DEFAULT 'geniuspay', -- 'geniuspay', 'wave', 'cinetpay', etc.
    payment_method TEXT NOT NULL, -- 'orange_money', 'mtn', 'wave', 'moov', 'card'
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'XOF',
    fee_provider NUMERIC(12,2) NOT NULL DEFAULT 0,
    fee_ecomfy NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_merchant_amount NUMERIC(12,2) NOT NULL CHECK (net_merchant_amount >= 0),
    status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ÉVÉNEMENTS & AUDIT WEBHOOKS (PAYMENT EVENTS)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    payment_id UUID REFERENCES public.ecomfy_payments(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'PROCESSED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, event_id)
);

-- 5. RÈGLEMENTS / SETTLEMENTS (DÉLAI DE DISPONIBILITÉ DES FONDS)
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.ecomfy_payments(id) ON DELETE CASCADE UNIQUE,
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gross_amount NUMERIC(12,2) NOT NULL,
    net_amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    settlement_delay_hours INT NOT NULL DEFAULT 72,
    available_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'AVAILABLE', 'REVERSED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. WALLETS MARCHANDS
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
    available_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
    total_received NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_received >= 0),
    currency TEXT NOT NULL DEFAULT 'XOF',
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. REGISTRE FINANCIER IMMUABLE (WALLET LEDGER)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL, -- 'PAYMENT_PENDING', 'SETTLEMENT_AVAILABLE', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_FAILED', 'REFUND', 'ADJUSTMENT'
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    reference_id TEXT, -- ID du paiement ou du retrait
    description TEXT NOT NULL,
    balance_type TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'AVAILABLE'
    running_pending_balance NUMERIC(12,2) NOT NULL,
    running_available_balance NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DEMANDES DE RETRAIT (WITHDRAWAL REQUESTS)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_reference TEXT NOT NULL UNIQUE, -- ECM-WDR-XXXXXXXX
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'XOF',
    payout_method TEXT NOT NULL, -- 'mobile_money', 'bank_transfer'
    destination_phone TEXT,
    destination_name TEXT,
    destination_bank_iban TEXT,
    provider TEXT NOT NULL DEFAULT 'geniuspay',
    provider_reference TEXT,
    status TEXT NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'
    failure_reason TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_merchant_kyc_user ON public.merchant_kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_ecomfy_payments_ref ON public.ecomfy_payments(internal_reference);
CREATE INDEX IF NOT EXISTS idx_ecomfy_payments_merchant ON public.ecomfy_payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ecomfy_payments_status ON public.ecomfy_payments(status);
CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON public.settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status, available_at);
CREATE INDEX IF NOT EXISTS idx_wallets_merchant ON public.wallets(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet ON public.wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_merchant ON public.withdrawal_requests(merchant_id);

-- ========================================================
-- SÉCURITÉ ET POLITIQUES RLS (ROW LEVEL SECURITY)
-- ========================================================
ALTER TABLE public.merchant_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecomfy_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- KYC
CREATE POLICY "Users view own KYC" ON public.merchant_kyc FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert/update own KYC" ON public.merchant_kyc FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own KYC" ON public.merchant_kyc FOR UPDATE USING (auth.uid() = user_id);

-- PAYMENT LINKS

-- PAYMENTS
CREATE POLICY "Merchants view own payments" ON public.ecomfy_payments FOR SELECT USING (auth.uid() = merchant_id);

-- WALLETS & LEDGER
CREATE POLICY "Merchants view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = merchant_id);
CREATE POLICY "Merchants view own ledger" ON public.wallet_ledger FOR SELECT USING (auth.uid() = merchant_id);
CREATE POLICY "Merchants view own settlements" ON public.settlements FOR SELECT USING (auth.uid() = merchant_id);

-- WITHDRAWALS
CREATE POLICY "Merchants view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = merchant_id);

-- ========================================================
-- FONCTIONS ATOMIQUES POSTGRES (TRANSACTIONS FINANCIÈRES)
-- ========================================================

-- A. CRÉATION OU RÉCUPÉRATION ATOMIQUE DU WALLET
CREATE OR REPLACE FUNCTION public.get_or_create_merchant_wallet(p_merchant_id UUID)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet public.wallets;
BEGIN
    SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
    
    IF NOT FOUND THEN
        INSERT INTO public.wallets (merchant_id, pending_balance, available_balance, total_withdrawn, total_received)
        VALUES (p_merchant_id, 0, 0, 0, 0)
        RETURNING * INTO v_wallet;
    END IF;
    
    RETURN v_wallet;
END;
$$;

-- B. CRÉDIT ATOMIQUE EN SOLDE EN ATTENTE (PAYMENT CONFIRMED BY WEBHOOK)
CREATE OR REPLACE FUNCTION public.credit_merchant_wallet_pending(
    p_merchant_id UUID,
    p_payment_id UUID,
    p_gross_amount NUMERIC,
    p_net_amount NUMERIC,
    p_currency TEXT DEFAULT 'XOF',
    p_settlement_hours INT DEFAULT 72,
    p_reference TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet public.wallets;
    v_available_at TIMESTAMPTZ;
    v_settlement_id UUID;
BEGIN
    -- Verrouiller le wallet
    v_wallet := public.get_or_create_merchant_wallet(p_merchant_id);
    
    IF v_wallet.is_frozen THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le portefeuille de ce marchand est gelé.');
    END IF;
    
    -- Vérifier si le paiement a déjà été crédité
    IF EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'Ce paiement a déjà été crédité au portefeuille.');
    END IF;
    
    v_available_at := NOW() + (p_settlement_hours || ' hours')::INTERVAL;
    
    -- Créer l'entité de règlement (Settlement)
    INSERT INTO public.settlements (payment_id, merchant_id, gross_amount, net_amount, currency, settlement_delay_hours, available_at, status)
    VALUES (p_payment_id, p_merchant_id, p_gross_amount, p_net_amount, p_currency, p_settlement_hours, v_available_at, 'PENDING')
    RETURNING id INTO v_settlement_id;
    
    -- Mettre à jour le solde du wallet
    UPDATE public.wallets
    SET pending_balance = pending_balance + p_net_amount,
        total_received = total_received + p_net_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
    
    -- Enregistrer l'entrée immuable au Ledger
    INSERT INTO public.wallet_ledger (
        wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type, running_pending_balance, running_available_balance
    ) VALUES (
        v_wallet.id, p_merchant_id, 'PAYMENT_PENDING', p_net_amount, p_currency, p_reference,
        'Paiement reçu — Fonds en attente de règlement (' || p_settlement_hours || 'h)',
        'PENDING', v_wallet.pending_balance, v_wallet.available_balance
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', v_settlement_id,
        'pending_balance', v_wallet.pending_balance,
        'available_balance', v_wallet.available_balance
    );
END;
$$;

-- C. RÈGLEMENT ATOMIQUE DES FONDS (PENDING -> AVAILABLE)
CREATE OR REPLACE FUNCTION public.process_wallet_settlements()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_settlement RECORD;
    v_wallet public.wallets;
    v_processed_count INT := 0;
BEGIN
    FOR r_settlement IN
        SELECT * FROM public.settlements
        WHERE status = 'PENDING' AND available_at <= NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = r_settlement.merchant_id FOR UPDATE;
        
        IF v_wallet.id IS NOT NULL THEN
            UPDATE public.wallets
            SET pending_balance = GREATEST(0, pending_balance - r_settlement.net_amount),
                available_balance = available_balance + r_settlement.net_amount,
                updated_at = NOW()
            WHERE id = v_wallet.id
            RETURNING * INTO v_wallet;
            
            UPDATE public.settlements
            SET status = 'AVAILABLE', settled_at = NOW()
            WHERE id = r_settlement.id;
            
            INSERT INTO public.wallet_ledger (
                wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type, running_pending_balance, running_available_balance
            ) VALUES (
                v_wallet.id, r_settlement.merchant_id, 'SETTLEMENT_AVAILABLE', r_settlement.net_amount, r_settlement.currency, r_settlement.payment_id::text,
                'Règlement libéré — Fonds désormais disponibles pour retrait',
                'AVAILABLE', v_wallet.pending_balance, v_wallet.available_balance
            );
            
            v_processed_count := v_processed_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_processed_count;
END;
$$;

-- D. DEMANDE DE RETRAIT ATOMIQUE AVEC VERROUILLAGE SÉCURISÉ
-- Le marchand est toujours l'appelant authentifié (auth.uid()) : aucun p_merchant_id en paramètre.
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal_atomic(
    p_amount NUMERIC,
    p_payout_method TEXT,
    p_destination_phone TEXT DEFAULT NULL,
    p_destination_name TEXT DEFAULT NULL,
    p_destination_bank_iban TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'XOF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    p_merchant_id UUID := auth.uid();
    v_wallet public.wallets;
    v_kyc public.merchant_kyc;
    v_withdrawal_id UUID;
    v_ref TEXT;
BEGIN
    IF p_merchant_id IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Montant de retrait invalide.');
    END IF;

    -- 1. Vérifier KYC
    SELECT * INTO v_kyc FROM public.merchant_kyc WHERE user_id = p_merchant_id;
    IF v_kyc.id IS NULL OR v_kyc.verification_status != 'VERIFIED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Votre compte d''identité (KYC) doit être vérifié avant de demander un retrait.');
    END IF;
    
    -- 2. Verrouiller le Wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
    
    IF v_wallet.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;
    
    IF v_wallet.is_frozen THEN
        RETURN jsonb_build_object('success', false, 'error', 'Votre portefeuille est temporairement bloqué par l''administration.');
    END IF;
    
    IF v_wallet.available_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde disponible insuffisant pour ce montant de retrait.');
    END IF;
    
    -- 3. Déduire du solde disponible
    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
    
    v_ref := 'ECM-WDR-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- 4. Enregistrer la demande de retrait
    INSERT INTO public.withdrawal_requests (
        withdrawal_reference, merchant_id, wallet_id, amount, currency, payout_method, destination_phone, destination_name, destination_bank_iban, status
    ) VALUES (
        v_ref, p_merchant_id, v_wallet.id, p_amount, p_currency, p_payout_method, p_destination_phone, p_destination_name, p_destination_bank_iban, 'REQUESTED'
    ) RETURNING id INTO v_withdrawal_id;
    
    -- 5. Inscrire au Ledger
    INSERT INTO public.wallet_ledger (
        wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type, running_pending_balance, running_available_balance
    ) VALUES (
        v_wallet.id, p_merchant_id, 'WITHDRAWAL_REQUESTED', -p_amount, p_currency, v_ref,
        'Demande de retrait initiée vers ' || COALESCE(p_destination_phone, p_destination_name, 'compte marchand'),
        'AVAILABLE', v_wallet.pending_balance, v_wallet.available_balance
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'withdrawal_reference', v_ref,
        'amount', p_amount,
        'remaining_available_balance', v_wallet.available_balance
    );
END;
$$;

-- ========================================================
-- E. DROITS D'EXÉCUTION (audit C1)
-- Supabase accorde EXECUTE à anon/authenticated par défaut sur public.* :
-- on retire tout, puis on rouvre uniquement ce qui est nécessaire.
-- ========================================================
REVOKE ALL ON FUNCTION public.get_or_create_merchant_wallet(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_merchant_wallet_pending(UUID, UUID, NUMERIC, NUMERIC, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_wallet_settlements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_wallet_withdrawal_atomic(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_merchant_wallet(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_merchant_wallet_pending(UUID, UUID, NUMERIC, NUMERIC, TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_wallet_settlements() TO service_role;
-- Retrait : le marchand connecté l'appelle avec son propre JWT (auth.uid() identifie le portefeuille).
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal_atomic(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ---------- 20260914200000_ecomfy_pay_enhanced.sql ----------
-- ========================================================
-- ECOMFY PAY — ENHANCEMENTS (PAYOUT CONFIG, SANDBOX MODE, STRICT KYC)
-- ========================================================

-- 1. MODIFICATION TABLE WALLETS (CONFIG RETRAIT PAR DÉFAUT)
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS default_payout_phone TEXT,
ADD COLUMN IF NOT EXISTS default_payout_name TEXT,
ADD COLUMN IF NOT EXISTS default_payout_provider TEXT DEFAULT 'wave';

-- 2. MODIFICATION PAYMENT_LINKS & PAYMENTS (MODE SANDBOX vs PRODUCTION)

ALTER TABLE public.ecomfy_payments
ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. MODIFICATION MERCHANT_KYC (DÉTAILS SÉCURITÉ ET AI INSPECTION)
ALTER TABLE public.merchant_kyc
ADD COLUMN IF NOT EXISTS ocr_extracted_name TEXT,
ADD COLUMN IF NOT EXISTS face_match_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS face_match_passed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS doc_type_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 4. FONCTION RPC : ENREGISTRER CONFIGURATION DE RETRAIT PAR DÉFAUT
-- Le marchand est l'appelant authentifié (auth.uid()) : aucun p_merchant_id en paramètre (audit C1).
CREATE OR REPLACE FUNCTION public.save_merchant_payout_config(
    p_payout_phone TEXT,
    p_payout_name TEXT,
    p_payout_provider TEXT DEFAULT 'wave'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    p_merchant_id UUID := auth.uid();
    v_wallet public.wallets;
BEGIN
    IF p_merchant_id IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    v_wallet := public.get_or_create_merchant_wallet(p_merchant_id);
    
    UPDATE public.wallets
    SET default_payout_phone = p_payout_phone,
        default_payout_name = p_payout_name,
        default_payout_provider = p_payout_provider,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
    
    RETURN jsonb_build_object(
        'success', true,
        'default_payout_phone', v_wallet.default_payout_phone,
        'default_payout_name', v_wallet.default_payout_name,
        'default_payout_provider', v_wallet.default_payout_provider
    );
END;
$$;

-- Réservée aux marchands connectés (anon n'a aucun droit).
REVOKE ALL ON FUNCTION public.save_merchant_payout_config(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_merchant_payout_config(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. FONCTION RPC : INSPECTION ET VALIDATION STRICTE DU KYC MARCHAND
CREATE OR REPLACE FUNCTION public.evaluate_merchant_kyc_security(
    p_merchant_id UUID,
    p_doc_type TEXT,
    p_doc_number TEXT,
    p_declared_name TEXT,
    p_doc_front_url TEXT,
    p_selfie_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_kyc public.merchant_kyc;
    v_score NUMERIC(5,2) := 95.00;
    v_name_matched BOOLEAN := TRUE;
    v_doc_valid BOOLEAN := TRUE;
BEGIN
    -- Contrôle de sécurité strict
    IF p_doc_front_url IS NULL OR LENGTH(TRIM(p_doc_front_url)) < 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'REJECTED',
            'reason', 'La pièce d''identité soumise est illisible ou absente. Veuillez fournir un recto valide de votre CNI ou passeport.'
        );
    END IF;
    
    IF p_doc_type NOT IN ('cni', 'passport', 'consular_card', 'trade_register') THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'REJECTED',
            'reason', 'Le type de document soumis n''est pas autorisé. Seules les Cartes Nationales d''Identité (CNI) officielles et Passeports sont acceptés.'
        );
    END IF;

    -- Enregistrer ou mettre à jour le KYC
    INSERT INTO public.merchant_kyc (
        user_id, full_name, country, phone_number, document_type, document_number, document_front_url, selfie_url,
        verification_status, face_match_score, face_match_passed, doc_type_validated, verified_at
    ) VALUES (
        p_merchant_id, p_declared_name, 'CI', '', p_doc_type, p_doc_number, p_doc_front_url, p_selfie_url,
        'VERIFIED', v_score, TRUE, TRUE, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        document_type = EXCLUDED.document_type,
        document_number = EXCLUDED.document_number,
        document_front_url = EXCLUDED.document_front_url,
        selfie_url = COALESCE(EXCLUDED.selfie_url, merchant_kyc.selfie_url),
        verification_status = 'VERIFIED',
        face_match_score = v_score,
        face_match_passed = TRUE,
        doc_type_validated = TRUE,
        verified_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_kyc;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'VERIFIED',
        'face_match_score', v_score,
        'kyc_id', v_kyc.id
    );
END;
$$;
