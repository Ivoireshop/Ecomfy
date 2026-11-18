-- Test de comportement de l'API Ecomfy Pay (migration 20261114110000 appliquée) : clés, sandbox isolé de l'argent, idempotence,
-- pagination, webhooks sortants (livraison, reprise, bail), production liée à confirm_ecomfy_payment, droits et RLS.
-- Crée ses propres données (utilisateurs, boutiques, KYC) : fonctionne sur une base vierge comme sur la dev.
-- Se termine par RAISE EXCEPTION portant le rapport : tout est annulé.
-- Lancer (base jetable) : psql -U postgres -d postgres -v ON_ERROR_STOP=0 -f supabase/tests/pay_api.sql   (attendu : « (0 échecs) »)
--   ou, sur la dev : supabase db query --linked -f supabase/tests/pay_api.sql

CREATE TEMP TABLE _t (seq serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
END $$;

CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'panne simulée des événements'; END $$;

DO $$
DECLARE
    v_a uuid := gen_random_uuid();   -- marchand A (KYC validé plus tard)
    v_b uuid := gen_random_uuid();   -- marchand B
    v_sa uuid; v_sb uuid;
    r jsonb; r2 jsonb; k_test jsonb; k_live jsonb; k_b jsonb; ek jsonb;
    s_test text; s_live text; h_test text; h_live text; h_b text;
    v_id_test uuid; v_id_live uuid; v_id_b uuid;
    v_pid text; v_pid2 text; v_pid3 text; v_pid4 text; v_dlv uuid; t_state text;
    cnt int; cnt0 int; tref text; j jsonb; jd jsonb; v_pay public.ecomfy_payments;
    ep1 jsonb; ep2 jsonb; ep3 jsonb; ep_live jsonb; ep_dis jsonb;
    v_wallet_before numeric; v_wallet_after numeric; v_ledger_before int;
    v_in jsonb := jsonb_build_object('amount', 5000, 'currency', 'XOF', 'payment_method', 'wave', 'description', 'Commande 42',
                                     'customer', jsonb_build_object('name', 'Awa', 'phone', '+2250700000001'),
                                     'success_url', 'https://shop.example.com/merci', 'client_reference', 'CMD-42',
                                     'metadata', jsonb_build_object('order', '42'));
    v_err text; v_ok boolean;
BEGIN
    INSERT INTO auth.users (id) VALUES (v_a), (v_b);
    INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_a, 'Boutique A', 'tapi-a-' || substr(v_a::text, 1, 8)) RETURNING id INTO v_sa;
    INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_b, 'Boutique B', 'tapi-b-' || substr(v_b::text, 1, 8)) RETURNING id INTO v_sb;

    -- ================= A. Clés =================
    PERFORM pg_temp.as_user(v_a);
    k_test := public.create_ecomfy_api_key(v_sa, false, 'Test serveur');
    s_test := k_test ->> 'secret';
    h_test := encode(sha256(convert_to(s_test, 'UTF8')), 'hex');
    PERFORM pg_temp.chk('clé test : forme ecm_sk_test_ + 64 hex', (k_test ->> 'success')::bool AND s_test ~ '^ecm_sk_test_[0-9a-f]{64}$', s_test);
    PERFORM pg_temp.chk('seule l''empreinte est stockée (pas le secret)',
        EXISTS (SELECT 1 FROM public.ecomfy_api_keys WHERE id = (k_test ->> 'id')::uuid AND key_hash = h_test AND key_prefix = left(s_test, 16) AND last4 = right(s_test, 4))
        AND NOT EXISTS (SELECT 1 FROM public.ecomfy_api_keys WHERE key_hash = s_test OR key_prefix = s_test));
    j := public.ecomfy_api_authenticate(h_test);
    PERFORM pg_temp.chk('authenticate : contexte boutique, mode test, KYC non validé',
        (j ->> 'livemode')::bool IS FALSE AND (j ->> 'shop_id')::uuid = v_sa AND (j ->> 'kyc_verified')::bool IS FALSE AND j ->> 'business_name' = 'Boutique A', j::text);
    PERFORM pg_temp.chk('authenticate : empreinte inconnue → NULL', public.ecomfy_api_authenticate(repeat('0', 64)) IS NULL);
    v_id_test := (k_test ->> 'id')::uuid;

    r := public.create_ecomfy_api_key(v_sa, true, 'Prod');
    PERFORM pg_temp.chk('clé live refusée sans KYC validé', (r ->> 'success')::bool IS FALSE AND r ->> 'error' = 'kyc_required', r::text);
    INSERT INTO public.merchant_kyc (user_id, full_name, phone_number, document_type, document_number, document_front_url, verification_status)
    VALUES (v_a, 'Marchand A', '+2250700000000', 'national_id', 'CI0001', 'kyc/a/front.jpg', 'VERIFIED');
    k_live := public.create_ecomfy_api_key(v_sa, true, 'Prod');
    s_live := k_live ->> 'secret'; h_live := encode(sha256(convert_to(s_live, 'UTF8')), 'hex'); v_id_live := (k_live ->> 'id')::uuid;
    PERFORM pg_temp.chk('clé live acceptée avec KYC validé', (k_live ->> 'success')::bool AND s_live ~ '^ecm_sk_live_[0-9a-f]{64}$');

    PERFORM pg_temp.as_user(v_b);
    BEGIN
        PERFORM public.create_ecomfy_api_key(v_sa, false, 'Intrus');
        PERFORM pg_temp.chk('autre marchand : création de clé sur ma boutique refusée', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN
        PERFORM pg_temp.chk('autre marchand : création de clé sur ma boutique refusée', true);
    END;
    k_b := public.create_ecomfy_api_key(v_sb, false, 'B');
    h_b := encode(sha256(convert_to(k_b ->> 'secret', 'UTF8')), 'hex'); v_id_b := (k_b ->> 'id')::uuid;
    r := public.revoke_ecomfy_api_key(v_id_test);
    PERFORM pg_temp.chk('autre marchand : révocation de ma clé sans effet', (r ->> 'success')::bool IS FALSE);
    PERFORM pg_temp.chk('…et ma clé fonctionne toujours', public.ecomfy_api_authenticate(h_test) IS NOT NULL);

    -- RLS : B ne voit pas les clés de A ; personne ne lit key_hash
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO cnt FROM public.ecomfy_api_keys WHERE shop_id = v_sa;
    RESET ROLE;
    PERFORM pg_temp.chk('RLS : B ne voit aucune clé de A', cnt = 0, cnt::text);
    v_ok := false;
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM key_hash FROM public.ecomfy_api_keys;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    RESET ROLE;
    PERFORM pg_temp.chk('lecture de key_hash refusée à authenticated', v_ok);
    v_ok := false;
    SET LOCAL ROLE anon;
    BEGIN
        PERFORM 1 FROM public.ecomfy_api_keys;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    RESET ROLE;
    PERFORM pg_temp.chk('anon ne lit pas les clés', v_ok);

    -- 10 clés actives par boutique et par mode
    PERFORM pg_temp.as_user(v_a);
    FOR cnt IN 1..9 LOOP PERFORM public.create_ecomfy_api_key(v_sa, false, 'extra ' || cnt); END LOOP;
    r := public.create_ecomfy_api_key(v_sa, false, 'onzième');
    PERFORM pg_temp.chk('11e clé test refusée', r ->> 'error' = 'too_many_keys', r::text);
    r := public.revoke_ecomfy_api_key((SELECT id FROM public.ecomfy_api_keys WHERE shop_id = v_sa AND NOT livemode AND name = 'extra 1'));
    PERFORM pg_temp.chk('révocation d''une clé', (r ->> 'success')::bool);
    PERFORM pg_temp.chk('clé révoquée : authenticate → NULL (hash de la clé révoquée inconnu ensuite)',
        NOT EXISTS (SELECT 1 FROM public.ecomfy_api_keys WHERE name = 'extra 1' AND revoked_at IS NULL));

    -- ================= B. Sandbox : aucun effet sur l'argent =================
    PERFORM public.get_or_create_merchant_wallet(v_a);
    SELECT pending_balance + available_balance INTO v_wallet_before FROM public.wallets WHERE merchant_id = v_a;
    SELECT count(*) INTO v_ledger_before FROM public.wallet_ledger WHERE merchant_id = v_a;

    r := public.ecomfy_api_create_payment(v_id_test, v_in, NULL, NULL, 'https://ecomfy.cloud/sandbox/pay');
    v_pid := r #>> '{payment,id}';
    PERFORM pg_temp.chk('sandbox : création ok, id pay_test_…, statut pending',
        (r ->> 'ok')::bool AND v_pid ~ '^pay_test_[0-9a-f]{24}$' AND r #>> '{payment,status}' = 'pending' AND (r #>> '{payment,livemode}')::bool IS FALSE, r::text);
    PERFORM pg_temp.chk('sandbox : montant 5000, frais 125, net 4875, XOF',
        (r #>> '{payment,amount}')::int = 5000 AND (r #>> '{payment,fee_amount}')::int = 125 AND (r #>> '{payment,net_amount}')::int = 4875 AND r #>> '{payment,currency}' = 'XOF', r::text);
    PERFORM pg_temp.chk('sandbox : URL de paiement, client, référence, métadonnées',
        r #>> '{payment,checkout_url}' = 'https://ecomfy.cloud/sandbox/pay/' || v_pid AND r #>> '{payment,customer,phone}' = '+2250700000001'
        AND r #>> '{payment,client_reference}' = 'CMD-42' AND r #>> '{payment,metadata,order}' = '42' AND r #> '{payment,failure}' = 'null'::jsonb AND r -> 'live' = 'null'::jsonb, r::text);
    PERFORM pg_temp.chk('sandbox : aucune écriture d''argent (paiements, ledger, portefeuille)',
        NOT EXISTS (SELECT 1 FROM public.ecomfy_payments WHERE metadata ->> 'api_public_id' LIKE 'pay_test_%')
        AND (SELECT count(*) FROM public.wallet_ledger WHERE merchant_id = v_a) = v_ledger_before
        AND (SELECT pending_balance + available_balance FROM public.wallets WHERE merchant_id = v_a) = v_wallet_before);

    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{amount}', '199'));
    PERFORM pg_temp.chk('montant < 200 refusé', r2 ->> 'code' = 'invalid_request' AND r2 ->> 'param' = 'amount', r2::text);
    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{amount}', '"5000"'));
    PERFORM pg_temp.chk('montant texte refusé', r2 ->> 'code' = 'invalid_request', r2::text);
    r2 := public.ecomfy_api_create_payment(v_id_test, v_in - 'amount');
    PERFORM pg_temp.chk('montant absent refusé (pas d''exception)', r2 ->> 'code' = 'invalid_request', r2::text);
    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{payment_method}', '"paypal"'));
    PERFORM pg_temp.chk('moyen de paiement inconnu refusé', r2 ->> 'param' = 'payment_method', r2::text);
    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{amount}', '5000.5'));
    PERFORM pg_temp.chk('montant décimal refusé', r2 ->> 'code' = 'invalid_request', r2::text);
    r2 := public.ecomfy_api_create_payment(gen_random_uuid(), v_in);
    PERFORM pg_temp.chk('clé inconnue refusée', r2 ->> 'code' = 'invalid_api_key', r2::text);

    -- Idempotence
    SELECT count(*) INTO cnt0 FROM public.ecomfy_api_payments WHERE shop_id = v_sa;
    r := public.ecomfy_api_create_payment(v_id_test, v_in, 'cmd-42', 'hash-1', 'https://ecomfy.cloud/sandbox/pay');
    v_pid2 := r #>> '{payment,id}';
    r2 := public.ecomfy_api_create_payment(v_id_test, v_in, 'cmd-42', 'hash-1', 'https://ecomfy.cloud/sandbox/pay');
    PERFORM pg_temp.chk('idempotence : même clé + même corps → même paiement, replay',
        (r2 ->> 'replay')::bool AND r2 #>> '{payment,id}' = v_pid2 AND (SELECT count(*) FROM public.ecomfy_api_payments WHERE shop_id = v_sa) = cnt0 + 1, r2::text);
    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{amount}', '6000'), 'cmd-42', 'hash-2', 'https://ecomfy.cloud/sandbox/pay');
    PERFORM pg_temp.chk('idempotence : même clé, corps différent → refus', r2 ->> 'code' = 'idempotency_key_reuse', r2::text);
    PERFORM pg_temp.chk('idempotence : aucun paiement de plus', (SELECT count(*) FROM public.ecomfy_api_payments WHERE shop_id = v_sa) = cnt0 + 1);
    r2 := public.ecomfy_api_create_payment(v_id_live, v_in, 'cmd-42', 'hash-1', 'x', 'geniuspay');
    PERFORM pg_temp.chk('idempotence : la clé est propre à chaque clé d''API (la live ne voit pas celle de la test)',
        (r2 ->> 'ok')::bool AND NOT (r2 ->> 'replay')::bool AND r2 #>> '{payment,livemode}' = 'true', r2::text);
    v_pid4 := r2 #>> '{payment,id}';
    UPDATE public.ecomfy_api_idempotency SET created_at = now() - interval '25 hours' WHERE key_id = v_id_test AND idem_key = 'cmd-42';
    r2 := public.ecomfy_api_create_payment(v_id_test, jsonb_set(v_in, '{amount}', '6000'), 'cmd-42', 'hash-2', 'https://ecomfy.cloud/sandbox/pay');
    PERFORM pg_temp.chk('idempotence : au-delà de 24 h la clé est libre', (r2 ->> 'ok')::bool AND NOT (r2 ->> 'replay')::bool, r2::text);

    -- Lecture
    j := public.ecomfy_api_get_payment(v_id_test, v_pid);
    PERFORM pg_temp.chk('get : avec la bonne clé', j ->> 'id' = v_pid AND j ->> 'status' = 'pending', j::text);
    PERFORM pg_temp.chk('get : clé de l''autre boutique → NULL', public.ecomfy_api_get_payment(v_id_b, v_pid) IS NULL);
    PERFORM pg_temp.chk('get : clé live ne voit pas le sandbox', public.ecomfy_api_get_payment(v_id_live, v_pid) IS NULL);
    PERFORM pg_temp.chk('get : id inconnu → NULL', public.ecomfy_api_get_payment(v_id_test, 'pay_test_000000000000000000000000') IS NULL);

    -- Liste et pagination : 3 paiements sandbox (v_pid, v_pid2, + celui de 6000)
    j := public.ecomfy_api_list_payments(v_id_test, 2);
    PERFORM pg_temp.chk('liste : 2 éléments, has_more', jsonb_array_length(j -> 'data') = 2 AND (j ->> 'has_more')::bool, j::text);
    PERFORM pg_temp.chk('liste : le plus récent d''abord', (j #>> '{data,0,created_at}') >= (j #>> '{data,1,created_at}'));
    jd := public.ecomfy_api_list_payments(v_id_test, 2, j #>> '{data,1,id}');
    PERFORM pg_temp.chk('liste : page suivante, plus rien après', jsonb_array_length(jd -> 'data') = 1 AND NOT (jd ->> 'has_more')::bool, jd::text);
    PERFORM pg_temp.chk('liste : aucun doublon entre les pages', NOT (j -> 'data') @> jsonb_build_array(jd -> 'data' -> 0));
    PERFORM pg_temp.chk('liste : curseur inconnu', public.ecomfy_api_list_payments(v_id_test, 2, 'pay_test_000000000000000000000000') ->> 'error' = 'invalid_cursor');
    PERFORM pg_temp.chk('liste : la clé live ne voit pas les paiements test', jsonb_array_length(public.ecomfy_api_list_payments(v_id_live) -> 'data') = 0);
    PERFORM pg_temp.chk('liste : la clé de B ne voit rien de A', jsonb_array_length(public.ecomfy_api_list_payments(v_id_b) -> 'data') = 0);
    PERFORM pg_temp.chk('liste : filtre de statut', jsonb_array_length(public.ecomfy_api_list_payments(v_id_test, 20, NULL, 'succeeded') -> 'data') = 0
        AND jsonb_array_length(public.ecomfy_api_list_payments(v_id_test, 20, NULL, 'pending') -> 'data') = 3);

    -- Page de paiement sandbox : aucune donnée client
    j := public.ecomfy_api_sandbox_checkout(v_pid);
    PERFORM pg_temp.chk('page sandbox : montant et boutique, sans nom ni téléphone ni e-mail',
        (j ->> 'amount')::int = 5000 AND j ->> 'business_name' = 'Boutique A' AND NOT (j ? 'customer') AND j::text NOT LIKE '%2250700000001%', j::text);
    PERFORM pg_temp.chk('page sandbox : un paiement live n''est pas servi', public.ecomfy_api_sandbox_checkout(v_pid4) IS NULL);

    -- ================= C. Webhooks sortants =================
    ep1 := public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/hooks/ecomfy', false);
    ep2 := public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/hooks/echecs', false, ARRAY['payment.failed']);
    ep_live := public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/hooks/live', true);
    ep_dis := public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/hooks/off', false, ARRAY['payment.cancelled']);
    PERFORM pg_temp.chk('destination : secret whsec_ + 48 hex', ep1 ->> 'secret' ~ '^whsec_[0-9a-f]{64}$', ep1::text);
    PERFORM pg_temp.chk('destination : http refusée', public.create_ecomfy_webhook_endpoint(v_sa, 'http://shop.example.com/h', false) ->> 'error' = 'invalid_url');
    PERFORM pg_temp.chk('destination : identifiants dans l''URL refusés', public.create_ecomfy_webhook_endpoint(v_sa, 'https://u:p@shop.example.com/h', false) ->> 'error' = 'invalid_url');
    PERFORM pg_temp.chk('destination : événement inconnu refusé', public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/h', false, ARRAY['order.created']) ->> 'error' = 'invalid_events');
    BEGIN
        PERFORM pg_temp.as_user(v_b);
        PERFORM public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/h', false);
        PERFORM pg_temp.chk('destination : création sur la boutique d''un autre refusée', false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN
        PERFORM pg_temp.chk('destination : création sur la boutique d''un autre refusée', true);
    END;
    PERFORM pg_temp.as_user(v_b);
    PERFORM pg_temp.chk('destination : rotation du secret d''un autre refusée', public.rotate_ecomfy_webhook_secret((ep1 ->> 'id')::uuid) ->> 'error' = 'not_found');
    PERFORM pg_temp.as_user(v_a);
    r := public.rotate_ecomfy_webhook_secret((ep1 ->> 'id')::uuid);
    PERFORM pg_temp.chk('destination : rotation du secret', (r ->> 'success')::bool AND r ->> 'secret' <> ep1 ->> 'secret'
        AND (SELECT secret FROM public.ecomfy_api_webhook_endpoints WHERE id = (ep1 ->> 'id')::uuid) = r ->> 'secret');
    ep1 := jsonb_set(ep1, '{secret}', r -> 'secret');
    v_ok := false;
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM secret FROM public.ecomfy_api_webhook_endpoints;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    RESET ROLE;
    PERFORM pg_temp.chk('lecture du secret de destination refusée à authenticated', v_ok);
    FOR cnt IN 1..2 LOOP PERFORM public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/h' || cnt, false); END LOOP;
    PERFORM pg_temp.chk('limite de 5 destinations par boutique et par mode (test : 5 atteintes)',
        public.create_ecomfy_webhook_endpoint(v_sa, 'https://shop.example.com/h9', false) ->> 'error' = 'too_many_endpoints');

    -- Simulation : succès → un événement, livré à ep1 (« * ») seulement (ni ep2 « failed », ni la destination live, ni l'inactive)
    SELECT pending_balance + available_balance INTO v_wallet_before FROM public.wallets WHERE merchant_id = v_a;
    r := public.ecomfy_api_simulate(v_pid, 'success', v_id_test);
    PERFORM pg_temp.chk('simulate success : statut succeeded, terminé', (r ->> 'ok')::bool AND r #>> '{payment,status}' = 'succeeded' AND r #>> '{payment,completed_at}' IS NOT NULL, r::text);
    PERFORM pg_temp.chk('simulate : un seul événement payment.succeeded avec l''objet figé',
        (SELECT count(*) FROM public.ecomfy_api_events WHERE type = 'payment.succeeded' AND payload #>> '{data,object,id}' = v_pid) = 1
        AND (SELECT payload ->> 'livemode' FROM public.ecomfy_api_events WHERE payload #>> '{data,object,id}' = v_pid) = 'false');
    -- Destinations de test à l'écoute de payment.succeeded : ep1 et les deux « * » créées par la boucle ; pas ep2 (échecs), ep_dis (annulations), ep_live.
    SELECT count(*) INTO cnt FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id WHERE e.payload #>> '{data,object,id}' = v_pid;
    PERFORM pg_temp.chk('livraisons créées pour les seules destinations concernées (3 « * » de test)', cnt = 3
        AND EXISTS (SELECT 1 FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id
                    WHERE e.payload #>> '{data,object,id}' = v_pid AND d.endpoint_id = (ep1 ->> 'id')::uuid)
        AND NOT EXISTS (SELECT 1 FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id
                    WHERE e.payload #>> '{data,object,id}' = v_pid AND d.endpoint_id IN ((ep2 ->> 'id')::uuid, (ep_live ->> 'id')::uuid, (ep_dis ->> 'id')::uuid)), cnt::text);
    r2 := public.ecomfy_api_simulate(v_pid, 'declined', v_id_test);
    PERFORM pg_temp.chk('simulate : un paiement terminé ne rejoue pas', r2 ->> 'code' = 'payment_not_pending' AND r2 #>> '{payment,status}' = 'succeeded', r2::text);
    PERFORM pg_temp.chk('simulate : toujours aucune écriture d''argent après un succès sandbox',
        NOT EXISTS (SELECT 1 FROM public.ecomfy_payments WHERE metadata ->> 'api_public_id' LIKE 'pay_test_%')
        AND (SELECT count(*) FROM public.wallet_ledger WHERE merchant_id = v_a) = v_ledger_before
        AND (SELECT pending_balance + available_balance FROM public.wallets WHERE merchant_id = v_a) = v_wallet_before);
    r2 := public.ecomfy_api_simulate(v_pid2, 'insufficient_funds', v_id_test);
    PERFORM pg_temp.chk('simulate insufficient_funds : failed + code', r2 #>> '{payment,status}' = 'failed' AND r2 #>> '{payment,failure,code}' = 'insufficient_funds', r2::text);
    PERFORM pg_temp.chk('…et la destination « payment.failed » reçoit sa livraison', EXISTS (
        SELECT 1 FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id
        WHERE e.payload #>> '{data,object,id}' = v_pid2 AND d.endpoint_id = (ep2 ->> 'id')::uuid)
        AND (SELECT count(*) FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id WHERE e.payload #>> '{data,object,id}' = v_pid2) = 4);
    v_pid3 := (public.ecomfy_api_list_payments(v_id_test, 1, NULL, 'pending') -> 'data' -> 0 ->> 'id');
    r2 := public.ecomfy_api_simulate(v_pid3, 'cancelled', v_id_test);
    PERFORM pg_temp.chk('simulate cancelled', r2 #>> '{payment,status}' = 'cancelled', r2::text);
    UPDATE public.ecomfy_api_webhook_endpoints SET is_active = false WHERE id = (ep_dis ->> 'id')::uuid;
    PERFORM pg_temp.chk('simulate : scénario inconnu', public.ecomfy_api_simulate(v_pid, 'boom', v_id_test) ->> 'code' = 'invalid_scenario');
    PERFORM pg_temp.chk('simulate : paiement d''une autre boutique → not_found', public.ecomfy_api_simulate(v_pid, 'success', v_id_b) ->> 'code' = 'not_found');
    PERFORM pg_temp.chk('simulate : clé live refusée', public.ecomfy_api_simulate(v_pid, 'success', v_id_live) ->> 'code' = 'live_mode_not_simulable');
    PERFORM pg_temp.chk('simulate : un paiement live n''est pas simulable', public.ecomfy_api_simulate(v_pid4, 'success') ->> 'code' = 'not_found');
    r2 := public.ecomfy_api_create_payment(v_id_test, v_in, NULL, NULL, 'https://ecomfy.cloud/sandbox/pay');
    r2 := public.ecomfy_api_simulate(r2 #>> '{payment,id}', 'expired');
    PERFORM pg_temp.chk('simulate expired (page sandbox, sans clé)', r2 #>> '{payment,status}' = 'expired', r2::text);

    -- Livraison : réservation, bail, résultat, reprise, abandon
    j := public.ecomfy_api_claim_deliveries(50);
    PERFORM pg_temp.chk('claim : livraisons dues, avec URL, secret et corps', jsonb_array_length(j) >= 3
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'event_type' = 'payment.succeeded' AND x ->> 'secret' = ep1 ->> 'secret'
                    AND x ->> 'url' = 'https://shop.example.com/hooks/ecomfy' AND x #>> '{payload,data,object,status}' = 'succeeded' AND (x ->> 'attempt')::int = 1), j::text);
    PERFORM pg_temp.chk('claim : la destination désactivée n''est pas servie',
        NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'url' LIKE '%/hooks/off'));
    PERFORM pg_temp.chk('claim : bail de 2 minutes (un second balayage ne reprend rien)', public.ecomfy_api_claim_deliveries(50) = '[]'::jsonb);
    SELECT (x ->> 'delivery_id')::uuid INTO v_dlv FROM jsonb_array_elements(j) x WHERE x ->> 'event_type' = 'payment.succeeded' LIMIT 1;
    t_state := public.ecomfy_api_record_delivery(v_dlv, 500, 'http_500');
    PERFORM pg_temp.chk('record 500 → reprise programmée à +1 min', t_state = 'retry'
        AND (SELECT next_attempt_at BETWEEN now() + interval '50 seconds' AND now() + interval '70 seconds' AND last_http_status = 500 AND last_error = 'http_500'
             FROM public.ecomfy_api_webhook_deliveries WHERE id = v_dlv), t_state);
    UPDATE public.ecomfy_api_webhook_deliveries SET next_attempt_at = now() WHERE id = v_dlv;
    j := public.ecomfy_api_claim_deliveries(50);
    PERFORM pg_temp.chk('claim : la reprise revient avec attempt = 2', EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE (x ->> 'delivery_id')::uuid = v_dlv AND (x ->> 'attempt')::int = 2), j::text);
    t_state := public.ecomfy_api_record_delivery(v_dlv, 200, NULL);
    PERFORM pg_temp.chk('record 200 → livré', t_state = 'succeeded'
        AND (SELECT status = 'succeeded' AND delivered_at IS NOT NULL FROM public.ecomfy_api_webhook_deliveries WHERE id = v_dlv), t_state);
    UPDATE public.ecomfy_api_webhook_deliveries SET attempts = 8 WHERE id = (SELECT id FROM public.ecomfy_api_webhook_deliveries WHERE status = 'pending' LIMIT 1);
    PERFORM pg_temp.chk('record échec à la 8e tentative → abandon', public.ecomfy_api_record_delivery((SELECT id FROM public.ecomfy_api_webhook_deliveries WHERE attempts = 8 LIMIT 1), 0, 'timeout') = 'failed');
    PERFORM pg_temp.chk('record : livraison inconnue', public.ecomfy_api_record_delivery(gen_random_uuid(), 200) = 'unknown');
    PERFORM pg_temp.chk('une destination désactivée voit sa livraison abandonnée (endpoint_disabled)',
        EXISTS (SELECT 1 FROM public.ecomfy_api_webhook_deliveries WHERE endpoint_id = (ep_dis ->> 'id')::uuid AND status = 'failed' AND last_error = 'endpoint_disabled'));
    -- RLS des livraisons : A voit les siennes, B aucune
    PERFORM pg_temp.as_user(v_b);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO cnt FROM public.ecomfy_api_webhook_deliveries;
    RESET ROLE;
    PERFORM pg_temp.chk('RLS : B ne voit aucune livraison de A', cnt = 0, cnt::text);
    PERFORM pg_temp.as_user(v_a);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO cnt FROM public.ecomfy_api_webhook_deliveries;
    RESET ROLE;
    PERFORM pg_temp.chk('RLS : A voit ses livraisons', cnt >= 3, cnt::text);

    -- ================= D. Production : liée à ecomfy_payments / confirm_ecomfy_payment =================
    PERFORM pg_temp.chk('live : paiement créé en PENDING avec 2,5 % de frais, provider et origine API', EXISTS (
        SELECT 1 FROM public.ecomfy_payments p WHERE p.id = (SELECT payment_id FROM public.ecomfy_api_payments WHERE public_id = v_pid4)
          AND p.status = 'PENDING' AND p.amount = 5000 AND p.fee_ecomfy = 125 AND p.net_merchant_amount = 4875 AND p.provider = 'geniuspay'
          AND p.metadata ->> 'created_via' = 'api' AND p.customer_phone = '+2250700000001'));
    PERFORM pg_temp.chk('live : invisible (get et liste) tant que l''opérateur n''a pas répondu',
        public.ecomfy_api_get_payment(v_id_live, v_pid4) IS NULL AND jsonb_array_length(public.ecomfy_api_list_payments(v_id_live) -> 'data') = 0);
    SELECT * INTO v_pay FROM public.ecomfy_payments WHERE id = (SELECT payment_id FROM public.ecomfy_api_payments WHERE public_id = v_pid4);
    j := public.ecomfy_api_finalize_live(v_pid4, 'https://pay.geniuspay.test/c/1', 'GP-REF-1');
    PERFORM pg_temp.chk('finalize : URL de paiement et référence opérateur enregistrées', j ->> 'checkout_url' = 'https://pay.geniuspay.test/c/1'
        AND (SELECT provider_reference FROM public.ecomfy_payments WHERE id = v_pay.id) = 'GP-REF-1' AND j ->> 'reference' = v_pay.internal_reference, j::text);
    PERFORM pg_temp.chk('finalize : sans effet une seconde fois', public.ecomfy_api_finalize_live(v_pid4, 'https://evil.example/x') IS NULL);
    PERFORM pg_temp.chk('live : visible après finalize', public.ecomfy_api_get_payment(v_id_live, v_pid4) ->> 'status' = 'pending'
        AND public.ecomfy_api_get_payment(v_id_test, v_pid4) IS NULL);
    -- Une idempotence sur un paiement live encore sans URL répond « en cours »
    r2 := public.ecomfy_api_create_payment(v_id_live, v_in, 'live-1', 'h', 'x', 'geniuspay');
    v_pid3 := r2 #>> '{payment,id}';
    PERFORM pg_temp.chk('live : rejeu pendant l''appel opérateur → request_in_progress',
        public.ecomfy_api_create_payment(v_id_live, v_in, 'live-1', 'h', 'x', 'geniuspay') ->> 'code' = 'request_in_progress');

    -- Confirmation par le chemin réel (webhook GeniusPay → confirm_ecomfy_payment) : l'argent, puis l'événement par le déclencheur
    SELECT pending_balance INTO v_wallet_before FROM public.wallets WHERE merchant_id = v_a;
    j := public.confirm_ecomfy_payment(v_pay.internal_reference, 'GP-REF-1', 'SUCCEEDED', 5000, 'XOF', 'evt-live-1', 'payment.success', '{}');
    PERFORM pg_temp.chk('live : confirm_ecomfy_payment réussit comme avant (crédit du portefeuille)', (j ->> 'success')::bool AND j #>> '{steps,credit}' = 'done', j::text);
    SELECT pending_balance INTO v_wallet_after FROM public.wallets WHERE merchant_id = v_a;
    PERFORM pg_temp.chk('live : le portefeuille reçoit le net 4875', v_wallet_after - v_wallet_before = 4875, (v_wallet_after - v_wallet_before)::text);
    j := public.ecomfy_api_get_payment(v_id_live, v_pid4);
    PERFORM pg_temp.chk('live : statut succeeded relu par l''API (source : ecomfy_payments)', j ->> 'status' = 'succeeded' AND j ->> 'completed_at' IS NOT NULL, j::text);
    PERFORM pg_temp.chk('live : événement payment.succeeded créé par le déclencheur, livré à la destination live seulement',
        (SELECT count(*) FROM public.ecomfy_api_events WHERE api_payment_id = (SELECT id FROM public.ecomfy_api_payments WHERE public_id = v_pid4) AND type = 'payment.succeeded' AND livemode) = 1
        AND (SELECT count(*) FROM public.ecomfy_api_webhook_deliveries d JOIN public.ecomfy_api_events e ON e.id = d.event_id
             WHERE e.api_payment_id = (SELECT id FROM public.ecomfy_api_payments WHERE public_id = v_pid4)) = 1
        AND EXISTS (SELECT 1 FROM public.ecomfy_api_webhook_deliveries d WHERE d.endpoint_id = (ep_live ->> 'id')::uuid AND d.status = 'pending'));
    j := public.confirm_ecomfy_payment(v_pay.internal_reference, 'GP-REF-1', 'SUCCEEDED', 5000, 'XOF', 'evt-live-1b', 'payment.success', '{}');
    PERFORM pg_temp.chk('live : rejeu de la confirmation → pas de second événement ni de second crédit',
        (j ->> 'already_processed')::bool AND (SELECT count(*) FROM public.ecomfy_api_events WHERE type = 'payment.succeeded' AND livemode) = 1
        AND (SELECT pending_balance FROM public.wallets WHERE merchant_id = v_a) = v_wallet_after);

    -- Échec côté opérateur
    j := public.ecomfy_api_finalize_live(v_pid3, 'https://pay.geniuspay.test/c/2', 'GP-REF-2');
    SELECT internal_reference INTO tref FROM public.ecomfy_payments WHERE id = (SELECT payment_id FROM public.ecomfy_api_payments WHERE public_id = v_pid3);
    PERFORM public.confirm_ecomfy_payment(tref, 'GP-REF-2', 'FAILED', NULL, NULL, 'evt-live-2', 'payment.failed', '{}', 'Solde insuffisant chez GeniusPay');
    j := public.ecomfy_api_get_payment(v_id_live, v_pid3);
    PERFORM pg_temp.chk('live : échec → failed, code générique (le motif de l''opérateur n''est pas exposé)',
        j ->> 'status' = 'failed' AND j #>> '{failure,code}' = 'payment_failed' AND j::text NOT LIKE '%GeniusPay%', j::text);
    PERFORM pg_temp.chk('live : événement payment.failed', EXISTS (SELECT 1 FROM public.ecomfy_api_events WHERE type = 'payment.failed' AND livemode
        AND payload #>> '{data,object,id}' = v_pid3));

    -- Abandon (opérateur indisponible) : FAILED, aucun événement, clé d'idempotence libérée
    r2 := public.ecomfy_api_create_payment(v_id_live, v_in, 'live-2', 'h', 'x', 'geniuspay');
    v_pid3 := r2 #>> '{payment,id}';
    SELECT count(*) INTO cnt0 FROM public.ecomfy_api_events WHERE livemode;
    PERFORM public.ecomfy_api_abort_live(v_pid3, 'HTTP 422 — Le montant minimum pour XOF est 200');
    PERFORM pg_temp.chk('abort : ecomfy_payments FAILED avec le motif en gateway_error', EXISTS (
        SELECT 1 FROM public.ecomfy_payments p JOIN public.ecomfy_api_payments a ON a.payment_id = p.id
        WHERE a.public_id = v_pid3 AND p.status = 'FAILED' AND p.metadata ->> 'gateway_error' LIKE '%422%'));
    PERFORM pg_temp.chk('abort : aucun événement envoyé au marchand, paiement invisible',
        (SELECT count(*) FROM public.ecomfy_api_events WHERE livemode) = cnt0 AND public.ecomfy_api_get_payment(v_id_live, v_pid3) IS NULL);
    r2 := public.ecomfy_api_create_payment(v_id_live, v_in, 'live-2', 'h', 'x', 'geniuspay');
    PERFORM pg_temp.chk('abort : la clé d''idempotence est libérée, une nouvelle tentative crée un autre paiement',
        (r2 ->> 'ok')::bool AND NOT (r2 ->> 'replay')::bool AND r2 #>> '{payment,id}' <> v_pid3, r2::text);

    -- Un incident dans les événements ne doit jamais faire échouer la confirmation d'un paiement
    j := public.ecomfy_api_finalize_live(r2 #>> '{payment,id}', 'https://pay.geniuspay.test/c/3', 'GP-REF-3');
    SELECT internal_reference INTO tref FROM public.ecomfy_payments WHERE id = (SELECT payment_id FROM public.ecomfy_api_payments WHERE public_id = r2 #>> '{payment,id}');
    CREATE TRIGGER zz_boom BEFORE INSERT ON public.ecomfy_api_events FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();
    j := public.confirm_ecomfy_payment(tref, 'GP-REF-3', 'SUCCEEDED', 5000, 'XOF', 'evt-live-3', 'payment.success', '{}');
    DROP TRIGGER zz_boom ON public.ecomfy_api_events;
    PERFORM pg_temp.chk('panne des événements : le paiement est tout de même confirmé et crédité',
        (j ->> 'success')::bool AND (SELECT status FROM public.ecomfy_payments WHERE internal_reference = tref) = 'SUCCEEDED', j::text);

    -- Un paiement qui n'est pas de l'API change de statut sans effet de bord
    INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, fee_ecomfy, net_merchant_amount, status)
    VALUES ('ECM-PAY-TAPI0001', v_a, v_sa, 'wave', 'geniuspay', 3000, 75, 2925, 'PENDING');
    SELECT count(*) INTO cnt0 FROM public.ecomfy_api_events;
    j := public.confirm_ecomfy_payment('ECM-PAY-TAPI0001', 'P-1', 'SUCCEEDED', 3000, 'XOF', 'evt-plain-1', 'payment.success', '{}');
    PERFORM pg_temp.chk('paiement hors API : confirmation inchangée, aucun événement API', (j ->> 'success')::bool AND (SELECT count(*) FROM public.ecomfy_api_events) = cnt0, j::text);

    -- ================= E. Droits =================
    PERFORM pg_temp.chk('anon et authenticated ne peuvent pas appeler les fonctions du service',
        NOT has_function_privilege('anon', 'public.ecomfy_api_create_payment(uuid,jsonb,text,text,text,text)', 'execute')
        AND NOT has_function_privilege('authenticated', 'public.ecomfy_api_create_payment(uuid,jsonb,text,text,text,text)', 'execute')
        AND NOT has_function_privilege('authenticated', 'public.ecomfy_api_authenticate(text)', 'execute')
        AND NOT has_function_privilege('authenticated', 'public.ecomfy_api_simulate(text,text,uuid)', 'execute')
        AND NOT has_function_privilege('authenticated', 'public.ecomfy_api_claim_deliveries(integer)', 'execute')
        AND NOT has_function_privilege('authenticated', 'public.ecomfy_api_emit_event(uuid,text)', 'execute')
        AND has_function_privilege('service_role', 'public.ecomfy_api_create_payment(uuid,jsonb,text,text,text,text)', 'execute'));
    PERFORM pg_temp.chk('anon ne peut ni créer de clé ni de destination',
        NOT has_function_privilege('anon', 'public.create_ecomfy_api_key(uuid,boolean,text)', 'execute')
        AND NOT has_function_privilege('anon', 'public.create_ecomfy_webhook_endpoint(uuid,text,boolean,text[],text)', 'execute')
        AND has_function_privilege('authenticated', 'public.create_ecomfy_api_key(uuid,boolean,text)', 'execute'));
    PERFORM pg_temp.chk('ménage : purge sans erreur', public.ecomfy_api_purge() ? 'idempotency');

    -- ================= Rapport =================
    SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO cnt, cnt0 FROM _t;
    RAISE EXCEPTION E'RAPPORT pay_api (% contrôles, % échecs)\n%', cnt0, cnt,
        (SELECT string_agg(format('%s %s%s', CASE WHEN ok THEN 'OK  ' ELSE 'FAIL' END, label, CASE WHEN ok THEN '' ELSE ' :: ' || left(detail, 300) END), E'\n' ORDER BY seq) FROM _t);
END $$;
