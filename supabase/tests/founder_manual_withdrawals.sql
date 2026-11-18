-- Test de 20261118130000_founder_manual_withdrawals.sql (validation et versement manuels des retraits).
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/founder_manual_withdrawals.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout est annulé par le RAISE EXCEPTION final.

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
  v_m uuid := gen_random_uuid(); v_f uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_w public.wallets; r jsonb; ref1 text; ref2 text; bal numeric; wd public.withdrawal_requests; n int; v_err text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_m, 'marchand@test.local'), (v_f, 'fondateur@test.local'), (v_x, 'autre@test.local');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_f, 'founder');
  INSERT INTO public.merchant_kyc (user_id, full_name, phone_number, document_type, document_number, document_front_url, verification_status)
  VALUES (v_m, 'Yapi Djate', '0758152761', 'cni', 'C001', 'x', 'VERIFIED');
  v_w := public.get_or_create_merchant_wallet(v_m);
  UPDATE public.wallets SET available_balance = 10000 WHERE id = v_w.id;
  UPDATE public.ecomfy_pay_settings SET value = 'true'::jsonb WHERE key = 'withdrawals_enabled';

  PERFORM pg_temp.chk('réglage auto-payout présent et faux',
    (SELECT value = 'false'::jsonb FROM public.ecomfy_pay_settings WHERE key = 'withdrawals_auto_payout'));

  -- 1. Demande du marchand : reste REQUESTED, solde débité
  PERFORM set_config('request.jwt.claim.sub', v_m::text, true);
  SET LOCAL ROLE authenticated;
  r := public.request_wallet_withdrawal_atomic(5000, 'mobile_money', '0758152761', 'Yapi Djate', NULL, 'XOF', 'wave');
  RESET ROLE;
  ref1 := r->>'withdrawal_reference';
  PERFORM pg_temp.chk('demande enregistrée', (r->>'success')::bool AND ref1 IS NOT NULL, r::text);
  SELECT * INTO wd FROM public.withdrawal_requests WHERE withdrawal_reference = ref1;
  PERFORM pg_temp.chk('statut REQUESTED après demande', wd.status = 'REQUESTED', wd.status);
  SELECT available_balance INTO bal FROM public.wallets WHERE id = v_w.id;
  PERFORM pg_temp.chk('solde débité de 5000', bal = 5000, bal::text);

  -- 2. Droits : ni le marchand ni un tiers ne peuvent lister, valider, rejeter
  FOREACH v_err IN ARRAY ARRAY['list', 'approve', 'reject'] LOOP
    PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      IF v_err = 'list' THEN PERFORM public.founder_list_withdrawals();
      ELSIF v_err = 'approve' THEN PERFORM public.founder_approve_withdrawal(ref1, 'TX-123', NULL);
      ELSE PERFORM public.founder_reject_withdrawal(ref1, 'test'); END IF;
      RESET ROLE;
      PERFORM pg_temp.chk('non-fondateur refusé : ' || v_err, false, 'aucune erreur');
    EXCEPTION WHEN insufficient_privilege THEN
      RESET ROLE;
      PERFORM pg_temp.chk('non-fondateur refusé : ' || v_err, true);
    END;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_m::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.founder_approve_withdrawal(ref1, 'TX-123', NULL);
    RESET ROLE;
    PERFORM pg_temp.chk('marchand ne peut pas valider son propre retrait', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('marchand ne peut pas valider son propre retrait', true);
  END;
  SELECT status INTO v_err FROM public.withdrawal_requests WHERE withdrawal_reference = ref1;
  PERFORM pg_temp.chk('statut inchangé après tentatives refusées', v_err = 'REQUESTED', v_err);

  -- anonyme : exécution refusée
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.founder_list_withdrawals();
    RESET ROLE;
    PERFORM pg_temp.chk('anon ne peut pas lister', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('anon ne peut pas lister', true);
  END;

  -- 3. Le fondateur voit la file
  PERFORM set_config('request.jwt.claim.sub', v_f::text, true);
  SET LOCAL ROLE authenticated;
  r := public.founder_list_withdrawals('REQUESTED');
  RESET ROLE;
  PERFORM pg_temp.chk('file du fondateur', (r->>'success')::bool AND jsonb_array_length(r->'withdrawals') >= 1
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->'withdrawals') e
                WHERE e->>'withdrawal_reference' = ref1 AND e->>'merchant_email' = 'marchand@test.local' AND e->>'kyc_full_name' = 'Yapi Djate'), left(r::text, 200));

  -- 4. Validation : référence obligatoire, puis clôture, puis idempotence
  SET LOCAL ROLE authenticated;
  r := public.founder_approve_withdrawal(ref1, '  ', NULL);
  PERFORM pg_temp.chk('validation sans référence refusée', NOT (r->>'success')::bool, r::text);
  r := public.founder_approve_withdrawal(ref1, 'WAVE-TX-998877', 'versé à 14h');
  RESET ROLE;
  PERFORM pg_temp.chk('validation OK', (r->>'success')::bool AND r->>'status' = 'SUCCEEDED', r::text);
  SELECT * INTO wd FROM public.withdrawal_requests WHERE withdrawal_reference = ref1;
  PERFORM pg_temp.chk('traçabilité de la revue', wd.status = 'SUCCEEDED' AND wd.reviewed_by = v_f AND wd.reviewed_at IS NOT NULL
    AND wd.manual_reference = 'WAVE-TX-998877' AND wd.provider_reference = 'WAVE-TX-998877' AND wd.review_note = 'versé à 14h' AND wd.processed_at IS NOT NULL,
    format('%s %s %s', wd.status, wd.reviewed_by, wd.manual_reference));
  SELECT available_balance INTO bal FROM public.wallets WHERE id = v_w.id;
  PERFORM pg_temp.chk('solde inchangé après validation', bal = 5000, bal::text);
  SELECT count(*) INTO n FROM public.wallet_ledger WHERE reference_id = ref1 AND entry_type = 'WITHDRAWAL_COMPLETED';
  PERFORM pg_temp.chk('écriture WITHDRAWAL_COMPLETED unique', n = 1, n::text);

  SET LOCAL ROLE authenticated;
  r := public.founder_approve_withdrawal(ref1, 'AUTRE-REF', NULL);
  PERFORM pg_temp.chk('seconde validation refusée', NOT (r->>'success')::bool, r::text);
  r := public.founder_reject_withdrawal(ref1, 'trop tard');
  RESET ROLE;
  PERFORM pg_temp.chk('rejet d''un retrait déjà payé refusé', NOT (r->>'success')::bool, r::text);
  SELECT available_balance INTO bal FROM public.wallets WHERE id = v_w.id;
  PERFORM pg_temp.chk('solde toujours 5000 (pas de double recrédit)', bal = 5000, bal::text);

  -- 5. Rejet : motif obligatoire, recrédit
  PERFORM set_config('request.jwt.claim.sub', v_m::text, true);
  SET LOCAL ROLE authenticated;
  r := public.request_wallet_withdrawal_atomic(2000, 'mobile_money', '0102030405', 'Yapi Djate', NULL, 'XOF', 'orange_money');
  RESET ROLE;
  ref2 := r->>'withdrawal_reference';
  SELECT available_balance INTO bal FROM public.wallets WHERE id = v_w.id;
  PERFORM pg_temp.chk('2e demande : solde 3000', (r->>'success')::bool AND bal = 3000, bal::text);

  PERFORM set_config('request.jwt.claim.sub', v_f::text, true);
  SET LOCAL ROLE authenticated;
  r := public.founder_reject_withdrawal(ref2, '');
  PERFORM pg_temp.chk('rejet sans motif refusé', NOT (r->>'success')::bool, r::text);
  r := public.founder_reject_withdrawal(ref2, 'Numéro invalide');
  RESET ROLE;
  PERFORM pg_temp.chk('rejet OK', (r->>'success')::bool AND r->>'status' = 'FAILED', r::text);
  SELECT * INTO wd FROM public.withdrawal_requests WHERE withdrawal_reference = ref2;
  PERFORM pg_temp.chk('rejet tracé', wd.status = 'FAILED' AND wd.reviewed_by = v_f AND wd.failure_reason = 'Numéro invalide', format('%s %s', wd.status, wd.failure_reason));
  SELECT available_balance INTO bal FROM public.wallets WHERE id = v_w.id;
  PERFORM pg_temp.chk('montant recrédité (5000)', bal = 5000, bal::text);
  SELECT count(*) INTO n FROM public.wallet_ledger WHERE reference_id = ref2 AND entry_type = 'WITHDRAWAL_FAILED';
  PERFORM pg_temp.chk('écriture WITHDRAWAL_FAILED unique', n = 1, n::text);

  -- 6. Retrait inconnu
  SET LOCAL ROLE authenticated;
  r := public.founder_approve_withdrawal('ECM-WDR-INCONNU', 'TX-999', NULL);
  RESET ROLE;
  PERFORM pg_temp.chk('référence inconnue refusée', NOT (r->>'success')::bool, r::text);

  -- 7. Le marchand ne peut pas modifier lui-même ses retraits (RLS lecture seule)
  PERFORM set_config('request.jwt.claim.sub', v_m::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.withdrawal_requests SET status = 'SUCCEEDED' WHERE merchant_id = v_m;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    PERFORM pg_temp.chk('marchand ne peut pas modifier ses retraits', n = 0, 'lignes modifiées=' || n);
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('marchand ne peut pas modifier ses retraits', true);
  END;
END $$;

DO $$
DECLARE rep text; fails int;
BEGIN
  SELECT count(*) INTO fails FROM _t WHERE NOT ok;
  SELECT string_agg(format('%s %s%s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, label, CASE WHEN ok THEN '' ELSE ' :: ' || detail END), E'\n' ORDER BY n) INTO rep FROM _t;
  RAISE EXCEPTION E'\n%\n(% échecs, % contrôles)', rep, fails, (SELECT count(*) FROM _t);
END $$;
