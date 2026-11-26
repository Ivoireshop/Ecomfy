-- Test de 20261126110000_founder_affiliates_withdrawals_paging.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/founder_affiliates_withdrawals_paging.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout est annulé par le RAISE EXCEPTION final.

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
  v_f uuid := gen_random_uuid(); v_x uuid := gen_random_uuid(); v_u uuid; v_a uuid; v_first uuid; v_w public.wallets;
  r jsonb; p1 jsonb; p2 jsonb; o jsonb; item jsonb; i int; v_period text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_f, 'fondateur@pg.test'), (v_x, 'autre@pg.test');
  INSERT INTO public.profiles (id, email) VALUES (v_f, 'fondateur@pg.test'), (v_x, 'autre@pg.test')
    ON CONFLICT (id) DO UPDATE SET email = excluded.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_f, 'founder');
  SELECT code INTO v_period FROM public.affiliate_payout_periods ORDER BY start_date LIMIT 1;

  -- 30 affiliés créés au même instant.
  FOR i IN 1..30 LOOP
    v_u := gen_random_uuid();
    INSERT INTO auth.users (id, email) VALUES (v_u, 'aff' || i || '@pg.test');
    INSERT INTO public.profiles (id, email, full_name) VALUES (v_u, 'aff' || i || '@pg.test', CASE WHEN i = 3 THEN 'Awa Pagetest' END)
      ON CONFLICT (id) DO UPDATE SET email = excluded.email, full_name = excluded.full_name;
    -- Un déclencheur peut avoir déjà créé le profil d'affiliation à l'inscription.
    INSERT INTO public.affiliates (user_id, affiliate_code, created_at) VALUES (v_u, 'PGT' || i, '2026-01-01')
      ON CONFLICT (user_id) DO UPDATE SET affiliate_code = excluded.affiliate_code, created_at = excluded.created_at
      RETURNING id INTO v_a;
    IF i = 3 THEN v_first := v_a; END IF;
  END LOOP;
  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used) VALUES (v_first, v_x, 'PGT3');
  INSERT INTO public.affiliate_commissions (affiliate_id, referred_user_id, amount_paid, commission_amount, status, period_code)
  VALUES (v_first, v_x, 1000, 100, 'PAYABLE', v_period),
         (v_first, v_x, 1000, 200, 'APPROVED', NULL),
         (v_first, v_x, 1000, 400, 'PAID', NULL),
         (v_first, v_x, 1000, 800, 'PENDING', NULL),
         (v_first, v_x, 1000, 1600, 'CANCELLED', NULL);

  PERFORM set_config('request.jwt.claim.sub', v_f::text, true);
  SET LOCAL ROLE authenticated;
  p1 := public.founder_affiliate_list(NULL, 'pgt', 25, 0);
  p2 := public.founder_affiliate_list('ALL', 'pgt', 25, 25);
  r := public.founder_affiliate_list(NULL, 'awa pagetest', 25, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('affiliés : total', (p1->>'total')::int = 30, p1->>'total');
  PERFORM pg_temp.chk('affiliés : 25 + 5', jsonb_array_length(p1->'rows') = 25 AND jsonb_array_length(p2->'rows') = 5);
  PERFORM pg_temp.chk('affiliés : aucun doublon',
    (SELECT count(DISTINCT e->'affiliate'->>'id') FROM jsonb_array_elements((p1->'rows') || (p2->'rows')) e) = 30);
  item := r->'rows'->0;
  PERFORM pg_temp.chk('recherche par nom', (r->>'total')::int = 1 AND item->>'user_name' = 'Awa Pagetest', r::text);
  PERFORM pg_temp.chk('filleuls', (item->>'referred_count')::int = 1, item::text);
  PERFORM pg_temp.chk('nombre de commissions', (item->>'subscriptions_count')::int = 5, item::text);
  PERFORM pg_temp.chk('solde disponible = payable + approuvé', (item->>'payable_amount')::numeric = 300, item::text);
  PERFORM pg_temp.chk('déjà payé', (item->>'paid_amount')::numeric = 400, item::text);
  PERFORM pg_temp.chk('total gagné hors attente et annulé', (item->>'total_earned')::numeric = 700, item::text);

  SET LOCAL ROLE authenticated;
  r := public.founder_affiliate_list(v_period, 'PGT3', 25, 0);
  RESET ROLE;
  SELECT e INTO item FROM jsonb_array_elements(r->'rows') e WHERE e->'affiliate'->>'affiliate_code' = 'PGT3';
  PERFORM pg_temp.chk('filtre de période', (item->>'payable_amount')::numeric = 100 AND (item->>'subscriptions_count')::int = 1, item::text);

  SET LOCAL ROLE authenticated;
  o := public.founder_affiliate_overview(NULL);
  RESET ROLE;
  PERFORM pg_temp.chk('totaux : montants',
    (o->>'pendingAmount')::numeric >= 800 AND (o->>'payableAmount')::numeric >= 300 AND (o->>'totalAffiliates')::int >= 30, o::text);
  PERFORM pg_temp.chk('totaux : payé repris des commissions sans versement', (o->>'paidAmount')::numeric >= 400, o::text);

  -- Retraits : 7 demandes dont 5 à valider.
  v_w := public.get_or_create_merchant_wallet(v_x);
  FOR i IN 1..7 LOOP
    INSERT INTO public.withdrawal_requests (withdrawal_reference, merchant_id, wallet_id, amount, payout_method, destination_phone, destination_name, status, created_at)
    VALUES ('PGTEST-' || i, v_x, v_w.id, 1000, 'mobile_money', '0700000000', 'Test', CASE WHEN i <= 5 THEN 'REQUESTED' ELSE 'FAILED' END, '2026-01-01');
  END LOOP;
  SET LOCAL ROLE authenticated;
  p1 := public.founder_list_withdrawals('REQUESTED', 3, 0);
  p2 := public.founder_list_withdrawals('REQUESTED', 3, 3);
  r := public.founder_list_withdrawals(p_status => NULL, p_limit => 200);
  RESET ROLE;
  PERFORM pg_temp.chk('retraits : total de la vue', (p1->>'total')::int = 5 AND (p1->>'pending_count')::int = 5, p1::text);
  PERFORM pg_temp.chk('retraits : 3 + 2 sans doublon',
    (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements((p1->'withdrawals') || (p2->'withdrawals')) e) = 5
    AND jsonb_array_length(p2->'withdrawals') = 2);
  PERFORM pg_temp.chk('ancien appel (statut, limite) toujours accepté', (r->>'success')::bool AND (r->>'total')::int = 7, r->>'total');

  -- Un compte ordinaire n'obtient rien.
  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.founder_affiliate_list(NULL, NULL, 25, 0);
  o := public.founder_affiliate_overview(NULL);
  BEGIN
    PERFORM public.founder_list_withdrawals(NULL, 10, 0);
    RESET ROLE;
    PERFORM pg_temp.chk('retraits refusés au non-fondateur', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('retraits refusés au non-fondateur', true);
  END;
  PERFORM pg_temp.chk('affiliés : rien pour un compte ordinaire', r IS NULL AND o IS NULL, coalesce(r::text, '') || coalesce(o::text, ''));

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.founder_affiliate_list(NULL, NULL, 25, 0);
    RESET ROLE;
    PERFORM pg_temp.chk('anon refusé', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('anon refusé', true);
  END;
END $$;

DO $$
DECLARE r record; total int; bad int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT ok) INTO total, bad FROM _t;
  FOR r IN SELECT * FROM _t ORDER BY n LOOP
    RAISE NOTICE '% % %', CASE WHEN r.ok THEN 'OK   ' ELSE 'ECHEC' END, r.label, CASE WHEN r.ok THEN '' ELSE r.detail END;
  END LOOP;
  RAISE EXCEPTION 'Fin du test : % cas (% échecs) — annulation volontaire', total, bad;
END $$;
