-- Test de comportement de confirm_ecomfy_payment (migration 20261023100000 déjà appliquée).
-- Base de DEV uniquement : crée des paiements factices sur une boutique existante, exerce succès, rejeu, montant, annulation
-- en bloc, portefeuille gelé, balayage, échec et droits, puis se termine par RAISE EXCEPTION portant le rapport : tout est annulé.
-- Lancer : supabase db query --linked -f supabase/tests/ecomfy_pay_confirm.sql   (attendu : « (0 échecs) »)
-- Prérequis : une boutique avec au moins 5 commandes non payées.

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'panne simulée du règlement'; END $$;

DO $$
DECLARE
    v_m uuid; v_shop uuid; v_o1 uuid; v_o2 uuid; v_o3 uuid; v_o4 uuid; v_o5 uuid;
    v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid;
    r jsonb; n int; s text; v_w public.wallets; v_pending numeric; v_err text; v_ev public.payment_events;
BEGIN
    SELECT shop_id INTO v_shop FROM public.orders WHERE payment_status <> 'paid' GROUP BY shop_id HAVING count(*) >= 5 LIMIT 1;
    SELECT user_id INTO v_m FROM public.shops WHERE id = v_shop;
    SELECT (array_agg(id))[1], (array_agg(id))[2], (array_agg(id))[3], (array_agg(id))[4], (array_agg(id))[5]
      INTO v_o1, v_o2, v_o3, v_o4, v_o5
      FROM (SELECT id FROM public.orders WHERE shop_id = v_shop AND payment_status <> 'paid' LIMIT 5) o;
    PERFORM pg_temp.chk('contexte', v_m IS NOT NULL AND v_o5 IS NOT NULL, 'merchant=' || v_m || ' shop=' || v_shop);
    v_w := public.get_or_create_merchant_wallet(v_m);

    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00001', v_m, v_shop, v_o1, 'wave', 'geniuspay', 10000, 250, 9750, 'PENDING') RETURNING id INTO v_p1;
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00002', v_m, v_shop, v_o2, 'mtn', 'geniuspay', 6000, 150, 5850, 'PENDING') RETURNING id INTO v_p2;
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00003', v_m, v_shop, v_o3, 'orange_money', 'geniuspay', 4000, 100, 3900, 'PENDING') RETURNING id INTO v_p3;

    -- 1. Succès : paiement, commande et crédit d'un coup
    SELECT pending_balance INTO v_pending FROM public.wallets WHERE merchant_id = v_m;
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00001', 'PROV-1', 'SUCCEEDED', 10000, 'XOF', 'evt-1', 'payment.success', '{"a":1}');
    PERFORM pg_temp.chk('succès : étapes updated/updated/done',
        (r->>'success')::bool AND r#>>'{steps,payment}' = 'updated' AND r#>>'{steps,order}' = 'updated' AND r#>>'{steps,credit}' = 'done', r::text);
    SELECT status INTO s FROM public.ecomfy_payments WHERE id = v_p1;
    PERFORM pg_temp.chk('paiement SUCCEEDED + référence prestataire', s = 'SUCCEEDED' AND (SELECT provider_reference FROM public.ecomfy_payments WHERE id = v_p1) = 'PROV-1', s);
    SELECT payment_status INTO s FROM public.orders WHERE id = v_o1;
    PERFORM pg_temp.chk('commande payée (minuscules)', s = 'paid', s);
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('une écriture PAYMENT_PENDING + un règlement', n = 1 AND EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = v_p1), 'n=' || n);
    PERFORM pg_temp.chk('solde en attente +9750', (SELECT pending_balance FROM public.wallets WHERE merchant_id = v_m) = v_pending + 9750,
        (SELECT pending_balance FROM public.wallets WHERE merchant_id = v_m)::text);
    SELECT * INTO v_ev FROM public.payment_events WHERE provider = 'geniuspay' AND event_id = 'evt-1';
    PERFORM pg_temp.chk('événement journalisé PROCESSED', v_ev.id IS NOT NULL AND v_ev.processing_status = 'PROCESSED' AND v_ev.payment_id = v_p1, v_ev.processing_status);

    -- 2. Rejeu de la même livraison : rien ne bouge
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00001', 'PROV-1', 'SUCCEEDED', 10000, 'XOF', 'evt-1', 'payment.success', '{"a":1}');
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id = v_p1 AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('rejeu : already_processed, aucun second crédit',
        (r->>'success')::bool AND (r->>'already_processed')::bool AND r#>>'{steps,credit}' = 'already' AND n = 1
        AND (SELECT pending_balance FROM public.wallets WHERE merchant_id = v_m) = v_pending + 9750, r::text);
    SELECT count(*) INTO n FROM public.payment_events WHERE provider = 'geniuspay' AND event_id = 'evt-1';
    PERFORM pg_temp.chk('rejeu : un seul événement', n = 1, 'n=' || n);
    -- Rejeu sans montant distant (balayage / appel manuel) sur un paiement déjà confirmé
    r := public.confirm_ecomfy_payment(p_internal_reference := 'ECM-PAY-CNF00001');
    PERFORM pg_temp.chk('rejeu sans montant distant accepté si SUCCEEDED', (r->>'success')::bool AND (r->>'already_processed')::bool, r::text);
    -- Recherche par référence du prestataire
    r := public.confirm_ecomfy_payment(p_provider_reference := 'PROV-1', p_remote_amount := 10000);
    PERFORM pg_temp.chk('recherche par référence prestataire', (r->>'success')::bool AND r->>'internal_reference' = 'ECM-PAY-CNF00001', r::text);

    -- 3. Montant et devise (C6)
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00002', 'PROV-2', 'SUCCEEDED', 100, 'XOF', 'evt-2a');
    SELECT status INTO s FROM public.ecomfy_payments WHERE id = v_p2;
    PERFORM pg_temp.chk('montant falsifié refusé, rien ne bouge', NOT (r->>'success')::bool AND s = 'PENDING'
        AND (SELECT payment_status FROM public.orders WHERE id = v_o2) <> 'paid'
        AND NOT EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = v_p2), r::text);
    PERFORM pg_temp.chk('événement AMOUNT_MISMATCH', (SELECT processing_status FROM public.payment_events WHERE event_id = 'evt-2a') = 'AMOUNT_MISMATCH');
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00002', 'PROV-2', 'SUCCEEDED', NULL, NULL, 'evt-2b');
    PERFORM pg_temp.chk('montant absent refusé tant que PENDING', NOT (r->>'success')::bool, r::text);
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00002', 'PROV-2', 'SUCCEEDED', 6000, 'EUR', 'evt-2c');
    PERFORM pg_temp.chk('devise différente refusée', NOT (r->>'success')::bool, r::text);
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00002', 'PROV-2', 'SUCCEEDED', 6000.4, 'xof', 'evt-2d');
    PERFORM pg_temp.chk('tolérance de 1 FCFA et devise insensible à la casse', (r->>'success')::bool AND r#>>'{steps,credit}' = 'done', r::text);

    -- 4. Tout ou rien : un incident au crédit annule paiement et commande, puis le rejeu aboutit
    EXECUTE 'CREATE TRIGGER trg_boom BEFORE INSERT ON public.settlements FOR EACH ROW EXECUTE FUNCTION pg_temp.boom()';
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00003', 'PROV-3', 'SUCCEEDED', 4000, 'XOF', 'evt-3');
    SELECT status INTO s FROM public.ecomfy_payments WHERE id = v_p3;
    PERFORM pg_temp.chk('panne : succès=false, retryable', NOT (r->>'success')::bool AND (r->>'retryable')::bool, r::text);
    PERFORM pg_temp.chk('panne : paiement resté PENDING, commande non payée, aucun crédit',
        s = 'PENDING' AND (SELECT payment_status FROM public.orders WHERE id = v_o3) <> 'paid'
        AND NOT EXISTS (SELECT 1 FROM public.wallet_ledger WHERE payment_id = v_p3), s);
    SELECT * INTO v_ev FROM public.payment_events WHERE event_id = 'evt-3';
    PERFORM pg_temp.chk('panne : erreur journalisée (ERROR), livraison non écartée', v_ev.processing_status = 'ERROR' AND v_ev.error_message LIKE '%panne simulée%', COALESCE(v_ev.error_message, '?'));
    EXECUTE 'DROP TRIGGER trg_boom ON public.settlements';
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00003', 'PROV-3', 'SUCCEEDED', 4000, 'XOF', 'evt-3');
    PERFORM pg_temp.chk('même livraison rejouée après la panne : tout aboutit',
        (r->>'success')::bool AND r#>>'{steps,payment}' = 'updated' AND r#>>'{steps,order}' = 'updated' AND r#>>'{steps,credit}' = 'done', r::text);
    PERFORM pg_temp.chk('événement repassé en PROCESSED', (SELECT processing_status FROM public.payment_events WHERE event_id = 'evt-3') = 'PROCESSED');

    -- 5. Portefeuille gelé : encaissement acquis, crédit en attente, rejoué par le balayage après le dégel
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00004', v_m, v_shop, v_o4, 'moov', 'geniuspay', 2000, 50, 1950, 'PENDING') RETURNING id INTO v_p4;
    UPDATE public.wallets SET is_frozen = true WHERE merchant_id = v_m;
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00004', 'PROV-4', 'SUCCEEDED', 2000, 'XOF', 'evt-4');
    PERFORM pg_temp.chk('gelé : success=false, pending_replay', NOT (r->>'success')::bool AND (r->>'pending_replay')::bool AND r#>>'{steps,credit}' = 'blocked', r::text);
    PERFORM pg_temp.chk('gelé : paiement SUCCEEDED et commande payée, aucun crédit',
        (SELECT status FROM public.ecomfy_payments WHERE id = v_p4) = 'SUCCEEDED' AND (SELECT payment_status FROM public.orders WHERE id = v_o4) = 'paid'
        AND NOT EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = v_p4));
    PERFORM pg_temp.chk('gelé : événement CREDIT_BLOCKED', (SELECT processing_status FROM public.payment_events WHERE event_id = 'evt-4') = 'CREDIT_BLOCKED');
    r := public.replay_incomplete_ecomfy_payments(50);
    PERFORM pg_temp.chk('balayage tant que gelé : bloqué, pas d''erreur', (r->>'blocked')::int >= 1 AND NOT EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = v_p4), r::text);
    UPDATE public.wallets SET is_frozen = false WHERE merchant_id = v_m;
    r := public.replay_incomplete_ecomfy_payments(50);
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id = v_p4 AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('balayage après dégel : crédit inscrit une fois', (r->>'completed')::int >= 1 AND n = 1, r::text || ' n=' || n);
    r := public.replay_incomplete_ecomfy_payments(50);
    PERFORM pg_temp.chk('balayage suivant : plus rien à faire', (r->>'examined')::int = 0, r::text);

    -- 6. Paiement resté SUCCEEDED sans crédit ni commande payée (état laissé par l'ancien webhook) : le balayage le termine
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, order_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00005', v_m, v_shop, v_o5, 'wave', 'geniuspay', 3000, 75, 2925, 'SUCCEEDED') RETURNING id INTO v_p5;
    r := public.replay_incomplete_ecomfy_payments(50);
    PERFORM pg_temp.chk('état hérité réparé : crédit + commande payée',
        (r->>'completed')::int >= 1 AND EXISTS (SELECT 1 FROM public.settlements WHERE payment_id = v_p5)
        AND (SELECT payment_status FROM public.orders WHERE id = v_o5) = 'paid', r::text);

    -- 7. Échecs : n'affectent que les paiements non encaissés
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, net_merchant_amount, status)
    VALUES ('ECM-PAY-CNF00006', v_m, v_shop, 'wave', 'geniuspay', 1000, 970, 'PENDING');
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00006', NULL, 'FAILED', p_event_id := 'evt-6', p_failure_reason := 'refusé');
    PERFORM pg_temp.chk('échec : PENDING → FAILED', (r->>'success')::bool AND r->>'status' = 'FAILED'
        AND (SELECT status FROM public.ecomfy_payments WHERE internal_reference = 'ECM-PAY-CNF00006') = 'FAILED', r::text);
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00001', NULL, 'FAILED', p_event_id := 'evt-7');
    PERFORM pg_temp.chk('échec tardif ignoré sur un paiement encaissé', r#>>'{steps,payment}' = 'ignored'
        AND (SELECT status FROM public.ecomfy_payments WHERE id = v_p1) = 'SUCCEEDED', r::text);
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00006', 'PROV-6', 'SUCCEEDED', 1000, 'XOF', 'evt-6b');
    PERFORM pg_temp.chk('succès tardif après FAILED : encaissé et crédité', (r->>'success')::bool AND r#>>'{steps,credit}' = 'done', r::text);

    -- 8. Introuvable, paramètres, droits
    r := public.confirm_ecomfy_payment('ECM-PAY-INEXISTANT', NULL, 'SUCCEEDED', 1, 'XOF', 'evt-9');
    PERFORM pg_temp.chk('référence inconnue : refus propre', NOT (r->>'success')::bool AND r->>'error' = 'Payment record not found', r::text);
    r := public.confirm_ecomfy_payment('ECM-PAY-CNF00001', NULL, 'N''IMPORTE QUOI');
    PERFORM pg_temp.chk('résultat inconnu refusé', NOT (r->>'success')::bool, r::text);

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.confirm_ecomfy_payment('ECM-PAY-CNF00001');
        RESET ROLE; PERFORM pg_temp.chk('confirm_ecomfy_payment refusée à authenticated', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; PERFORM pg_temp.chk('confirm_ecomfy_payment refusée à authenticated', true, SQLERRM); END;
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.replay_incomplete_ecomfy_payments();
        RESET ROLE; PERFORM pg_temp.chk('replay_incomplete_ecomfy_payments refusée à anon', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; PERFORM pg_temp.chk('replay_incomplete_ecomfy_payments refusée à anon', true, SQLERRM); END;

    -- 9. Cohérence : solde en attente = somme des crédits inscrits par ce test
    SELECT count(*) INTO n FROM public.wallet_ledger WHERE payment_id IN (v_p1, v_p2, v_p3, v_p4, v_p5) AND entry_type = 'PAYMENT_PENDING';
    PERFORM pg_temp.chk('5 paiements encaissés = 5 écritures PAYMENT_PENDING (aucun doublon, aucun oubli)', n = 5, 'n=' || n);
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
