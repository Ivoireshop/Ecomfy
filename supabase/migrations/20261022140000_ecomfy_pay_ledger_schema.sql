-- ========================================================
-- ECOMFY PAY — LEDGER COMPLET (wallet_ledger)
--
-- Le registre existant ne portait qu'une référence texte libre (reference_id) : impossible de retrouver, pour une
-- écriture, le paiement, la commande, la boutique ou l'opérateur, et rien n'empêchait de le modifier ni de poster deux
-- fois la même écriture. Aucun code n'écrivait non plus la fin d'un retrait (réussi ou échoué) ni un remboursement.
-- Cette migration :
--   1. ajoute les colonnes de rattachement (paiement, règlement, retrait, commande, boutique, opérateur, frais) ;
--   2. les remplit pour les écritures existantes, puis automatiquement pour les nouvelles (trigger BEFORE INSERT) ;
--   3. verrouille les valeurs possibles (CHECK) et l'idempotence (index uniques partiels) ;
--   4. rend le registre réellement immuable (UPDATE interdit, DELETE interdit hors suppression en cascade d'un compte) ;
--   5. ajoute l'opérateur aux retraits (withdrawal_requests.payout_operator) ;
--   6. ajoute les deux écritures manquantes : finalize_withdrawal() (retrait terminé / échoué avec recrédit) et
--      refund_merchant_payment() (remboursement, total ou partiel).
--
-- Les colonnes de rattachement sont des instantanés SANS clé étrangère : le registre doit survivre à la suppression
-- d'une commande, d'une boutique ou d'un paiement.
-- ========================================================

-- 1. COLONNES
ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS entry_seq BIGINT,          -- ordre strict (created_at est identique pour un lot de règlements)
    ADD COLUMN IF NOT EXISTS internal_reference TEXT,   -- ECM-PAY-XXXXXXXX (paiement) ou ECM-WDR-XXXXXXXX (retrait)
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,   -- référence côté prestataire (GeniusPay, ...)
    ADD COLUMN IF NOT EXISTS provider TEXT,             -- 'geniuspay', 'wave', ...
    ADD COLUMN IF NOT EXISTS operator TEXT,             -- opérateur : 'orange_money', 'mtn', 'wave', 'moov', 'card'
    ADD COLUMN IF NOT EXISTS payment_id UUID,
    ADD COLUMN IF NOT EXISTS settlement_id UUID,
    ADD COLUMN IF NOT EXISTS withdrawal_id UUID,
    ADD COLUMN IF NOT EXISTS order_id UUID,
    ADD COLUMN IF NOT EXISTS order_number TEXT,
    ADD COLUMN IF NOT EXISTS shop_id UUID,
    ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS fee_provider NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS fee_ecomfy NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Sens de l'écriture, déduit du signe : CREDIT (+), DEBIT (−), NONE (0, écriture d'information : retrait abouti).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wallet_ledger' AND column_name = 'direction'
    ) THEN
        ALTER TABLE public.wallet_ledger ADD COLUMN direction TEXT GENERATED ALWAYS AS (
            CASE WHEN amount > 0 THEN 'CREDIT' WHEN amount < 0 THEN 'DEBIT' ELSE 'NONE' END
        ) STORED;
    END IF;
END;
$$;

ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS payout_operator TEXT;  -- 'wave', 'orange_money', 'mtn', 'moov'

-- 2. RATTACHEMENT DES ÉCRITURES EXISTANTES (avant la pose du verrou d'immuabilité)
UPDATE public.wallet_ledger l
SET payment_id = p.id,
    internal_reference = p.internal_reference,
    provider_reference = p.provider_reference,
    provider = p.provider,
    operator = p.payment_method,
    order_id = p.order_id,
    shop_id = p.shop_id,
    gross_amount = p.amount,
    fee_provider = p.fee_provider,
    fee_ecomfy = p.fee_ecomfy,
    is_sandbox = p.is_sandbox
FROM public.ecomfy_payments p
WHERE l.entry_type NOT LIKE 'WITHDRAWAL\_%'
  AND l.payment_id IS NULL
  AND l.reference_id IS NOT NULL
  AND (p.internal_reference = l.reference_id OR p.id::text = l.reference_id);

UPDATE public.wallet_ledger l
SET withdrawal_id = w.id,
    internal_reference = w.withdrawal_reference,
    provider = w.provider,
    provider_reference = w.provider_reference,
    operator = w.payout_operator
FROM public.withdrawal_requests w
WHERE l.entry_type LIKE 'WITHDRAWAL\_%'
  AND l.withdrawal_id IS NULL
  AND l.reference_id = w.withdrawal_reference;

UPDATE public.wallet_ledger l
SET settlement_id = s.id
FROM public.settlements s
WHERE l.payment_id IS NOT NULL AND l.settlement_id IS NULL AND s.payment_id = l.payment_id;

UPDATE public.wallet_ledger l
SET order_number = o.order_number
FROM public.orders o
WHERE l.order_id IS NOT NULL AND l.order_number IS NULL AND o.id = l.order_id;

-- Ordre strict : chronologique pour l'existant, puis séquence pour les nouvelles écritures.
CREATE SEQUENCE IF NOT EXISTS public.wallet_ledger_entry_seq;
UPDATE public.wallet_ledger l
SET entry_seq = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn FROM public.wallet_ledger WHERE entry_seq IS NULL) r
WHERE l.id = r.id;
SELECT setval('public.wallet_ledger_entry_seq', GREATEST((SELECT COALESCE(MAX(entry_seq), 0) FROM public.wallet_ledger), 1),
              (SELECT COUNT(*) > 0 FROM public.wallet_ledger));
ALTER TABLE public.wallet_ledger ALTER COLUMN entry_seq SET DEFAULT nextval('public.wallet_ledger_entry_seq');
ALTER TABLE public.wallet_ledger ALTER COLUMN entry_seq SET NOT NULL;
ALTER SEQUENCE public.wallet_ledger_entry_seq OWNED BY public.wallet_ledger.entry_seq;

-- 3. CONTRAINTES (NOT VALID : appliquées aux nouvelles écritures sans bloquer sur d'éventuelles anciennes lignes atypiques)
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_entry_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_entry_type_check CHECK (
    entry_type IN ('PAYMENT_PENDING', 'SETTLEMENT_AVAILABLE', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_COMPLETED',
                   'WITHDRAWAL_FAILED', 'REFUND', 'ADJUSTMENT')
) NOT VALID;

ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_balance_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_balance_type_check
    CHECK (balance_type IN ('PENDING', 'AVAILABLE')) NOT VALID;

-- Montant nul réservé à WITHDRAWAL_COMPLETED : le solde a déjà été débité à la demande, la fin du retrait n'en bouge plus.
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_amount_nonzero_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_amount_nonzero_check
    CHECK (amount <> 0 OR entry_type = 'WITHDRAWAL_COMPLETED') NOT VALID;

ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_running_balances_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_running_balances_check
    CHECK (running_pending_balance >= 0 AND running_available_balance >= 0) NOT VALID;

-- Volontairement aucune contrainte « une écriture de paiement doit avoir payment_id » : si le rattachement échouait,
-- le CHECK ferait échouer credit_merchant_wallet_pending et un paiement encaissé ne serait pas crédité.

-- 4. IDEMPOTENCE : une seule écriture de chaque type par paiement / par retrait (REFUND exclu : remboursements partiels possibles)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_payment_entry
    ON public.wallet_ledger (payment_id, entry_type)
    WHERE payment_id IS NOT NULL AND entry_type IN ('PAYMENT_PENDING', 'SETTLEMENT_AVAILABLE');
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_withdrawal_entry
    ON public.wallet_ledger (withdrawal_id, entry_type)
    WHERE withdrawal_id IS NOT NULL;
-- Un remboursement rejoué avec la même clé d'idempotence n'est inscrit qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_refund_key
    ON public.wallet_ledger (payment_id, (metadata ->> 'idempotency_key'))
    WHERE entry_type = 'REFUND' AND payment_id IS NOT NULL AND (metadata ->> 'idempotency_key') IS NOT NULL;

-- 5. INDEX DE LECTURE
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_entry_seq ON public.wallet_ledger (entry_seq);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_merchant_seq ON public.wallet_ledger (merchant_id, entry_seq DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_payment ON public.wallet_ledger (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_order ON public.wallet_ledger (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_shop ON public.wallet_ledger (shop_id, entry_seq DESC) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_reference ON public.wallet_ledger (internal_reference) WHERE internal_reference IS NOT NULL;

-- 6. RATTACHEMENT AUTOMATIQUE DES NOUVELLES ÉCRITURES
-- Les fonctions financières écrivent reference_id (référence interne ECM-PAY-… / ECM-WDR-…, ou id du paiement pour le
-- règlement) : le trigger en déduit paiement, commande, boutique, opérateur et frais. Un appelant peut aussi renseigner
-- payment_id / withdrawal_id directement.
CREATE OR REPLACE FUNCTION public.wallet_ledger_enrich()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay public.ecomfy_payments;
    v_wd public.withdrawal_requests;
BEGIN
    IF NEW.entry_type LIKE 'WITHDRAWAL\_%' THEN
        IF NEW.withdrawal_id IS NOT NULL THEN
            SELECT * INTO v_wd FROM public.withdrawal_requests WHERE id = NEW.withdrawal_id;
        ELSIF NEW.reference_id IS NOT NULL THEN
            SELECT * INTO v_wd FROM public.withdrawal_requests WHERE withdrawal_reference = NEW.reference_id;
        END IF;

        IF v_wd.id IS NOT NULL THEN
            NEW.withdrawal_id := v_wd.id;
            NEW.internal_reference := COALESCE(NEW.internal_reference, v_wd.withdrawal_reference);
            NEW.provider := COALESCE(NEW.provider, v_wd.provider);
            NEW.provider_reference := COALESCE(NEW.provider_reference, v_wd.provider_reference);
            NEW.operator := COALESCE(NEW.operator, v_wd.payout_operator);
            NEW.gross_amount := COALESCE(NEW.gross_amount, v_wd.amount);
        END IF;
    ELSE
        IF NEW.payment_id IS NOT NULL THEN
            SELECT * INTO v_pay FROM public.ecomfy_payments WHERE id = NEW.payment_id;
        ELSIF NEW.reference_id IS NOT NULL THEN
            SELECT * INTO v_pay FROM public.ecomfy_payments
            WHERE internal_reference = NEW.reference_id OR id::text = NEW.reference_id
            LIMIT 1;
        END IF;

        IF v_pay.id IS NOT NULL THEN
            NEW.payment_id := v_pay.id;
            NEW.internal_reference := COALESCE(NEW.internal_reference, v_pay.internal_reference);
            NEW.provider_reference := COALESCE(NEW.provider_reference, v_pay.provider_reference);
            NEW.provider := COALESCE(NEW.provider, v_pay.provider);
            NEW.operator := COALESCE(NEW.operator, v_pay.payment_method);
            NEW.order_id := COALESCE(NEW.order_id, v_pay.order_id);
            NEW.shop_id := COALESCE(NEW.shop_id, v_pay.shop_id);
            NEW.gross_amount := COALESCE(NEW.gross_amount, v_pay.amount);
            NEW.fee_provider := COALESCE(NEW.fee_provider, v_pay.fee_provider);
            NEW.fee_ecomfy := COALESCE(NEW.fee_ecomfy, v_pay.fee_ecomfy);
            NEW.is_sandbox := v_pay.is_sandbox;
            NEW.settlement_id := COALESCE(
                NEW.settlement_id,
                (SELECT s.id FROM public.settlements s WHERE s.payment_id = v_pay.id)
            );
        END IF;

        IF NEW.order_id IS NOT NULL AND NEW.order_number IS NULL THEN
            NEW.order_number := (SELECT o.order_number FROM public.orders o WHERE o.id = NEW.order_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_ledger_enrich() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS wallet_ledger_enrich ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_enrich
    BEFORE INSERT ON public.wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_enrich();

-- 7. IMMUABILITÉ
-- Aucune modification, jamais : une erreur se corrige par une écriture inverse (ADJUSTMENT / REFUND).
-- Suppression : refusée en direct, tolérée seulement quand elle découle de la suppression en cascade du portefeuille ou du
-- compte (le DELETE est alors exécuté depuis un trigger de clé étrangère : pg_trigger_depth() > 1).
CREATE OR REPLACE FUNCTION public.wallet_ledger_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'wallet_ledger est un registre immuable (% interdit) : passez une écriture corrective.', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS wallet_ledger_block_mutation ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_block_mutation
    BEFORE UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_block_mutation();

DROP TRIGGER IF EXISTS wallet_ledger_block_truncate ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_block_truncate
    BEFORE TRUNCATE ON public.wallet_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION public.wallet_ledger_block_mutation();

-- 8. DROITS : lecture seule pour les marchands (politique RLS "Merchants view own ledger" inchangée) ; les écritures
-- passent uniquement par les fonctions SECURITY DEFINER et service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.wallet_ledger FROM PUBLIC, anon, authenticated;

-- 9. RETRAIT : OPÉRATEUR EN PARAMÈTRE
-- Même corps que la version de 20260914190000, plus p_payout_operator. L'ancienne signature (6 paramètres) est retirée :
-- les appels par nom de l'Edge Function ecomfy-pay-withdraw continuent de fonctionner (le nouveau paramètre a une valeur par défaut).
DROP FUNCTION IF EXISTS public.request_wallet_withdrawal_atomic(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal_atomic(
    p_amount NUMERIC,
    p_payout_method TEXT,
    p_destination_phone TEXT DEFAULT NULL,
    p_destination_name TEXT DEFAULT NULL,
    p_destination_bank_iban TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'XOF',
    p_payout_operator TEXT DEFAULT NULL
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

    IF p_payout_operator IS NOT NULL AND p_payout_operator NOT IN ('wave', 'orange_money', 'mtn', 'moov') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Opérateur de retrait inconnu.');
    END IF;

    -- 0. Interrupteur global (audit C4) : retraits suspendus tant que la revue KYC n'est pas en place.
    IF COALESCE((SELECT (value)::text = 'true' FROM public.ecomfy_pay_settings WHERE key = 'withdrawals_enabled'), FALSE) IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Les retraits sont temporairement suspendus. Réessayez plus tard.');
    END IF;

    -- 1. Vérifier KYC (statut écrit uniquement par un relecteur : trigger merchant_kyc_guard_review_columns)
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
        withdrawal_reference, merchant_id, wallet_id, amount, currency, payout_method, payout_operator,
        destination_phone, destination_name, destination_bank_iban, status
    ) VALUES (
        v_ref, p_merchant_id, v_wallet.id, p_amount, p_currency, p_payout_method,
        CASE WHEN p_payout_method = 'mobile_money' THEN p_payout_operator ELSE NULL END,
        p_destination_phone, p_destination_name, p_destination_bank_iban, 'REQUESTED'
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

REVOKE ALL ON FUNCTION public.request_wallet_withdrawal_atomic(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal_atomic(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 10. FIN D'UN RETRAIT (appelée par le webhook de payout et par le dispatch, jamais par le navigateur)
--   SUCCEEDED : le retrait est abouti ; écriture d'information WITHDRAWAL_COMPLETED (montant 0, le solde a déjà été débité).
--   FAILED    : le prestataire n'a pas payé ; le montant retourne au solde disponible (WITHDRAWAL_FAILED, +montant).
-- Idempotente : rejouer le même statut ne change rien ; un statut contradictoire est refusé.
CREATE OR REPLACE FUNCTION public.finalize_withdrawal(
    p_withdrawal_reference TEXT,
    p_status TEXT,
    p_failure_reason TEXT DEFAULT NULL,
    p_provider_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wd public.withdrawal_requests;
    v_wallet public.wallets;
BEGIN
    IF p_status NOT IN ('SUCCEEDED', 'FAILED') THEN
        RAISE EXCEPTION 'Statut de retrait invalide : %', p_status USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_wd FROM public.withdrawal_requests WHERE withdrawal_reference = p_withdrawal_reference FOR UPDATE;
    IF v_wd.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Retrait introuvable.');
    END IF;

    IF v_wd.status IN ('SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED') THEN
        IF v_wd.status = p_status THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'status', v_wd.status);
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Retrait déjà clôturé avec le statut ' || v_wd.status || '.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE id = v_wd.wallet_id FOR UPDATE;

    IF p_status = 'SUCCEEDED' THEN
        UPDATE public.withdrawal_requests
        SET status = 'SUCCEEDED', processed_at = NOW(), failure_reason = NULL,
            provider_reference = COALESCE(p_provider_reference, provider_reference), updated_at = NOW()
        WHERE id = v_wd.id;

        INSERT INTO public.wallet_ledger (
            wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type,
            running_pending_balance, running_available_balance, withdrawal_id
        ) VALUES (
            v_wallet.id, v_wd.merchant_id, 'WITHDRAWAL_COMPLETED', 0, v_wd.currency, v_wd.withdrawal_reference,
            'Retrait abouti — fonds transférés vers ' || COALESCE(v_wd.destination_phone, v_wd.destination_name, 'compte marchand'),
            'AVAILABLE', v_wallet.pending_balance, v_wallet.available_balance, v_wd.id
        );
    ELSE
        UPDATE public.wallets
        SET available_balance = available_balance + v_wd.amount,
            total_withdrawn = GREATEST(0, total_withdrawn - v_wd.amount),
            updated_at = NOW()
        WHERE id = v_wallet.id
        RETURNING * INTO v_wallet;

        UPDATE public.withdrawal_requests
        SET status = 'FAILED', processed_at = NOW(), failure_reason = COALESCE(p_failure_reason, 'Refusé par le prestataire'),
            provider_reference = COALESCE(p_provider_reference, provider_reference), updated_at = NOW()
        WHERE id = v_wd.id;

        INSERT INTO public.wallet_ledger (
            wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type,
            running_pending_balance, running_available_balance, withdrawal_id, metadata
        ) VALUES (
            v_wallet.id, v_wd.merchant_id, 'WITHDRAWAL_FAILED', v_wd.amount, v_wd.currency, v_wd.withdrawal_reference,
            'Retrait échoué — montant recrédité sur le solde disponible',
            'AVAILABLE', v_wallet.pending_balance, v_wallet.available_balance, v_wd.id,
            jsonb_build_object('failure_reason', COALESCE(p_failure_reason, 'Refusé par le prestataire'))
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', p_status,
        'withdrawal_id', v_wd.id,
        'available_balance', v_wallet.available_balance
    );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_withdrawal(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_withdrawal(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 11. REMBOURSEMENT D'UN PAIEMENT (total ou partiel), à appeler côté serveur une fois le remboursement fait chez le prestataire
-- p_amount = part NETTE marchand à reprendre (NULL = tout ce qui reste). Elle est prélevée sur le solde en attente tant que le
-- règlement n'est pas libéré, sinon sur le solde disponible (refus si les fonds ont déjà été retirés).
-- p_idempotency_key : une même clé ne rembourse qu'une fois (rejeu du webhook / de l'appel).
CREATE OR REPLACE FUNCTION public.refund_merchant_payment(
    p_payment_id UUID,
    p_amount NUMERIC DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay public.ecomfy_payments;
    v_set public.settlements;
    v_wallet public.wallets;
    v_already NUMERIC;
    v_remaining NUMERIC;
    v_amount NUMERIC;
    v_balance_type TEXT;
BEGIN
    SELECT * INTO v_pay FROM public.ecomfy_payments WHERE id = p_payment_id FOR UPDATE;
    IF v_pay.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable.');
    END IF;

    IF p_idempotency_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.wallet_ledger
        WHERE payment_id = v_pay.id AND entry_type = 'REFUND' AND metadata ->> 'idempotency_key' = p_idempotency_key
    ) THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;

    IF v_pay.status NOT IN ('SUCCEEDED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seul un paiement réussi peut être remboursé (statut : ' || v_pay.status || ').');
    END IF;

    SELECT * INTO v_set FROM public.settlements WHERE payment_id = v_pay.id FOR UPDATE;
    IF v_set.id IS NULL OR v_set.status = 'REVERSED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ce paiement n''a pas été crédité au portefeuille ou est déjà annulé.');
    END IF;

    SELECT COALESCE(SUM(-amount), 0) INTO v_already
    FROM public.wallet_ledger WHERE payment_id = v_pay.id AND entry_type = 'REFUND';
    v_remaining := v_pay.net_merchant_amount - v_already;
    v_amount := COALESCE(p_amount, v_remaining);

    IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_remaining THEN
        RETURN jsonb_build_object('success', false, 'error', 'Montant de remboursement invalide (reste remboursable : ' || v_remaining || ').');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = v_set.merchant_id FOR UPDATE;

    IF v_set.status = 'PENDING' THEN
        v_balance_type := 'PENDING';
        IF v_wallet.pending_balance < v_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Solde en attente insuffisant pour ce remboursement.');
        END IF;
        UPDATE public.wallets
        SET pending_balance = pending_balance - v_amount, total_received = GREATEST(0, total_received - v_amount), updated_at = NOW()
        WHERE id = v_wallet.id RETURNING * INTO v_wallet;
        -- Le règlement en attente ne libérera plus que le reste (process_wallet_settlements lit net_amount).
        UPDATE public.settlements
        SET net_amount = net_amount - v_amount,
            status = CASE WHEN v_amount = v_remaining THEN 'REVERSED' ELSE status END
        WHERE id = v_set.id;
    ELSE
        v_balance_type := 'AVAILABLE';
        IF v_wallet.available_balance < v_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Solde disponible insuffisant : les fonds ont déjà été retirés.');
        END IF;
        UPDATE public.wallets
        SET available_balance = available_balance - v_amount, total_received = GREATEST(0, total_received - v_amount), updated_at = NOW()
        WHERE id = v_wallet.id RETURNING * INTO v_wallet;
    END IF;

    INSERT INTO public.wallet_ledger (
        wallet_id, merchant_id, entry_type, amount, currency, reference_id, description, balance_type,
        running_pending_balance, running_available_balance, payment_id, metadata
    ) VALUES (
        v_wallet.id, v_wallet.merchant_id, 'REFUND', -v_amount, v_pay.currency, v_pay.internal_reference,
        CASE WHEN v_amount = v_remaining AND v_already = 0 THEN 'Remboursement total du paiement'
             WHEN v_amount = v_remaining THEN 'Remboursement final du paiement'
             ELSE 'Remboursement partiel du paiement' END
            || COALESCE(' — ' || p_reason, ''),
        v_balance_type, v_wallet.pending_balance, v_wallet.available_balance, v_pay.id,
        jsonb_strip_nulls(jsonb_build_object('reason', p_reason, 'idempotency_key', p_idempotency_key))
    );

    IF v_amount = v_remaining THEN
        UPDATE public.ecomfy_payments SET status = 'REFUNDED', updated_at = NOW() WHERE id = v_pay.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'refunded', v_amount,
        'remaining_refundable', v_remaining - v_amount,
        'pending_balance', v_wallet.pending_balance,
        'available_balance', v_wallet.available_balance
    );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_merchant_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_merchant_payment(UUID, NUMERIC, TEXT, TEXT) TO service_role;
