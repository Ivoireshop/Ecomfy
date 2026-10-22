-- Test de comportement du ledger Ecomfy Pay (migration 20261022140000 déjà appliquée).
-- Base de DEV uniquement : il crée des paiements factices pour le marchand du premier paiement, exerce crédit, règlement,
-- remboursements, retraits, immuabilité et droits, puis se termine par RAISE EXCEPTION portant le rapport : tout est annulé.
-- Lancer : supabase db query --linked -f supabase/tests/ecomfy_pay_ledger.sql   (attendu : « (0 échecs) », 33 lignes PASS)
-- Prérequis : au moins un paiement dans ecomfy_payments ; la migration ne doit pas avoir été appliquée à vide sur une base sans paiement.

-- ===== TESTS (tout est annulé : le dernier DO se termine par une exception portant le rapport) =====
CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
    v_m uuid; v_shop uuid; v_order uuid; v_onum text;
    v_w public.wallets; v_p1 uuid; v_p2 uuid; v_p3 uuid; r jsonb; l public.wallet_ledger; n int;
    v_wd1 text; v_wd2 text; v_last public.wallet_ledger; v_err text; v_before numeric; v_state text;
BEGIN
    SELECT merchant_id, shop_id INTO v_m, v_shop FROM public.ecomfy_payments LIMIT 1;
    SELECT id, order_number INTO v_order, v_onum FROM public.orders WHERE shop_id = v_shop LIMIT 1;
    PERFORM pg_temp.chk('contexte', v_m IS NOT NULL, 'merchant=' || v_m || ' shop=' || v_shop || ' order=' || COALESCE(v_onum, 'aucune'));
    v_w := public.get_or_create_merchant_wallet(v_m);

    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_provider, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-TEST0001', v_m, v_shop, v_order, 'orange_money', 'geniuspay', 10000, 200, 100, 9700, 'SUCCEEDED') RETURNING id INTO v_p1;
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, fee_provider, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-TEST0002', v_m, v_shop, 'wave', 'geniuspay', 5000, 100, 50, 4850, 'SUCCEEDED') RETURNING id INTO v_p2;
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, net_merchant_amount, status)
    VALUES ('ECM-PAY-TEST0003', v_m, v_shop, 'mtn', 'geniuspay', 3000, 2900, 'SUCCEEDED') RETURNING id INTO v_p3;

    -- 1. Crédit en attente : rattachement automatique
    r := public.credit_merchant_wallet_pending(v_m, v_p1, 10000, 9700, 'XOF', 0, 'ECM-PAY-TEST0001');
    PERFORM pg_temp.chk('credit ok', (r->>'success')::bool, r::text);
    SELECT * INTO l FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('PAYMENT_PENDING rattaché', l.id IS NOT NULL AND l.operator = 'orange_money' AND l.shop_id = v_shop
        AND (l.order_id IS NOT NULL) = (v_order IS NOT NULL) AND l.order_number IS NOT DISTINCT FROM v_onum
        AND l.gross_amount = 10000 AND l.fee_provider = 200 AND l.fee_ecomfy = 100 AND l.internal_reference = 'ECM-PAY-TEST0001'
        AND l.settlement_id IS NOT NULL AND l.direction = 'CREDIT' AND l.amount = 9700 AND l.entry_seq IS NOT NULL AND l.is_sandbox = false,
        format('op=%s shop=%s order=%s gross=%s fees=%s/%s ref=%s settl=%s dir=%s seq=%s', l.operator, l.shop_id, l.order_number, l.gross_amount, l.fee_provider, l.fee_ecomfy, l.internal_reference, l.settlement_id, l.direction, l.entry_seq));

    r := public.credit_merchant_wallet_pending(v_m, v_p1, 10000, 9700, 'XOF', 0, 'ECM-PAY-TEST0001');
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('credit rejoué = doublon ignoré', (r->>'duplicate')::bool AND n = 1, r::text || ' n=' || n);

    r := public.credit_merchant_wallet_pending(v_m, v_p2, 5000, 4850, 'XOF', 0, 'ECM-PAY-TEST0002');
    r := public.credit_merchant_wallet_pending(v_m, v_p3, 3000, 2900, 'XOF', 72, 'ECM-PAY-TEST0003');  -- reste en attente (72 h)

    -- 2. Règlement (p1 et p2 libérés, p3 reste en attente)
    n := public.process_wallet_settlements();
    PERFORM pg_temp.chk('règlements libérés (>=2)', n >= 2, 'n=' || n);
    SELECT * INTO l FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'SETTLEMENT_AVAILABLE';
    PERFORM pg_temp.chk('SETTLEMENT_AVAILABLE rattaché', l.id IS NOT NULL AND l.operator = 'orange_money' AND l.shop_id = v_shop AND l.internal_reference = 'ECM-PAY-TEST0001' AND l.balance_type = 'AVAILABLE',
        format('op=%s ref=%s', l.operator, l.internal_reference));

    -- 3. Remboursements sur fonds disponibles (partiel, rejoué, trop grand, final)
    r := public.refund_merchant_payment(v_p1, 2000, 'client mécontent', 'k1');
    PERFORM pg_temp.chk('remboursement partiel', (r->>'success')::bool AND (r->>'refunded')::numeric = 2000 AND (r->>'remaining_refundable')::numeric = 7700, r::text);
    SELECT * INTO l FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'REFUND';
    PERFORM pg_temp.chk('REFUND ligne', l.amount = -2000 AND l.direction = 'DEBIT' AND l.balance_type = 'AVAILABLE' AND l.operator = 'orange_money' AND l.metadata->>'idempotency_key' = 'k1',
        format('amount=%s bt=%s meta=%s', l.amount, l.balance_type, l.metadata));
    r := public.refund_merchant_payment(v_p1, 2000, 'client mécontent', 'k1');
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'REFUND';
    PERFORM pg_temp.chk('remboursement rejoué (même clé) ignoré', (r->>'duplicate')::bool AND n = 1, r::text);
    r := public.refund_merchant_payment(v_p1, 99999, 'trop', 'k2');
    PERFORM pg_temp.chk('remboursement trop grand refusé', NOT (r->>'success')::bool, r::text);
    PERFORM pg_temp.chk('statut inchangé après partiel', (SELECT status FROM public.ecomfy_payments WHERE id = v_p1) = 'SUCCEEDED');
    r := public.refund_merchant_payment(v_p1, NULL, 'solde', 'k3');
    PERFORM pg_temp.chk('remboursement final', (r->>'success')::bool AND (r->>'remaining_refundable')::numeric = 0, r::text);
    PERFORM pg_temp.chk('paiement REFUNDED', (SELECT status FROM public.ecomfy_payments WHERE id = v_p1) = 'REFUNDED');
    r := public.refund_merchant_payment(v_p1, 1, 'encore', 'k4');
    PERFORM pg_temp.chk('re-remboursement refusé', NOT (r->>'success')::bool, r::text);

    -- 3 bis. Remboursement sur règlement encore en attente : partiel puis final, le règlement ne libère que le reste
    SELECT pending_balance INTO v_before FROM public.wallets WHERE id = v_w.id;
    r := public.refund_merchant_payment(v_p3, 900, 'partiel attente', 'p3a');
    SELECT * INTO l FROM public.wallet_ledger WHERE payment_id = v_p3 AND entry_type = 'REFUND';
    PERFORM pg_temp.chk('remboursement sur attente : PENDING débité', (r->>'success')::bool AND l.balance_type = 'PENDING'
        AND (SELECT pending_balance FROM public.wallets WHERE id = v_w.id) = v_before - 900
        AND (SELECT net_amount FROM public.settlements WHERE payment_id = v_p3) = 2000, r::text);
    r := public.refund_merchant_payment(v_p3, NULL, 'solde attente', 'p3b');
    PERFORM pg_temp.chk('remboursement final sur attente : règlement REVERSED',
        (r->>'success')::bool AND (SELECT status FROM public.settlements WHERE payment_id = v_p3) = 'REVERSED'
        AND (SELECT status FROM public.ecomfy_payments WHERE id = v_p3) = 'REFUNDED', r::text);

    -- 4. Retraits : opérateur, échec (recrédit), réussite
    UPDATE public.ecomfy_pay_settings SET value = 'true'::jsonb WHERE key = 'withdrawals_enabled';
    IF EXISTS (SELECT 1 FROM public.merchant_kyc WHERE user_id = v_m) THEN
        UPDATE public.merchant_kyc SET verification_status = 'VERIFIED' WHERE user_id = v_m;
    ELSE
        INSERT INTO public.merchant_kyc (user_id, full_name, phone_number, document_type, document_number, document_front_url, verification_status)
        VALUES (v_m, 'Test', '0700000000', 'cni', 'X', 'x', 'VERIFIED');
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_m, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_m::text, true);

    SELECT available_balance INTO v_before FROM public.wallets WHERE id = v_w.id;
    r := public.request_wallet_withdrawal_atomic(3000, 'mobile_money', '0700000000', 'Test', NULL, 'XOF', 'wave');
    PERFORM pg_temp.chk('retrait demandé', (r->>'success')::bool, r::text);
    v_wd1 := r->>'withdrawal_reference';
    SELECT * INTO l FROM public.wallet_ledger WHERE entry_type = 'WITHDRAWAL_REQUESTED' AND reference_id = v_wd1;
    PERFORM pg_temp.chk('WITHDRAWAL_REQUESTED rattaché', l.withdrawal_id IS NOT NULL AND l.operator = 'wave' AND l.internal_reference = v_wd1 AND l.gross_amount = 3000 AND l.direction = 'DEBIT' AND l.amount = -3000,
        format('wd=%s op=%s ref=%s', l.withdrawal_id, l.operator, l.internal_reference));
    r := public.request_wallet_withdrawal_atomic(100, 'mobile_money', '0700000000', 'Test', NULL, 'XOF', 'paypal');
    PERFORM pg_temp.chk('opérateur inconnu refusé', NOT (r->>'success')::bool, r::text);

    -- finalize : appelé comme le ferait service_role (pas de claims utilisateur nécessaires)
    r := public.finalize_withdrawal(v_wd1, 'FAILED', 'numéro invalide', 'GP-1');
    PERFORM pg_temp.chk('retrait échoué : succès + recrédit', (r->>'success')::bool
        AND (SELECT available_balance FROM public.wallets WHERE id = v_w.id) = v_before
        AND (SELECT status FROM public.withdrawal_requests WHERE withdrawal_reference = v_wd1) = 'FAILED', r::text);
    SELECT * INTO l FROM public.wallet_ledger WHERE entry_type = 'WITHDRAWAL_FAILED' AND reference_id = v_wd1;
    PERFORM pg_temp.chk('WITHDRAWAL_FAILED ligne', l.amount = 3000 AND l.direction = 'CREDIT' AND l.operator = 'wave' AND l.metadata->>'failure_reason' = 'numéro invalide' AND l.running_available_balance = v_before,
        format('amount=%s run=%s meta=%s', l.amount, l.running_available_balance, l.metadata));
    r := public.finalize_withdrawal(v_wd1, 'FAILED');
    PERFORM pg_temp.chk('finalize rejoué = doublon', (r->>'duplicate')::bool, r::text);
    r := public.finalize_withdrawal(v_wd1, 'SUCCEEDED');
    PERFORM pg_temp.chk('finalize contradictoire refusé', NOT (r->>'success')::bool, r::text);

    r := public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '0700000000', 'Test', NULL, 'XOF', 'orange_money');
    v_wd2 := r->>'withdrawal_reference';
    SELECT available_balance INTO v_before FROM public.wallets WHERE id = v_w.id;
    r := public.finalize_withdrawal(v_wd2, 'SUCCEEDED', NULL, 'GP-2');
    SELECT * INTO l FROM public.wallet_ledger WHERE entry_type = 'WITHDRAWAL_COMPLETED' AND reference_id = v_wd2;
    PERFORM pg_temp.chk('retrait abouti : écriture à 0, solde inchangé', (r->>'success')::bool AND l.amount = 0 AND l.direction = 'NONE' AND l.gross_amount = 1000 AND l.operator = 'orange_money'
        AND (SELECT available_balance FROM public.wallets WHERE id = v_w.id) = v_before, format('amount=%s dir=%s gross=%s', l.amount, l.direction, l.gross_amount));

    -- 5. Cohérence : dernier solde courant du registre = soldes du portefeuille
    SELECT * INTO v_last FROM public.wallet_ledger WHERE wallet_id = v_w.id ORDER BY entry_seq DESC LIMIT 1;
    SELECT * INTO v_w FROM public.wallets WHERE id = v_w.id;
    PERFORM pg_temp.chk('soldes courants = soldes du portefeuille', v_last.running_pending_balance = v_w.pending_balance AND v_last.running_available_balance = v_w.available_balance,
        format('ledger %s/%s wallet %s/%s', v_last.running_pending_balance, v_last.running_available_balance, v_w.pending_balance, v_w.available_balance));
    PERFORM pg_temp.chk('entry_seq croissant', (SELECT bool_and(s) FROM (SELECT entry_seq > lag(entry_seq) OVER (ORDER BY entry_seq) s FROM public.wallet_ledger WHERE wallet_id = v_w.id) x WHERE s IS NOT NULL));

    -- 6. Immuabilité et droits
    BEGIN UPDATE public.wallet_ledger SET description = 'x' WHERE id = l.id; PERFORM pg_temp.chk('UPDATE refusé', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.chk('UPDATE refusé', true, SQLERRM); END;
    BEGIN DELETE FROM public.wallet_ledger WHERE id = l.id; PERFORM pg_temp.chk('DELETE refusé', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.chk('DELETE refusé', true, SQLERRM); END;
    BEGIN TRUNCATE public.wallet_ledger; PERFORM pg_temp.chk('TRUNCATE refusé', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.chk('TRUNCATE refusé', true, SQLERRM); END;

    BEGIN
        SET LOCAL ROLE authenticated;
        INSERT INTO public.wallet_ledger (wallet_id, merchant_id, entry_type, amount, description, running_pending_balance, running_available_balance)
        VALUES (v_w.id, v_m, 'ADJUSTMENT', 1, 'fraude', 0, 0);
        RESET ROLE; PERFORM pg_temp.chk('INSERT par authenticated refusé', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; PERFORM pg_temp.chk('INSERT par authenticated refusé', true, SQLERRM); END;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.finalize_withdrawal(v_wd2, 'FAILED');
        RESET ROLE; PERFORM pg_temp.chk('finalize_withdrawal refusée à authenticated', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; PERFORM pg_temp.chk('finalize_withdrawal refusée à authenticated', true, SQLERRM); END;
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.refund_merchant_payment(v_p2, 1);
        RESET ROLE; PERFORM pg_temp.chk('refund_merchant_payment refusée à authenticated', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; PERFORM pg_temp.chk('refund_merchant_payment refusée à authenticated', true, SQLERRM); END;

    -- Un marchand lit toujours son registre (RLS)
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.wallet_ledger;
    RESET ROLE;
    PERFORM pg_temp.chk('RLS : le marchand lit ses écritures', n > 0, 'n=' || n);
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RESET ROLE;
    PERFORM pg_temp.chk('ERREUR INATTENDUE', false, v_err);
END;
$$;

DO $$
DECLARE v_report text;
BEGIN
    SELECT string_agg(format('%s %s%s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, label, CASE WHEN ok AND detail = '' THEN '' ELSE ' — ' || detail END), E'\n' ORDER BY n)
    INTO v_report FROM _t;
    RAISE EXCEPTION E'RAPPORT\n%\n(% échecs)', v_report, (SELECT count(*) FROM _t WHERE NOT ok);
END;
$$;
