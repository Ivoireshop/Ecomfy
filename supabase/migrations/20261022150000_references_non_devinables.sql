-- Audit M4 : références générées avec random() (devinables, collisions possibles sur contrainte UNIQUE).
-- Elles utilisent désormais gen_random_uuid() (aléa cryptographique, 12 caractères hexadécimaux = 48 bits).
-- Fonctions recréées à l'identique, seule la génération de la référence change (CREATE OR REPLACE conserve les droits).

-- 1. Facture de seuil de commandes (BILL-ECOMFY-…)
CREATE OR REPLACE FUNCTION public.check_and_trigger_billing_threshold(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actual_orders int;
  v_shop_status text;
  v_invoice_id uuid;
  v_invoice_num text;
  v_threshold int := 240;
  v_amount numeric := 12000;
  v_sub_until timestamptz;
  v_sub_plan text;
  v_is_sub boolean;
BEGIN
  IF _shop_id IS NULL THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'invalid_shop_id');
  END IF;

  SELECT shop_payment_status, subscription_active_until, subscription_plan, COALESCE(is_subscribed, false)
    INTO v_shop_status, v_sub_until, v_sub_plan, v_is_sub
    FROM public.shops
   WHERE id = _shop_id;

  -- Bypass threshold billing if shop has active subscription!
  IF (v_sub_until IS NOT NULL AND v_sub_until > now()) 
     OR (v_is_sub = true AND COALESCE(v_sub_plan, 'free') NOT IN ('free', 'starter_free')) THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'active_subscription');
  END IF;

  -- Count actual non-cancelled orders for shop
  SELECT COUNT(*) INTO v_actual_orders
    FROM public.orders
   WHERE shop_id = _shop_id;

  -- Check if threshold of 240 orders is reached
  IF v_actual_orders >= v_threshold THEN
    SELECT id INTO v_invoice_id
      FROM public.shop_invoices
     WHERE shop_id = _shop_id AND orders_threshold = v_threshold;

    IF v_invoice_id IS NULL THEN
      v_invoice_num := 'BILL-ECOMFY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

      INSERT INTO public.shop_invoices (
        invoice_number, shop_id, orders_threshold, amount, currency, status, due_date
      ) VALUES (
        v_invoice_num, _shop_id, v_threshold, v_amount, 'FCFA', 'PAYMENT_DUE', now() + interval '3 days'
      ) RETURNING id INTO v_invoice_id;

      UPDATE public.shops
         SET shop_payment_status = 'PAYMENT_DUE',
             payment_deadline = now() + interval '3 days',
             threshold_reached_at = now(),
             first_deadline_at = now() + interval '3 days',
             commission_balance_due = v_amount,
             updated_at = now()
       WHERE id = _shop_id;

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (_shop_id, 'BILLING_THRESHOLD_REACHED', v_amount, 'Seuil de 240 commandes atteint');

      RETURN jsonb_build_object('triggered', true, 'invoice_number', v_invoice_num, 'status', 'PAYMENT_DUE');
    END IF;
  END IF;

  RETURN jsonb_build_object('triggered', false, 'orders_count', v_actual_orders);
END $$;


-- 2. Confirmation de paiement de facture (PAY-ECOMFY-… quand aucune référence n'est fournie)
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_shop_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'online'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref text;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_shop_id');
  END IF;

  v_ref := COALESCE(p_payment_reference, 'PAY-ECOMFY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

  -- Update invoice status
  IF p_invoice_id IS NOT NULL THEN
    UPDATE public.shop_invoices
       SET status = 'PAYMENT_CONFIRMED',
           paid_at = now(),
           payment_reference = v_ref,
           payment_method = p_payment_method,
           reactivated_at = now()
     WHERE id = p_invoice_id AND shop_id = p_shop_id;
  ELSE
    UPDATE public.shop_invoices
       SET status = 'PAYMENT_CONFIRMED',
           paid_at = now(),
           payment_reference = v_ref,
           payment_method = p_payment_method,
           reactivated_at = now()
     WHERE shop_id = p_shop_id AND status != 'PAYMENT_CONFIRMED';
  END IF;

  -- Update shop status to STORE_ACTIVE with ZERO commission rate
  UPDATE public.shops
     SET shop_payment_status = 'STORE_ACTIVE',
         is_suspended = false,
         commission_rate = 0,
         is_subscribed = true,
         commission_balance_due = 0,
         payment_deadline = NULL,
         threshold_reached_at = NULL,
         first_deadline_at = NULL,
         locked_at = NULL,
         second_deadline_at = NULL,
         final_suspension_at = NULL,
         updated_at = now()
   WHERE id = p_shop_id;

  -- Unmark orders received during lock
  UPDATE public.orders
     SET received_during_lock = false,
         commission_amount = 0
   WHERE shop_id = p_shop_id;

  -- Log event
  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
  VALUES (
    p_shop_id, 
    'PAYMENT_CONFIRMED', 
    12000, 
    'Abonnement/Facture de 12 000 FCFA confirmé (Réf: ' || v_ref || ') — Pass 0 FCFA commission activé'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'shop_status', 'STORE_ACTIVE', 
    'message', 'Abonnement confirmé. Boutique activée sans commission (0 FCFA).'
  );
END $$;


-- 3. Demande de retrait Ecomfy Pay (ECM-WDR-… : 8 caractères issus de MD5(random()) avant, 12 maintenant)
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

    v_ref := 'ECM-WDR-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12));

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
