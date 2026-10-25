-- Tests RLS et droits d'exécution sur les flux d'argent (portefeuille, registre, retraits, paiements, abonnements,
-- commissions de boutique, affiliation) tels qu'ils sont réellement déployés.
-- Base de DEV uniquement : le fichier crée ses propres utilisateurs, boutiques et lignes factices, usurpe les rôles
-- `anon` / `authenticated` (comme PostgREST) et se termine par RAISE EXCEPTION portant le rapport : tout est annulé.
-- Lancer : npx supabase db query --linked -f supabase/tests/rls_money_flows.sql   (attendu : « (0 échecs) »)
-- Vérifier d'abord que supabase/.temp/project-ref est bien le projet de dev.
--
-- Principe : chaque tentative d'écriture interdite est jouée par `pg_temp.probe`, qui exécute l'attaque sous l'identité
-- voulue, relève l'état de la base en tant que superutilisateur, puis ANNULE l'attaque (sous-transaction) : les cas ne
-- se contaminent pas. Un cas réussit seulement si l'attaque est refusée (erreur ou 0 ligne) ET si l'état est inchangé.
-- Identités : A, B = marchands (propriétaires des boutiques sA, sB) ; C = collaborateur « edit_shop » de sA ;
-- F = fondateur ; AF1, AF2 = affiliés ; X = utilisateur connecté sans rien ; anon = visiteur.

-- ===== OUTILS =====
CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
CREATE TEMP TABLE _ids (k text PRIMARY KEY, val text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
CREATE FUNCTION pg_temp.denied(r text) RETURNS boolean LANGUAGE sql IMMUTABLE AS
$$ SELECT r = '0' OR r LIKE 'ERR:%' $$;
CREATE FUNCTION pg_temp.toint(r text) RETURNS int LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN r ~ '^\d+$' THEN r::int ELSE -1 END $$;

-- Exécute `sql` sous l'identité `who` (jeton {K} remplacé par _ids). DML : renvoie le nombre de lignes touchées ;
-- sinon la 1re colonne de la 1re ligne. Erreur : 'ERR:<sqlstate>:<message>'.
CREATE FUNCTION pg_temp.q(who text, sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; s text := sql; v text; u text;
BEGIN
  FOR r IN SELECT k, val FROM _ids LOOP s := replace(s, '{' || r.k || '}', r.val); END LOOP;
  IF s ~* '^\s*(update|insert|delete)' THEN
    s := 'WITH x AS (' || s || ' RETURNING 1) SELECT count(*)::text FROM x';
  END IF;
  BEGIN
    IF who = 'anon' THEN
      PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
      SET LOCAL ROLE anon;
    ELSIF who = 'service' THEN
      PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
      SET LOCAL ROLE service_role;
    ELSIF who <> 'postgres' THEN
      SELECT val INTO u FROM _ids WHERE k = who;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
    END IF;
    EXECUTE s INTO v;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    RETURN v;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'ERR:' || SQLSTATE || ':' || left(SQLERRM, 100);
  END;
END $$;

-- Joue `attack` sous `who`, relève `observe` en superutilisateur, puis annule tout.
CREATE FUNCTION pg_temp.probe(who text, attack text, observe text, OUT res text, OUT obs text)
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    res := pg_temp.q(who, attack);
    obs := pg_temp.q('postgres', observe);
    RAISE EXCEPTION 'annulation' USING ERRCODE = 'P0099';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
END $$;

-- ===== GRAINES (superutilisateur : contourne la RLS) =====
DO $$
DECLARE
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uC uuid := gen_random_uuid(); uF uuid := gen_random_uuid();
  uAF1 uuid := gen_random_uuid(); uAF2 uuid := gen_random_uuid(); uX uuid := gen_random_uuid();
  sA uuid := gen_random_uuid(); sB uuid := gen_random_uuid();
  wA uuid; wB uuid; pA uuid; pB uuid; af1 uuid; af2 uuid; oA uuid; oB uuid; v_err text;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  SELECT u, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', 'rls-' || n || '@example.test','x',now(),'{}','{}',now(),now(),'','','',''
  FROM (VALUES (uA,'a'),(uB,'b'),(uC,'c'),(uF,'f'),(uAF1,'af1'),(uAF2,'af2'),(uX,'x')) v(u, n);
  INSERT INTO public.user_roles (user_id, role) VALUES (uF, 'founder') ON CONFLICT DO NOTHING;

  -- sA : en attente de règlement de commission, activation non payée ; sB : saine
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate, commission_per_order, commission_threshold,
                            commission_balance_due, shop_payment_status, payment_deadline, first_deadline_at, threshold_reached_at)
  VALUES (sA, uA, 'RLS boutique A', 'zz-rls-a', false, true, false, 0.05, 50, 12000, 5000, 'payment_pending', now() + interval '3 days', now() + interval '3 days', now()),
         (sB, uB, 'RLS boutique B', 'zz-rls-b', true, true, true, 0.05, 50, 12000, 0, 'active', NULL, NULL, NULL);
  INSERT INTO public.shop_collaborators (shop_id, invited_email, user_id, roles, status, invitation_token, invited_by)
  VALUES (sA, 'rls-c@example.test', uC, ARRAY['edit_shop']::public.shop_collab_role[], 'active', 'rls-token-c', uA);

  PERFORM public.get_or_create_merchant_wallet(uA);
  PERFORM public.get_or_create_merchant_wallet(uB);
  SELECT id INTO wA FROM public.wallets WHERE merchant_id = uA;
  SELECT id INTO wB FROM public.wallets WHERE merchant_id = uB;
  UPDATE public.wallets SET available_balance = 50000, pending_balance = 2000, default_payout_phone = '+2250700000001', default_payout_name = 'A', default_payout_provider = 'wave' WHERE id = wA;
  UPDATE public.wallets SET available_balance = 30000, pending_balance = 0, default_payout_phone = '+2250700000002', default_payout_name = 'B', default_payout_provider = 'wave' WHERE id = wB;
  INSERT INTO public.wallet_ledger (wallet_id, merchant_id, entry_type, amount, description, running_pending_balance, running_available_balance)
  VALUES (wA, uA, 'PAYMENT_PENDING', 2000, 'rls A', 2000, 50000), (wB, uB, 'PAYMENT_PENDING', 1000, 'rls B', 0, 30000);

  INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, net_merchant_amount, status)
  VALUES ('ECM-PAY-RLSA0001', uA, sA, 'wave', 'geniuspay', 10000, 9700, 'SUCCEEDED') RETURNING id INTO pA;
  INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, shop_id, payment_method, provider, amount, net_merchant_amount, status)
  VALUES ('ECM-PAY-RLSB0001', uB, sB, 'wave', 'geniuspay', 20000, 19400, 'SUCCEEDED') RETURNING id INTO pB;
  INSERT INTO public.settlements (payment_id, merchant_id, gross_amount, net_amount, available_at)
  VALUES (pA, uA, 10000, 9700, now() + interval '1 day'), (pB, uB, 20000, 19400, now() + interval '1 day');
  INSERT INTO public.withdrawal_requests (withdrawal_reference, merchant_id, wallet_id, amount, payout_method)
  VALUES ('ECM-WDR-RLSA', uA, wA, 1000, 'mobile_money'), ('ECM-WDR-RLSB', uB, wB, 2000, 'mobile_money');
  INSERT INTO public.payment_events (event_id, provider, event_type, payload) VALUES ('RLS-EVT-1', 'geniuspay', 'test', '{}');

  INSERT INTO public.commission_payments (shop_id, amount) VALUES (sA, 5000), (sB, 6000);
  INSERT INTO public.shop_payment_events (shop_id, event_type) VALUES (sA, 'threshold_reached'), (sB, 'threshold_reached');
  INSERT INTO public.payments (user_id, amount, payment_method) VALUES (uA, 5000, 'card'), (uB, 6000, 'card');
  INSERT INTO public.subscriptions (user_id) VALUES (uA), (uB);
  INSERT INTO public.ecomfy_payment_links (link_key, shop_id, title, amount) VALUES ('rls-a', sA, 'Lien A', 1000), ('rls-b', sB, 'Lien B', 2000);

  INSERT INTO public.affiliates (user_id, affiliate_code) VALUES (uAF1, 'RLSAFF1') RETURNING id INTO af1;
  INSERT INTO public.affiliates (user_id, affiliate_code) VALUES (uAF2, 'RLSAFF2') RETURNING id INTO af2;
  INSERT INTO public.affiliate_commissions (affiliate_id, referred_user_id, amount_paid, commission_amount) VALUES (af1, uX, 10000, 1000), (af2, uB, 20000, 2000);
  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used) VALUES (af1, uX, 'RLSAFF1'), (af2, uB, 'RLSAFF2');
  INSERT INTO public.affiliate_payouts (affiliate_id, amount_paid, payment_method) VALUES (af1, 500, 'wave'), (af2, 500, 'wave');
  INSERT INTO public.affiliate_payout_methods (affiliate_id, provider, account_name) VALUES (af1, 'wave', 'AF1'), (af2, 'wave', 'AF2');
  INSERT INTO public.affiliate_audit_logs (affiliate_id, action) VALUES (af1, 'RLS_TEST');

  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (sA, 'RLS-A-1', 'Client A', '+2250700000009') RETURNING id INTO oA;
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (sB, 'RLS-B-1', 'Client B', '+2250700000008') RETURNING id INTO oB;

  INSERT INTO _ids VALUES ('A', uA), ('B', uB), ('C', uC), ('F', uF), ('AF1', uAF1), ('AF2', uAF2), ('X', uX), ('sA', sA), ('sB', sB),
    ('wA', wA), ('wB', wB), ('pA', pA), ('pB', pB), ('af1', af1), ('af2', af2), ('oA', oA), ('oB', oB);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  PERFORM pg_temp.chk('ERREUR DANS LES GRAINES (tests suivants non significatifs)', false, v_err);
END $$;

-- ===== TESTS =====
DO $$
DECLARE
  a record; p record; i int; viewer text; own text; oth text; n text; n2 text; base text; v_err text;
  cm text := $c$merchant_id IN ('{A}','{B}','{X}')$c$;
  cu text := $c$user_id IN ('{A}','{B}')$c$;
  cs text := $c$shop_id IN ('{sA}','{sB}')$c$;
  caf text := $c$affiliate_id IN ('{af1}','{af2}')$c$;
  obs text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _ids) THEN RETURN; END IF;

  -- 0. Témoin : les graines existent (sinon « 0 ligne visible » ne prouverait rien)
  PERFORM pg_temp.chk('graines présentes', (SELECT count(*) FROM public.wallets WHERE merchant_id IN ((SELECT val::uuid FROM _ids WHERE k='A'), (SELECT val::uuid FROM _ids WHERE k='B'))) = 2
    AND (SELECT count(*) FROM public.affiliate_commissions WHERE affiliate_id IN ((SELECT val::uuid FROM _ids WHERE k='af1'), (SELECT val::uuid FROM _ids WHERE k='af2'))) = 2);

  -- 1. LECTURE : chacun ne voit que ses lignes ; un tiers connecté et un visiteur ne voient rien
  FOR a IN SELECT * FROM (VALUES
    ('wallets','merchant_id','A','B','A','B'), ('wallet_ledger','merchant_id','A','B','A','B'),
    ('withdrawal_requests','merchant_id','A','B','A','B'), ('settlements','merchant_id','A','B','A','B'),
    ('ecomfy_payments','merchant_id','A','B','A','B'), ('payments','user_id','A','B','A','B'),
    ('subscriptions','user_id','A','B','A','B'), ('commission_payments','shop_id','sA','sB','A','B'),
    ('shop_payment_events','shop_id','sA','sB','A','B'), ('affiliates','user_id','AF1','AF2','AF1','AF2'),
    ('affiliate_commissions','affiliate_id','af1','af2','AF1','AF2'), ('affiliate_referrals','affiliate_id','af1','af2','AF1','AF2'),
    ('affiliate_payouts','affiliate_id','af1','af2','AF1','AF2'), ('affiliate_payout_methods','affiliate_id','af1','af2','AF1','AF2')
  ) v(tbl, col, k1, k2, w1, w2) LOOP
    FOR i IN 1..2 LOOP
      viewer := CASE i WHEN 1 THEN a.w1 ELSE a.w2 END;
      own := CASE i WHEN 1 THEN a.k1 ELSE a.k2 END;
      oth := CASE i WHEN 1 THEN a.k2 ELSE a.k1 END;
      n := pg_temp.q(viewer, format('SELECT count(*) FROM public.%s WHERE %s = ''{%s}''', a.tbl, a.col, own));
      n2 := pg_temp.q(viewer, format('SELECT count(*) FROM public.%s WHERE %s = ''{%s}''', a.tbl, a.col, oth));
      PERFORM pg_temp.chk(format('lecture %s : %s voit les siennes et pas celles de l''autre', a.tbl, viewer),
        pg_temp.toint(n) >= 1 AND pg_temp.denied(n2), format('siennes=%s autre=%s', n, n2));
    END LOOP;
    FOREACH viewer IN ARRAY ARRAY['X', 'anon'] LOOP
      n := pg_temp.q(viewer, format('SELECT count(*) FROM public.%s WHERE %s IN (''{%s}'',''{%s}'')', a.tbl, a.col, a.k1, a.k2));
      PERFORM pg_temp.chk(format('lecture %s : %s ne voit rien', a.tbl, viewer), pg_temp.denied(n), 'vu=' || n);
    END LOOP;
  END LOOP;

  -- Tables sans aucune politique (réservées au serveur) : invisibles pour tous les rôles clients
  FOREACH viewer IN ARRAY ARRAY['A', 'F', 'anon'] LOOP
    n := pg_temp.q(viewer, $s$SELECT count(*) FROM public.payment_events WHERE event_id = 'RLS-EVT-1'$s$);
    PERFORM pg_temp.chk('lecture payment_events : ' || viewer || ' ne voit rien', pg_temp.denied(n), 'vu=' || n);
  END LOOP;
  FOREACH viewer IN ARRAY ARRAY['AF1', 'F', 'anon'] LOOP
    n := pg_temp.q(viewer, $s$SELECT count(*) FROM public.affiliate_audit_logs WHERE action = 'RLS_TEST'$s$);
    PERFORM pg_temp.chk('lecture affiliate_audit_logs : ' || viewer || ' ne voit rien', pg_temp.denied(n), 'vu=' || n);
  END LOOP;

  -- Commandes : une boutique ne voit jamais celles d'une autre
  FOREACH viewer IN ARRAY ARRAY['A', 'B'] LOOP
    n := pg_temp.q(viewer, format('SELECT count(*) FROM public.orders WHERE shop_id = ''{%s}''', CASE viewer WHEN 'A' THEN 'sB' ELSE 'sA' END));
    PERFORM pg_temp.chk('lecture orders : ' || viewer || ' ne voit pas les commandes de l''autre boutique', pg_temp.denied(n), 'vu=' || n);
  END LOOP;
  FOREACH viewer IN ARRAY ARRAY['X', 'anon'] LOOP
    n := pg_temp.q(viewer, $s$SELECT count(*) FROM public.orders WHERE shop_id IN ('{sA}','{sB}')$s$);
    PERFORM pg_temp.chk('lecture orders : ' || viewer || ' ne voit aucune commande', pg_temp.denied(n), 'vu=' || n);
  END LOOP;

  -- Le fondateur lit bien ce que ses écrans d'administration lui montrent (témoin de politique)
  FOR a IN SELECT * FROM (VALUES
    ('commission_payments', cs), ('shop_payment_events', cs), ('payments', cu), ('subscriptions', cu),
    ('affiliates', $c$user_id IN ('{AF1}','{AF2}')$c$), ('affiliate_commissions', caf), ('affiliate_payouts', caf)
  ) v(tbl, cond) LOOP
    n := pg_temp.q('F', format('SELECT count(*) FROM public.%s WHERE %s', a.tbl, a.cond));
    PERFORM pg_temp.chk('lecture ' || a.tbl || ' : le fondateur voit les deux', n = '2', 'vu=' || n);
  END LOOP;

  -- 2. ÉCRITURE DIRECTE interdite (le client ne touche jamais l'argent hors des fonctions serveur)
  FOR a IN SELECT * FROM (VALUES
    -- portefeuille
    ('wallets', cm, 'A', $q$UPDATE public.wallets SET available_balance = 99999999 WHERE merchant_id = '{A}'$q$, 'A gonfle son solde disponible'),
    ('wallets', cm, 'A', $q$UPDATE public.wallets SET pending_balance = 0, total_withdrawn = 0 WHERE merchant_id = '{A}'$q$, 'A remet ses compteurs à zéro'),
    ('wallets', cm, 'A', $q$UPDATE public.wallets SET default_payout_phone = '+2250799999999' WHERE merchant_id = '{B}'$q$, 'A détourne le numéro de retrait de B'),
    ('wallets', cm, 'A', $q$UPDATE public.wallets SET default_payout_phone = '+2250799999999' WHERE merchant_id = '{A}'$q$, 'A change son numéro hors fonction serveur'),
    ('wallets', cm, 'A', $q$INSERT INTO public.wallets (merchant_id, available_balance) VALUES ('{X}', 1000000)$q$, 'A crée un portefeuille crédité'),
    ('wallets', cm, 'A', $q$DELETE FROM public.wallets WHERE merchant_id IN ('{A}','{B}')$q$, 'A supprime des portefeuilles'),
    ('wallets', cm, 'anon', $q$UPDATE public.wallets SET available_balance = 1 WHERE merchant_id = '{A}'$q$, 'visiteur modifie un portefeuille'),
    -- registre
    ('wallet_ledger', cm, 'A', $q$INSERT INTO public.wallet_ledger (wallet_id, merchant_id, entry_type, amount, description, running_pending_balance, running_available_balance) VALUES ('{wA}', '{A}', 'SETTLEMENT_AVAILABLE', 1000000, 'faux', 0, 1000000)$q$, 'A s''écrit un crédit au registre'),
    ('wallet_ledger', cm, 'A', $q$UPDATE public.wallet_ledger SET amount = 1000000 WHERE merchant_id = '{A}'$q$, 'A modifie ses écritures'),
    ('wallet_ledger', cm, 'A', $q$DELETE FROM public.wallet_ledger WHERE merchant_id IN ('{A}','{B}')$q$, 'A efface le registre'),
    ('wallet_ledger', cm, 'anon', $q$INSERT INTO public.wallet_ledger (wallet_id, merchant_id, entry_type, amount, description, running_pending_balance, running_available_balance) VALUES ('{wA}', '{A}', 'SETTLEMENT_AVAILABLE', 1, 'faux', 0, 1)$q$, 'visiteur écrit au registre'),
    -- retraits
    ('withdrawal_requests', cm, 'A', $q$INSERT INTO public.withdrawal_requests (withdrawal_reference, merchant_id, wallet_id, amount, payout_method, status) VALUES ('ECM-WDR-FAKE', '{A}', '{wA}', 50000, 'mobile_money', 'COMPLETED')$q$, 'A fabrique un retrait'),
    ('withdrawal_requests', cm, 'A', $q$UPDATE public.withdrawal_requests SET status = 'FAILED' WHERE merchant_id = '{A}'$q$, 'A marque son retrait échoué'),
    ('withdrawal_requests', cm, 'A', $q$UPDATE public.withdrawal_requests SET amount = 1 WHERE merchant_id = '{B}'$q$, 'A modifie le retrait de B'),
    ('withdrawal_requests', cm, 'A', $q$DELETE FROM public.withdrawal_requests WHERE merchant_id IN ('{A}','{B}')$q$, 'A supprime des retraits'),
    -- règlements
    ('settlements', cm, 'A', $q$UPDATE public.settlements SET available_at = now() - interval '1 day' WHERE merchant_id = '{A}'$q$, 'A accélère son règlement'),
    ('settlements', cm, 'A', $q$UPDATE public.settlements SET net_amount = 99999999 WHERE merchant_id = '{A}'$q$, 'A gonfle son règlement'),
    ('settlements', cm, 'A', $q$INSERT INTO public.settlements (payment_id, merchant_id, gross_amount, net_amount, available_at) VALUES ('{pA}', '{A}', 1, 1000000, now())$q$, 'A crée un règlement'),
    ('settlements', cm, 'A', $q$DELETE FROM public.settlements WHERE merchant_id IN ('{A}','{B}')$q$, 'A supprime des règlements'),
    -- paiements Ecomfy Pay
    ('ecomfy_payments', cm, 'A', $q$UPDATE public.ecomfy_payments SET net_merchant_amount = 99999999 WHERE merchant_id = '{A}'$q$, 'A gonfle le net d''un paiement'),
    ('ecomfy_payments', cm, 'A', $q$UPDATE public.ecomfy_payments SET status = 'REFUNDED' WHERE merchant_id = '{B}'$q$, 'A change le statut d''un paiement de B'),
    ('ecomfy_payments', cm, 'A', $q$INSERT INTO public.ecomfy_payments (internal_reference, merchant_id, payment_method, amount, net_merchant_amount, status) VALUES ('ECM-PAY-FAKE', '{A}', 'wave', 100000, 100000, 'SUCCEEDED')$q$, 'A fabrique un paiement réussi'),
    ('ecomfy_payments', cm, 'A', $q$DELETE FROM public.ecomfy_payments WHERE merchant_id IN ('{A}','{B}')$q$, 'A supprime des paiements'),
    ('ecomfy_payments', cm, 'anon', $q$UPDATE public.ecomfy_payments SET status = 'SUCCEEDED' WHERE merchant_id = '{A}'$q$, 'visiteur valide un paiement'),
    ('payment_events', $c$event_id LIKE 'RLS-%' OR event_id LIKE 'FAKE-%'$c$, 'A', $q$INSERT INTO public.payment_events (event_id, provider, event_type, payload) VALUES ('FAKE-1', 'geniuspay', 'payment.success', '{}')$q$, 'A fabrique un évènement opérateur'),
    ('payment_events', $c$event_id LIKE 'RLS-%' OR event_id LIKE 'FAKE-%'$c$, 'anon', $q$INSERT INTO public.payment_events (event_id, provider, event_type, payload) VALUES ('FAKE-2', 'geniuspay', 'payment.success', '{}')$q$, 'visiteur fabrique un évènement opérateur'),
    ('payment_events', $c$event_id LIKE 'RLS-%' OR event_id LIKE 'FAKE-%'$c$, 'A', $q$DELETE FROM public.payment_events WHERE event_id = 'RLS-EVT-1'$q$, 'A efface un évènement opérateur'),
    -- paiements et abonnements historiques
    ('payments', cu, 'A', $q$INSERT INTO public.payments (user_id, amount, payment_method) VALUES ('{A}', 1, 'card')$q$, 'A s''enregistre un paiement'),
    ('payments', cu, 'A', $q$UPDATE public.payments SET amount = 99999999 WHERE user_id IN ('{A}','{B}')$q$, 'A modifie des paiements'),
    ('payments', cu, 'A', $q$DELETE FROM public.payments WHERE user_id IN ('{A}','{B}')$q$, 'A supprime des paiements'),
    ('payments', cu, 'anon', $q$INSERT INTO public.payments (user_id, amount, payment_method) VALUES ('{A}', 1, 'card')$q$, 'visiteur crée un paiement'),
    ('subscriptions', cu, 'A', $q$UPDATE public.subscriptions SET status = 'active', amount = 0, end_date = now() + interval '10 years' WHERE user_id = '{A}'$q$, 'A s''octroie un abonnement'),
    ('subscriptions', cu, 'A', $q$INSERT INTO public.subscriptions (user_id, status, end_date) VALUES ('{X}', 'active', now() + interval '10 years')$q$, 'A crée un abonnement'),
    ('subscriptions', cu, 'A', $q$DELETE FROM public.subscriptions WHERE user_id IN ('{A}','{B}')$q$, 'A supprime des abonnements'),
    -- commission de boutique
    ('commission_payments', cs, 'A', $q$INSERT INTO public.commission_payments (shop_id, amount, status) VALUES ('{sA}', 5000, 'completed')$q$, 'A s''écrit un règlement de commission'),
    ('commission_payments', cs, 'A', $q$UPDATE public.commission_payments SET amount = 1 WHERE shop_id IN ('{sA}','{sB}')$q$, 'A modifie des règlements de commission'),
    ('commission_payments', cs, 'A', $q$DELETE FROM public.commission_payments WHERE shop_id IN ('{sA}','{sB}')$q$, 'A supprime des règlements de commission'),
    ('shop_payment_events', cs, 'A', $q$INSERT INTO public.shop_payment_events (shop_id, event_type) VALUES ('{sA}', 'manual_override')$q$, 'A s''écrit une dérogation'),
    ('shop_payment_events', cs, 'A', $q$DELETE FROM public.shop_payment_events WHERE shop_id IN ('{sA}','{sB}')$q$, 'A efface l''historique de verrouillage'),
    ('shop_payment_events', cs, 'C', $q$DELETE FROM public.shop_payment_events WHERE shop_id = '{sA}'$q$, 'C (collaborateur) efface l''historique de verrouillage'),
    -- liens de paiement
    ('ecomfy_payment_links', cs, 'A', $q$INSERT INTO public.ecomfy_payment_links (link_key, shop_id, title, amount) VALUES ('rls-evil', '{sB}', 'Piège', 1)$q$, 'A crée un lien sur la boutique de B'),
    ('ecomfy_payment_links', cs, 'A', $q$UPDATE public.ecomfy_payment_links SET amount = 1 WHERE shop_id = '{sB}'$q$, 'A modifie le lien de B'),
    ('ecomfy_payment_links', cs, 'A', $q$DELETE FROM public.ecomfy_payment_links WHERE shop_id = '{sB}'$q$, 'A supprime le lien de B'),
    ('ecomfy_payment_links', cs, 'X', $q$INSERT INTO public.ecomfy_payment_links (link_key, shop_id, title, amount) VALUES ('rls-evil2', '{sA}', 'Piège', 1)$q$, 'X crée un lien sur la boutique de A'),
    ('ecomfy_payment_links', cs, 'anon', $q$UPDATE public.ecomfy_payment_links SET amount = 1 WHERE shop_id IN ('{sA}','{sB}')$q$, 'visiteur modifie un lien'),
    -- commandes d'une autre boutique
    ('orders', $c$shop_id IN ('{sA}','{sB}')$c$, 'A', $q$UPDATE public.orders SET payment_status = 'paid', total = 1 WHERE shop_id = '{sB}'$q$, 'A modifie les commandes de B'),
    ('orders', $c$shop_id IN ('{sA}','{sB}')$c$, 'A', $q$DELETE FROM public.orders WHERE shop_id = '{sB}'$q$, 'A supprime les commandes de B'),
    ('orders', $c$shop_id IN ('{sA}','{sB}')$c$, 'anon', $q$UPDATE public.orders SET payment_status = 'paid' WHERE shop_id IN ('{sA}','{sB}')$q$, 'visiteur modifie une commande'),
    ('orders', $c$shop_id IN ('{sA}','{sB}')$c$, 'anon', $q$DELETE FROM public.orders WHERE shop_id IN ('{sA}','{sB}')$q$, 'visiteur supprime une commande'),
    -- affiliation
    ('affiliates', $c$user_id IN ('{AF1}','{AF2}')$c$, 'AF1', $q$UPDATE public.affiliates SET commission_rate = 1 WHERE user_id = '{AF1}'$q$, 'AF1 relève son taux de commission'),
    ('affiliates', $c$user_id IN ('{AF1}','{AF2}')$c$, 'AF1', $q$INSERT INTO public.affiliates (user_id, affiliate_code) VALUES ('{X}', 'RLSEVIL')$q$, 'AF1 crée un profil d''affilié'),
    ('affiliates', $c$user_id IN ('{AF1}','{AF2}')$c$, 'AF1', $q$DELETE FROM public.affiliates WHERE user_id IN ('{AF1}','{AF2}')$q$, 'AF1 supprime des affiliés'),
    ('affiliate_commissions', caf, 'AF1', $q$UPDATE public.affiliate_commissions SET commission_amount = 999999 WHERE affiliate_id = '{af1}'$q$, 'AF1 gonfle sa commission'),
    ('affiliate_commissions', caf, 'AF1', $q$UPDATE public.affiliate_commissions SET status = 'PAID' WHERE affiliate_id = '{af2}'$q$, 'AF1 change le statut des commissions de AF2'),
    ('affiliate_commissions', caf, 'AF1', $q$INSERT INTO public.affiliate_commissions (affiliate_id, referred_user_id, amount_paid, commission_amount) VALUES ('{af1}', '{X}', 1000000, 500000)$q$, 'AF1 s''écrit une commission'),
    ('affiliate_commissions', caf, 'AF1', $q$DELETE FROM public.affiliate_commissions WHERE affiliate_id IN ('{af1}','{af2}')$q$, 'AF1 supprime des commissions'),
    ('affiliate_payouts', caf, 'AF1', $q$INSERT INTO public.affiliate_payouts (affiliate_id, amount_paid, payment_method) VALUES ('{af1}', 100000, 'wave')$q$, 'AF1 s''écrit un versement'),
    ('affiliate_payouts', caf, 'AF1', $q$UPDATE public.affiliate_payouts SET amount_paid = 1 WHERE affiliate_id IN ('{af1}','{af2}')$q$, 'AF1 modifie des versements'),
    ('affiliate_payouts', caf, 'AF1', $q$DELETE FROM public.affiliate_payouts WHERE affiliate_id IN ('{af1}','{af2}')$q$, 'AF1 supprime des versements'),
    ('affiliate_referrals', caf, 'AF1', $q$INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used) VALUES ('{af1}', '{A}', 'RLSAFF1')$q$, 'AF1 s''attribue un filleul'),
    ('affiliate_referrals', caf, 'AF1', $q$DELETE FROM public.affiliate_referrals WHERE affiliate_id IN ('{af1}','{af2}')$q$, 'AF1 supprime des parrainages'),
    ('affiliate_payout_methods', caf, 'AF1', $q$INSERT INTO public.affiliate_payout_methods (affiliate_id, provider, account_name) VALUES ('{af2}', 'wave', 'Pirate')$q$, 'AF1 ajoute un moyen de versement chez AF2'),
    ('affiliate_payout_methods', caf, 'AF1', $q$UPDATE public.affiliate_payout_methods SET account_name = 'Pirate' WHERE affiliate_id = '{af2}'$q$, 'AF1 détourne le moyen de versement de AF2'),
    ('affiliate_payout_methods', caf, 'anon', $q$UPDATE public.affiliate_payout_methods SET account_name = 'Pirate' WHERE affiliate_id IN ('{af1}','{af2}')$q$, 'visiteur détourne un moyen de versement'),
    ('affiliate_audit_logs', $c$action IN ('RLS_TEST', 'FAKE')$c$, 'AF1', $q$DELETE FROM public.affiliate_audit_logs WHERE action = 'RLS_TEST'$q$, 'AF1 efface le journal d''audit'),
    ('affiliate_audit_logs', $c$action IN ('RLS_TEST', 'FAKE')$c$, 'AF1', $q$INSERT INTO public.affiliate_audit_logs (affiliate_id, action) VALUES ('{af1}', 'FAKE')$q$, 'AF1 écrit au journal d''audit'),
    ('affiliate_settings', 'true', 'AF1', $q$UPDATE public.affiliate_settings SET updated_at = now()$q$, 'AF1 modifie les réglages d''affiliation'),
    ('affiliate_settings', 'true', 'anon', $q$INSERT INTO public.affiliate_settings (key, value) VALUES ('rls_probe', '1')$q$, 'visiteur ajoute un réglage d''affiliation')
  ) v(tbl, cond, who, sql, label) LOOP
    obs := format($f$SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM public.%s t WHERE %s$f$, a.tbl, a.cond);
    base := pg_temp.q('postgres', obs);
    SELECT * INTO p FROM pg_temp.probe(a.who, a.sql, obs);
    PERFORM pg_temp.chk(format('écriture %s : %s refusé', a.tbl, a.label), pg_temp.denied(p.res) AND p.obs IS NOT DISTINCT FROM base,
      format('résultat=%s état_inchangé=%s', p.res, p.obs IS NOT DISTINCT FROM base));
  END LOOP;

  -- 3. FACTURATION DE LA BOUTIQUE : le propriétaire et son collaborateur « edit_shop » ne réécrivent pas leur dette,
  --    leur taux, leur statut de verrouillage, leurs échéances ni leur abonnement (politique « ALL » sur shops)
  FOR a IN SELECT * FROM (VALUES
    ('commission_balance_due', '0', 'efface sa dette de commission'),
    ('commission_rate', '0', 'met son taux à 0'),
    ('commission_per_order', '0', 'met sa commission par commande à 0'),
    ('commission_threshold', '99999999', 'relève son seuil de blocage'),
    ('shop_payment_status', $e$'active'$e$, 'repasse en « active »'),
    ('is_suspended', 'true', 'se suspend / se lève de suspension'),
    ('payment_deadline', $e$now() + interval '90 days'$e$, 'repousse l''échéance de paiement'),
    ('first_deadline_at', $e$now() + interval '90 days'$e$, 'repousse la première échéance'),
    ('second_deadline_at', $e$now() + interval '90 days'$e$, 'repousse la seconde échéance'),
    ('threshold_reached_at', 'NULL', 'efface la date de seuil atteint'),
    ('extra_deadline_active', 'true', 'active un délai supplémentaire'),
    ('extra_deadline_ends_at', $e$now() + interval '90 days'$e$, 'fixe la fin d''un délai supplémentaire'),
    ('subscription_plan', $e$'pro_yearly'$e$, 'se donne un plan d''abonnement'),
    ('subscription_active_until', $e$now() + interval '10 years'$e$, 'se donne 10 ans d''abonnement (donc 0 commission)'),
    ('is_subscribed', 'true', 'se déclare abonné'),
    ('is_activated', 'true', 'se déclare activé sans payer'),
    ('activation_fee_paid', 'true', 'déclare les frais d''activation payés'),
    ('total_sales', '99999999', 'falsifie son chiffre d''affaires')
  ) v(col, expr, label) LOOP
    obs := format('SELECT %I::text FROM public.shops WHERE id = ''{sA}''', a.col);
    base := pg_temp.q('postgres', obs);
    FOREACH viewer IN ARRAY ARRAY['A', 'C'] LOOP
      SELECT * INTO p FROM pg_temp.probe(viewer, format('UPDATE public.shops SET %I = %s WHERE id = ''{sA}''', a.col, a.expr), obs);
      PERFORM pg_temp.chk(format('shops.%s : %s ne %s', a.col, CASE viewer WHEN 'A' THEN 'le propriétaire' ELSE 'le collaborateur' END, a.label),
        p.obs IS NOT DISTINCT FROM base AND p.res LIKE 'ERR:42501:shop_billing_columns_protected%', format('avant=%s après=%s résultat=%s', base, p.obs, p.res));
    END LOOP;
  END LOOP;

  -- 3b. Création d'une boutique : les colonnes de facturation restent aux valeurs par défaut
  FOR a IN SELECT * FROM (VALUES
    ('subscription_active_until', $e$now() + interval '10 years'$e$, 'naît avec 10 ans d''abonnement'),
    ('commission_rate', '0', 'naît avec une commission à 0'),
    ('commission_threshold', '99999999', 'naît sans seuil de blocage'),
    ('is_activated', 'true', 'naît activée sans payer'),
    ('activation_fee_paid', 'true', 'naît avec les frais d''activation payés'),
    ('subscription_plan', $e$'pro_yearly'$e$, 'naît avec un plan payant'),
    ('total_sales', '99999999', 'naît avec un faux chiffre d''affaires')
  ) v(col, expr, label) LOOP
    obs := $s$SELECT count(*)::text FROM public.shops WHERE slug = 'zz-rls-ins'$s$;
    SELECT * INTO p FROM pg_temp.probe('X', format('INSERT INTO public.shops (user_id, business_name, slug, %I) VALUES (''{X}'', ''Ins'', ''zz-rls-ins'', %s)', a.col, a.expr), obs);
    PERFORM pg_temp.chk(format('shops INSERT : un marchand ne crée pas une boutique qui %s', a.label), p.res LIKE 'ERR:42501:shop_billing_columns_protected%' AND p.obs = '0', format('résultat=%s boutiques créées=%s', p.res, p.obs));
  END LOOP;
  SELECT * INTO p FROM pg_temp.probe('X', $s$INSERT INTO public.shops (user_id, business_name, slug) VALUES ('{X}', 'Ins', 'zz-rls-ins')$s$,
    $s$SELECT count(*)::text FROM public.shops WHERE slug = 'zz-rls-ins'$s$);
  PERFORM pg_temp.chk('témoin : un marchand crée une boutique avec les valeurs par défaut', p.res = '1', 'résultat=' || p.res);

  -- 4. FONCTIONS : droits d'exécution et contrôles internes
  -- 4a. Fonctions internes : ni anon ni authenticated
  FOR a IN SELECT * FROM (VALUES
    ('credit_merchant_wallet_pending'), ('refund_merchant_payment'), ('process_wallet_settlements'), ('finalize_withdrawal'),
    ('confirm_ecomfy_payment'), ('apply_shop_subscription'), ('apply_commission_payment'), ('get_or_create_merchant_wallet'),
    ('process_affiliate_commission_for_payment'), ('reverse_affiliate_commission_for_payment'), ('replay_incomplete_ecomfy_payments'),
    ('expire_stale_pending_payments'), ('ecomfy_log_payment_event'), ('enforce_all_shop_payment_states'), ('prepare_shop_activation_payment')
  ) v(fn) LOOP
    PERFORM pg_temp.chk('EXECUTE ' || a.fn || ' réservé au serveur',
      EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = a.fn)
      AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = a.fn
                      AND (has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'))),
      'fonction absente ou exposée aux rôles clients');
  END LOOP;
  -- 4b. Garde-fou : toute nouvelle fonction SECURITY DEFINER « argent » exposée doit être examinée puis ajoutée ici
  n := (SELECT string_agg(proname, ', ' ORDER BY proname) FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace AND prosecdef AND prokind = 'f'
          AND proname ~ '(wallet|ledger|refund|withdraw|settle|payout|affiliate|commission|confirm_|credit_|debit_|subscription|payment|billing|invoice|operator)'
          AND has_function_privilege('anon', oid, 'EXECUTE')
          AND proname NOT IN ('enforce_shop_payment_state_for', 'founder_reset_shop_payment', 'get_my_subscription_status'));
  PERFORM pg_temp.chk('garde-fou : aucune fonction « argent » SECURITY DEFINER inconnue ouverte à anon', n IS NULL, COALESCE(n, ''));
  n := (SELECT string_agg(proname, ', ' ORDER BY proname) FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace AND prosecdef AND prokind = 'f'
          AND proname ~ '(wallet|ledger|refund|withdraw|settle|payout|affiliate|commission|confirm_|credit_|debit_|subscription|payment|billing|invoice|operator)'
          AND has_function_privilege('authenticated', oid, 'EXECUTE')
          AND proname NOT IN ('enforce_shop_payment_state_for', 'founder_reset_shop_payment', 'get_or_create_my_wallet', 'mark_affiliate_payout_paid',
                              'process_referral_signup', 'record_affiliate_referral', 'request_wallet_withdrawal_atomic', 'save_merchant_payout_config',
                              -- liées à auth.uid() ; is_shop_subscription_active accepte n'importe quelle boutique mais ne dit que « abonnement en cours ? »
                              'get_my_subscription_status', 'enforce_subscription_expiry_for', 'get_or_create_my_affiliate', 'is_shop_subscription_active'));
  PERFORM pg_temp.chk('garde-fou : aucune fonction « argent » SECURITY DEFINER inconnue ouverte à authenticated', n IS NULL, COALESCE(n, ''));

  -- 4c. Retraits et portefeuille : l'identité vient du jeton, jamais d'un paramètre
  n := pg_temp.q('anon', 'SELECT public.get_or_create_my_wallet()::text');
  PERFORM pg_temp.chk('get_or_create_my_wallet refusée au visiteur', n LIKE 'ERR:%', n);
  n := pg_temp.q('anon', $s$SELECT public.request_wallet_withdrawal_atomic(1000, 'mobile_money')::text$s$);
  PERFORM pg_temp.chk('retrait refusé au visiteur', n LIKE 'ERR:%', n);
  SELECT * INTO p FROM pg_temp.probe('A', $s$SELECT public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '+2250700000001', 'A', NULL, 'XOF', 'wave')::text$s$,
    $s$SELECT (SELECT available_balance FROM public.wallets WHERE id = '{wA}')::text || '/' || (SELECT count(*) FROM public.withdrawal_requests WHERE merchant_id = '{A}')::text$s$);
  PERFORM pg_temp.chk('retrait refusé sans KYC vérifié (solde et demandes inchangés)', p.res LIKE '%"success": false%' AND p.obs ~ '^50000(\.0+)?/1$',
    format('résultat=%s état=%s', p.res, p.obs));

  -- save_merchant_payout_config : ne touche que le portefeuille de l'appelant
  base := pg_temp.q('postgres', $s$SELECT default_payout_phone FROM public.wallets WHERE id = '{wB}'$s$);
  SELECT * INTO p FROM pg_temp.probe('A', $s$SELECT public.save_merchant_payout_config('+2250711111111', 'A2', 'wave')::text$s$,
    $s$SELECT (SELECT default_payout_phone FROM public.wallets WHERE id = '{wB}') || '/' || (SELECT default_payout_phone FROM public.wallets WHERE id = '{wA}')$s$);
  PERFORM pg_temp.chk('save_merchant_payout_config : change le portefeuille de l''appelant seulement', p.obs = base || '/+2250711111111', format('résultat=%s état=%s', p.res, p.obs));

  -- 4d. Fondateur : founder_reset_shop_payment et mark_affiliate_payout_paid refusées aux autres
  FOREACH viewer IN ARRAY ARRAY['A', 'C', 'X', 'anon'] LOOP
    SELECT * INTO p FROM pg_temp.probe(viewer, $s$SELECT public.founder_reset_shop_payment('{sA}', 'test')::text$s$,
      $s$SELECT shop_payment_status || '/' || commission_balance_due FROM public.shops WHERE id = '{sA}'$s$);
    PERFORM pg_temp.chk('founder_reset_shop_payment refusée à ' || viewer || ' (dette et statut inchangés)', p.res LIKE 'ERR:%' AND p.obs LIKE 'payment_pending/50%', format('résultat=%s état=%s', p.res, p.obs));
  END LOOP;
  FOREACH viewer IN ARRAY ARRAY['AF1', 'A', 'X', 'anon'] LOOP
    SELECT * INTO p FROM pg_temp.probe(viewer, $s$SELECT public.mark_affiliate_payout_paid('{af1}', 1000, 'wave', 'REF-RLS')::text$s$,
      $s$SELECT (SELECT count(*) FROM public.affiliate_payouts WHERE affiliate_id IN ('{af1}','{af2}'))::text || '/' || (SELECT count(*) FROM public.affiliate_commissions WHERE status = 'PAID' AND affiliate_id IN ('{af1}','{af2}'))::text$s$);
    PERFORM pg_temp.chk('mark_affiliate_payout_paid refusée à ' || viewer || ' (aucun versement créé)', p.res LIKE 'ERR:%' AND p.obs = '2/0', format('résultat=%s état=%s', p.res, p.obs));
  END LOOP;

  -- Affiliation et abonnement : fonctions du compte connecté
  n := pg_temp.q('anon', $s$SELECT public.get_or_create_my_affiliate('Pirate')::text$s$);
  PERFORM pg_temp.chk('get_or_create_my_affiliate refusée au visiteur', n LIKE 'ERR:%', n);
  SELECT * INTO p FROM pg_temp.probe('X', $s$SELECT public.get_or_create_my_affiliate('Pirate')::text$s$,
    $s$SELECT count(*)::text || '/' || coalesce(max(commission_rate)::text, '') FROM public.affiliates WHERE user_id = '{X}'$s$);
  PERFORM pg_temp.chk('get_or_create_my_affiliate : profil de l''appelant seulement, taux fixé par le serveur (0.20)', p.obs ~ '^1/0\.20?$' AND p.res LIKE '%"status": "active"%', format('résultat=%s état=%s', p.res, p.obs));
  n := pg_temp.q('X', $s$SELECT public.enforce_subscription_expiry_for('{sA}')::text$s$);
  PERFORM pg_temp.chk('enforce_subscription_expiry_for : sans effet sur la boutique d''un autre', n = 'none', n);

  -- 4e. enforce_shop_payment_state_for (ouverte à tous) ne verrouille pas une boutique dont l'échéance n'est pas échue
  FOREACH base IN ARRAY ARRAY['sA', 'sB'] LOOP
    SELECT * INTO p FROM pg_temp.probe('anon', format('SELECT public.enforce_shop_payment_state_for(''{%s}'')::text', base),
      format('SELECT shop_payment_status || ''/'' || is_suspended FROM public.shops WHERE id = ''{%s}''', base));
    PERFORM pg_temp.chk('enforce_shop_payment_state_for (visiteur) ne verrouille pas ' || base, p.res LIKE '%"changed": null%' AND p.obs IN ('payment_pending/f', 'active/f', 'payment_pending/false', 'active/false'),
      format('résultat=%s état=%s', p.res, p.obs));
  END LOOP;

  -- 5. TÉMOINS POSITIFS : les droits légitimes fonctionnent (sinon les refus ci-dessus pourraient venir d'une erreur de test)
  n := pg_temp.q('A', $s$UPDATE public.ecomfy_payment_links SET amount = 1500 WHERE shop_id = '{sA}'$s$);
  PERFORM pg_temp.chk('témoin : le marchand modifie son propre lien de paiement', n = '1', 'résultat=' || n);
  n := pg_temp.q('AF1', $s$UPDATE public.affiliate_payout_methods SET account_name = 'AF1 bis' WHERE affiliate_id = '{af1}'$s$);
  PERFORM pg_temp.chk('témoin : l''affilié modifie son propre moyen de versement', n = '1', 'résultat=' || n);
  n := pg_temp.q('F', $s$INSERT INTO public.commission_payments (shop_id, amount) VALUES ('{sB}', 1000)$s$);
  PERFORM pg_temp.chk('témoin : le fondateur enregistre un règlement de commission', n = '1', 'résultat=' || n);
  n := pg_temp.q('A', $s$SELECT (public.get_or_create_my_wallet()).available_balance::text$s$);
  PERFORM pg_temp.chk('témoin : le marchand lit son portefeuille par la fonction', pg_temp.toint(split_part(n, '.', 1)) = 50000, 'solde=' || n);

  -- Fondateur : réactivation manuelle (la seule voie pour effacer une dette) ; versement d'affiliation exact, une seule fois
  n := pg_temp.q('F', $s$SELECT public.founder_reset_shop_payment('{sA}', 'test RLS')::text$s$);
  base := pg_temp.q('postgres', $s$SELECT shop_payment_status || '/' || commission_balance_due FROM public.shops WHERE id = '{sA}'$s$);
  PERFORM pg_temp.chk('témoin : le fondateur réactive la boutique et remet la dette à 0', n LIKE '%"success": true%' AND base LIKE 'active/0%', format('résultat=%s état=%s', n, base));
  -- Le garde de facturation laisse passer les chemins légitimes
  n := pg_temp.q('A', $s$UPDATE public.shops SET business_name = 'RLS A renommée', whatsapp_number = '+2250700000005' WHERE id = '{sA}'$s$);
  PERFORM pg_temp.chk('témoin : le propriétaire modifie les réglages ordinaires de sa boutique', n = '1', 'résultat=' || n);
  n := pg_temp.q('C', $s$UPDATE public.shops SET business_name = 'RLS A par C' WHERE id = '{sA}'$s$);
  PERFORM pg_temp.chk('témoin : le collaborateur edit_shop modifie les réglages ordinaires', n = '1', 'résultat=' || n);
  n := pg_temp.q('service', $s$UPDATE public.shops SET subscription_plan = 'pro_monthly', subscription_active_until = now() + interval '30 days', commission_balance_due = 0 WHERE id = '{sA}'$s$);
  PERFORM pg_temp.chk('témoin : service_role (Edge Functions) écrit la facturation', n = '1', 'résultat=' || n);
  -- Chemin serveur déclenché depuis un rôle client : le verrouillage automatique (SECURITY DEFINER) s'applique toujours
  n := pg_temp.q('postgres', $s$UPDATE public.shops SET shop_payment_status = 'payment_pending', commission_balance_due = 5000, first_deadline_at = now() - interval '1 day' WHERE id = '{sB}'$s$);
  n := pg_temp.q('anon', $s$SELECT public.enforce_shop_payment_state_for('{sB}')::text$s$);
  base := pg_temp.q('postgres', $s$SELECT shop_payment_status || '/' || is_suspended FROM public.shops WHERE id = '{sB}'$s$);
  PERFORM pg_temp.chk('témoin : le verrouillage automatique (fonction serveur) passe malgré le garde', n LIKE '%"changed": "locked"%' AND base IN ('locked/t', 'locked/true'), format('résultat=%s état=%s', n, base));
  -- Une commande reçue par le serveur augmente toujours la dette (déclencheur SECURITY DEFINER)
  n := pg_temp.q('postgres', $s$SELECT commission_balance_due::text FROM public.shops WHERE id = '{sB}'$s$);
  PERFORM pg_temp.q('postgres', $s$INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES ('{sB}', 'RLS-B-2', 'Client B2', '+2250700000007')$s$);
  PERFORM pg_temp.chk('témoin : une commande fait toujours monter la dette de la boutique', (pg_temp.q('postgres', $s$SELECT commission_balance_due::text FROM public.shops WHERE id = '{sB}'$s$))::numeric > n::numeric, 'avant=' || n);

  n := pg_temp.q('F', $s$SELECT public.mark_affiliate_payout_paid('{af2}', 999, 'wave', 'REF-RLS')::text$s$);
  PERFORM pg_temp.chk('mark_affiliate_payout_paid : montant différent des commissions refusé', n LIKE 'ERR:%', n);
  n := pg_temp.q('F', $s$SELECT public.mark_affiliate_payout_paid('{af2}', 2000, 'wave', 'REF-RLS')::text$s$);
  PERFORM pg_temp.chk('mark_affiliate_payout_paid : le fondateur verse le montant exact', n LIKE '%"success": true%', n);
  n := pg_temp.q('F', $s$SELECT public.mark_affiliate_payout_paid('{af2}', 2000, 'wave', 'REF-RLS')::text$s$);
  PERFORM pg_temp.chk('mark_affiliate_payout_paid : rejeu refusé (plus rien de payable)', n LIKE 'ERR:%', n);
  n := pg_temp.q('postgres', $s$SELECT (SELECT count(*) FROM public.affiliate_payouts WHERE affiliate_id = '{af2}')::text || '/' || (SELECT status FROM public.affiliate_commissions WHERE affiliate_id = '{af2}') || '/' || (SELECT status FROM public.affiliate_commissions WHERE affiliate_id = '{af1}')$s$);
  PERFORM pg_temp.chk('mark_affiliate_payout_paid : un seul versement, af2 PAID, af1 intacte', n = '2/PAID/PAYABLE', 'état=' || n);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RESET ROLE;
  PERFORM pg_temp.chk('ERREUR INATTENDUE', false, v_err);
END $$;

DO $$
DECLARE v_report text;
BEGIN
  SELECT string_agg(format('%s %s%s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, label, CASE WHEN ok AND detail = '' THEN '' ELSE ' — ' || detail END), E'\n' ORDER BY n)
  INTO v_report FROM _t;
  RAISE EXCEPTION E'RAPPORT\n%\n(% échecs sur % cas)', v_report, (SELECT count(*) FROM _t WHERE NOT ok), (SELECT count(*) FROM _t);
END $$;
