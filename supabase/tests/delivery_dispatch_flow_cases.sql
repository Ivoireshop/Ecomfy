-- Cas de test de 20261118110000_delivery_dispatch_flow.sql (après le socle et les migrations de la chaîne).
-- Chaque cas s'exécute sous le rôle `authenticated` avec l'identité indiquée, comme PostgREST.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.io'),
  ('c1c1c1c1-0000-0000-0000-000000000001', 'co1@test.io'), ('c2c2c2c2-0000-0000-0000-000000000002', 'co2@test.io'), ('c3c3c3c3-0000-0000-0000-000000000003', 'co3@test.io'),
  ('05050505-0000-0000-0000-000000000005', 's@test.io'), ('06060606-0000-0000-0000-000000000006', 's2@test.io'), ('07070707-0000-0000-0000-000000000007', 's3@test.io'),
  ('0c0c0c0c-0000-0000-0000-00000000000c', 'collab@test.io'), ('99999999-0000-0000-0000-000000000009', 'x@test.io');
INSERT INTO public.user_roles (user_id, role) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'admin');
INSERT INTO public.shops (id, user_id, shop_payment_status) VALUES
  ('5a000000-0000-0000-0000-000000000001', '05050505-0000-0000-0000-000000000005', 'active'),
  ('5a000000-0000-0000-0000-000000000002', '06060606-0000-0000-0000-000000000006', 'active'),
  ('5a000000-0000-0000-0000-000000000003', '07070707-0000-0000-0000-000000000007', 'STORE_RESTRICTED');
INSERT INTO public.shop_collaborators (shop_id, user_id, status) VALUES ('5a000000-0000-0000-0000-000000000001', '0c0c0c0c-0000-0000-0000-00000000000c', 'active');

CREATE TABLE t_res (n serial, test text, expected text, observed text, pass boolean);
CREATE TABLE t_ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON t_res, t_ids TO authenticated, anon;
CREATE FUNCTION t_id(p_k text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT v::text FROM t_ids WHERE k = p_k $$;
GRANT EXECUTE ON FUNCTION t_id(text) TO authenticated, anon;
-- Exécute p_sql sous un rôle/identité ; résultat 'ok' ou 'err:<SQLSTATE>:<message>'.
CREATE FUNCTION t_run(p_test text, p_uid uuid, p_sql text, p_expect text, p_role text DEFAULT 'authenticated') RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_obs text := 'ok';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_obs := 'err:' || SQLSTATE || ':' || SQLERRM;
  END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_res (test, expected, observed, pass) VALUES (p_test, p_expect, v_obs, v_obs LIKE p_expect);
END $$;

-- Exécute une requête renvoyant UNE valeur texte.
CREATE FUNCTION t_val(p_test text, p_uid uuid, p_sql text, p_expect text, p_role text DEFAULT 'authenticated') RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_obs text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql INTO v_obs;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_obs := 'err:' || SQLSTATE || ':' || SQLERRM;
  END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO t_res (test, expected, observed, pass) VALUES (p_test, p_expect, COALESCE(v_obs, 'NULL'), COALESCE(v_obs, 'NULL') LIKE p_expect);
END $$;

-- Valeur lue en superutilisateur (contrôle de l'état réel de la base).
CREATE FUNCTION t_admin(p_test text, p_sql text, p_expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text;
BEGIN
  EXECUTE p_sql INTO v_obs;
  INSERT INTO t_res (test, expected, observed, pass) VALUES (p_test, p_expect, COALESCE(v_obs, 'NULL'), COALESCE(v_obs, 'NULL') LIKE p_expect);
END $$;


\set a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set c1 '''c1c1c1c1-0000-0000-0000-000000000001'''
\set c2 '''c2c2c2c2-0000-0000-0000-000000000002'''
\set c3 '''c3c3c3c3-0000-0000-0000-000000000003'''
\set s '''05050505-0000-0000-0000-000000000005'''
\set s2 '''06060606-0000-0000-0000-000000000006'''
\set s3 '''07070707-0000-0000-0000-000000000007'''
\set sc '''0c0c0c0c-0000-0000-0000-00000000000c'''
\set x '''99999999-0000-0000-0000-000000000009'''

-- ---- Données (superutilisateur, gardes d'inscription neutralisées : elles sont testées ailleurs) ------------------
ALTER TABLE public.delivery_companies DISABLE TRIGGER USER;
ALTER TABLE public.delivery_drivers DISABLE TRIGGER USER;
INSERT INTO public.delivery_companies (user_id, company_name, country, city, headquarters_address, manager_name, manager_phone, manager_whatsapp, verification_status, trust_badge_active) VALUES
  ('c1c1c1c1-0000-0000-0000-000000000001', 'Express A', 'CI', 'Abidjan', 'Marcory', 'M1', '+2250700000001', '+2250700000001', 'approved', true),
  ('c2c2c2c2-0000-0000-0000-000000000002', 'Express B', 'CI', 'Abidjan', 'Cocody', 'M2', '+2250700000002', '+2250700000002', 'approved', true),
  ('c3c3c3c3-0000-0000-0000-000000000003', 'Express C', 'CI', 'Abidjan', 'Yopougon', 'M3', '+2250700000003', '+2250700000003', 'pending_verification', false);
INSERT INTO t_ids SELECT 'c1', id FROM public.delivery_companies WHERE company_name = 'Express A';
INSERT INTO t_ids SELECT 'c2', id FROM public.delivery_companies WHERE company_name = 'Express B';
INSERT INTO t_ids SELECT 'c3', id FROM public.delivery_companies WHERE company_name = 'Express C';
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, id_expiry, photo_url, national_id_photo_url, license_photo_url, verification_status, is_active) VALUES
  ((SELECT v FROM t_ids WHERE k = 'c1'), 'Drv A1', 'Drv', 'A1', '1', 'car', ARRAY['B'], current_date + 400, current_date + 400, 'p', 'i', 'l', 'approved', true),
  ((SELECT v FROM t_ids WHERE k = 'c1'), 'Drv A2 en attente', 'Drv', 'A2', '2', 'car', ARRAY['B'], current_date + 400, current_date + 400, 'p', 'i', 'l', 'pending', false),
  ((SELECT v FROM t_ids WHERE k = 'c2'), 'Drv B1', 'Drv', 'B1', '3', 'car', ARRAY['B'], current_date + 400, current_date + 400, 'p', 'i', 'l', 'approved', true);
INSERT INTO t_ids SELECT 'drvA1', id FROM public.delivery_drivers WHERE full_name = 'Drv A1';
INSERT INTO t_ids SELECT 'drvA2', id FROM public.delivery_drivers WHERE full_name LIKE 'Drv A2%';
INSERT INTO t_ids SELECT 'drvB1', id FROM public.delivery_drivers WHERE full_name = 'Drv B1';
ALTER TABLE public.delivery_companies ENABLE TRIGGER USER;
ALTER TABLE public.delivery_drivers ENABLE TRIGGER USER;

INSERT INTO public.orders (id, shop_id, order_number, customer_name, customer_phone, customer_address, customer_city, total, payment_status) VALUES
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oA', 'Awa', '+22501', 'Rue 1', 'Abidjan', 10000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oB', 'Bakary', '+22502', 'Rue 2', 'Abidjan', 7000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oC', 'Chantal', '+22503', 'Rue 3', 'Abidjan', 3000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oD', 'Drissa', '+22504', 'Rue 4', 'Abidjan', 4000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oP', 'Paul', '+22505', 'Rue 5', 'Abidjan', 5000, 'paid'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oN', 'Nadia', '+22506', NULL, NULL, 2000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oE', 'Eric', '+22507', 'Rue 7', 'Abidjan', 2500, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000002', 'oS2', 'Sam', '+22508', 'Rue 8', 'Abidjan', 2500, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000003', 'oR', 'Rita', '+22509', 'Rue 9', 'Abidjan', 2500, 'pending');
INSERT INTO t_ids SELECT order_number, id FROM public.orders;
CREATE FUNCTION t_tx(p_order text, p_company text, p_fee numeric DEFAULT 1500) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT public.delivery_dispatch_transmit(%L, %L, %s)', t_id('o' || p_order), t_id(p_company), p_fee) $$;
CREATE FUNCTION t_act(p_fn text, p_disp text, p_arg text DEFAULT NULL) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT public.%I(%L%s)', p_fn, t_id(p_disp), CASE WHEN p_arg IS NULL THEN '' ELSE ', ' || quote_nullable(p_arg) END) $$;
CREATE FUNCTION t_st(p_disp text, p_status text, p_note text DEFAULT NULL) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT public.delivery_dispatch_set_status(%L, %L, %L)', t_id(p_disp), p_status, p_note) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- ===============================================================================================================
-- A. Transmission
-- ===============================================================================================================
SELECT t_run('01 s transmet oA à Express A (frais 1500)', :s, t_tx('A', 'c1'), 'ok');
INSERT INTO t_ids SELECT 'd1', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oA');
SELECT t_admin('02 course créée « transmitted », données lues sur la commande, montant à encaisser = total',
  $$SELECT status || '/' || recipient_name || '/' || delivery_address || '/' || cod_amount || '/' || delivery_fee FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd1')$$,
  'transmitted/Awa/Rue 1/10000.00/1500.00');
SELECT t_admin('03 transfert d''argent créé : net marchand = 8500', $$SELECT net_seller_amount::text FROM public.delivery_cash_transfers WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1')$$, '8500.00');
SELECT t_admin('04 historique « transmitted » par le marchand + notification à la structure',
  $$SELECT (SELECT count(*) FROM public.delivery_dispatch_history WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1') AND event = 'transmitted' AND actor_kind = 'seller')::text || '/' ||
           (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'dispatch_transmitted' AND user_id = 'c1c1c1c1-0000-0000-0000-000000000001' AND body LIKE '%oA%')$$, '1/1');
SELECT t_run('05 la même commande ne peut pas être transmise deux fois', :s, t_tx('A', 'c2'), 'err:23505:%déjà confiée%');
SELECT t_run('06 un tiers ne peut pas transmettre la commande d''autrui', :x, t_tx('B', 'c1'), 'err:42501:%');
SELECT t_run('07 une autre boutique ne peut pas transmettre cette commande', :s2, t_tx('B', 'c1'), 'err:42501:%');
SELECT t_run('08 collaborateur de la boutique : transmission autorisée', :sc, t_tx('B', 'c1'), 'ok');
INSERT INTO t_ids SELECT 'd2', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oB');
SELECT t_run('09 structure non vérifiée refusée', :s, t_tx('C', 'c3'), 'err:23514:%pas vérifiée%');
SELECT t_run('10 commande sans adresse refusée', :s, t_tx('N', 'c1'), 'err:22023:%adresse%');
SELECT t_run('11 boutique restreinte : transmission refusée', :s3, t_tx('R', 'c1'), 'err:42501:%restreinte%');
SELECT t_run('12 frais négatifs refusés', :s, t_tx('E', 'c1', -5), 'err:22023:%');
SELECT t_run('13 commande déjà payée en ligne : transmise, rien à encaisser', :s, t_tx('P', 'c1', 800), 'ok');
INSERT INTO t_ids SELECT 'd3', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oP');
SELECT t_admin('14 …cod = 0 et aucun transfert d''argent', $$SELECT cod_amount || '/' || (SELECT count(*) FROM public.delivery_cash_transfers WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd3')) FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd3')$$, '0.00/0');
SELECT t_run('15 anonyme : action serveur interdite', NULL, t_tx('E', 'c1'), 'err:42501:%', 'anon');

-- ===============================================================================================================
-- B. Gardes d'écriture directe (la faille d'origine)
-- ===============================================================================================================
SELECT t_run('20 marchand : insertion directe d''une course refusée', :s,
  format($$INSERT INTO public.delivery_dispatches (order_id, shop_id, company_id, city, status) VALUES (%L, '5a000000-0000-0000-0000-000000000001', %L, 'X', 'delivered')$$, t_id('oE'), t_id('c1')), 'err:42501:%');
SELECT t_run('21 structure : changer le statut en direct refusé', :c1, format($$UPDATE public.delivery_dispatches SET status = 'delivered' WHERE id = %L$$, t_id('d1')), 'err:42501:%Modification directe%');
SELECT t_run('22 marchand : changer le montant à encaisser refusé', :s, format($$UPDATE public.delivery_dispatches SET cod_amount = 1 WHERE id = %L$$, t_id('d1')), 'err:42501:%Modification directe%');
SELECT t_run('23 structure : changer les frais refusé', :c1, format($$UPDATE public.delivery_dispatches SET delivery_fee = 99999 WHERE id = %L$$, t_id('d1')), 'err:42501:%Modification directe%');
SELECT t_run('24 structure : ajouter la photo du colis autorisé', :c1, format($$UPDATE public.delivery_dispatches SET customer_parcel_photo_url = 'x/p.jpg' WHERE id = %L$$, t_id('d1')), 'ok');
SELECT t_run('25 structure : modifier le montant d''un transfert refusé', :c1, format($$UPDATE public.delivery_cash_transfers SET cod_amount = 1 WHERE dispatch_id = %L$$, t_id('d1')), 'err:42501:%montants%');
SELECT t_run('26 marchand : modifier le net d''un transfert refusé', :s, format($$UPDATE public.delivery_cash_transfers SET net_seller_amount = 99999 WHERE dispatch_id = %L$$, t_id('d1')), 'err:42501:%montants%');
SELECT t_run('27 service_role (serveur) : écriture directe permise', NULL, format($$UPDATE public.delivery_dispatches SET delivery_note = 'n' WHERE id = %L$$, t_id('d1')), 'ok', 'service_role');

-- ===============================================================================================================
-- C. Acceptation, refus, affectation
-- ===============================================================================================================
SELECT t_run('30 marchand : accepter sa propre course refusé', :s, t_act('delivery_dispatch_accept', 'd1'), 'err:42501:%Transition non autorisée%');
SELECT t_run('31 autre structure : accepter refusé (course invisible)', :c2, t_act('delivery_dispatch_accept', 'd1'), 'err:42501:%introuvable%');
SELECT t_run('32 structure : accuser réception', :c1, t_act('delivery_dispatch_receive', 'd1'), 'ok');
SELECT t_run('33 …idempotent', :c1, t_act('delivery_dispatch_receive', 'd1'), 'ok');
SELECT t_admin('34 …une seule trace « received » et received_at renseigné',
  $$SELECT (SELECT count(*) FROM public.delivery_dispatch_history WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1') AND event = 'received')::text || '/' || (received_at IS NOT NULL) FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd1')$$, '1/true');
SELECT t_run('35 affecter avant d''avoir accepté refusé', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d1'), t_id('drvA1')), 'err:42501:%Transition non autorisée%');
SELECT t_run('36 refus sans motif refusé', :c1, t_act('delivery_dispatch_refuse', 'd2', ''), 'err:22023:%motif%');
SELECT t_run('37 refus avec motif', :c1, t_act('delivery_dispatch_refuse', 'd2', 'Zone non couverte'), 'ok');
SELECT t_admin('38 …statut refused, motif conservé, marchand prévenu avec le motif',
  $$SELECT status || '/' || refusal_reason || '/' || (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'dispatch_refused' AND user_id = '05050505-0000-0000-0000-000000000005' AND body LIKE '%Zone non couverte%') FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd2')$$, 'refused/Zone non couverte/1');
SELECT t_run('39 course refusée : on peut la retransmettre à une autre structure', :sc, t_tx('B', 'c2'), 'ok');
INSERT INTO t_ids SELECT 'd4', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oB') AND d.company_id = (SELECT v FROM t_ids WHERE k = 'c2');
SELECT t_run('40 refus d''une course déjà refusée interdit', :c1, t_act('delivery_dispatch_refuse', 'd2', 'encore'), 'err:42501:%Transition non autorisée%');
SELECT t_run('41 acceptation par la structure', :c1, t_act('delivery_dispatch_accept', 'd1'), 'ok');
SELECT t_admin('42 …marchand prévenu', $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'dispatch_accepted' AND user_id = '05050505-0000-0000-0000-000000000005'$$, '1');
SELECT t_run('43 affecter à un livreur d''une autre structure refusé', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d1'), t_id('drvB1')), 'err:23514:%');
SELECT t_run('44 affecter à un livreur non approuvé refusé', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d1'), t_id('drvA2')), 'err:23514:%');
SELECT t_run('45 affecter sans livreur refusé', :c1, format('SELECT public.delivery_dispatch_assign(%L, NULL)', t_id('d1')), 'err:22023:%livreur%');
SELECT t_run('46 affecter à son livreur', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d1'), t_id('drvA1')), 'ok');
SELECT t_admin('47 …livreur enregistré, statut assigned, marchand prévenu',
  $$SELECT status || '/' || (assigned_driver_id = (SELECT v FROM t_ids WHERE k = 'drvA1')) || '/' || (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'dispatch_assigned' AND user_id = '05050505-0000-0000-0000-000000000005') FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd1')$$, 'assigned/true/1');

-- ===============================================================================================================
-- D. Livraison et argent
-- ===============================================================================================================
SELECT t_run('50 saut d''étape refusé (assigned -> delivered)', :c1, t_st('d1', 'delivered'), 'err:42501:%Transition non autorisée%');
SELECT t_run('51 colis récupéré', :c1, t_st('d1', 'picked_up'), 'ok');
SELECT t_run('52 en cours de livraison', :c1, t_st('d1', 'in_transit'), 'ok');
SELECT t_run('53 marchand : marquer livré refusé', :s, t_st('d1', 'delivered'), 'err:42501:%Transition non autorisée%');
SELECT t_run('54 livré', :c1, t_st('d1', 'delivered'), 'ok');
SELECT t_admin('55 …transfert d''argent passé à « collected_by_driver »', $$SELECT status::text FROM public.delivery_cash_transfers WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1')$$, 'collected_by_driver');
SELECT t_run('56 marchand : « encaissé » refusé', :s, t_st('d1', 'cod_collected'), 'err:42501:%Transition non autorisée%');
SELECT t_run('57 structure : encaissé', :c1, t_st('d1', 'cod_collected'), 'ok');
SELECT t_run('58 structure : reversement en attente', :c1, t_st('d1', 'deposit_pending'), 'ok');
SELECT t_run('59 structure : se déclarer payée (completed) refusé', :c1, t_st('d1', 'completed'), 'err:42501:%Transition non autorisée%');
SELECT t_run('60 marchand : confirme le reversement', :s, t_st('d1', 'completed'), 'ok');
SELECT t_admin('61 …seller_payout_completed_at renseigné', $$SELECT (seller_payout_completed_at IS NOT NULL)::text FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd1')$$, 'true');
SELECT t_admin('62 historique complet de d1 : 10 lignes', $$SELECT count(*)::text FROM public.delivery_dispatch_history WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1')$$, '10');
SELECT t_admin('63 …ordre des statuts',
  $$SELECT string_agg(coalesce(to_status, '-'), ',' ORDER BY created_at, id) FROM public.delivery_dispatch_history WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd1')$$,
  'transmitted,transmitted,accepted,assigned,picked_up,in_transit,delivered,cod_collected,deposit_pending,completed');
SELECT t_run('64 l''historique est en ajout seul (même pour un superutilisateur)', NULL, 'DELETE FROM public.delivery_dispatch_history', 'err:42501:%ajout seul%', 'postgres');
SELECT t_run('65 une course terminée ne s''annule plus', :s, t_st('d1', 'cancelled'), 'err:42501:%Transition non autorisée%');

-- Lecture : isolement
SELECT t_val('70 marchand : voit l''historique de sa course', :s, format($$SELECT count(*)::text FROM public.delivery_dispatch_history WHERE dispatch_id = %L$$, t_id('d1')), '10');
SELECT t_val('71 collaborateur boutique : voit la course', :sc, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('d1')), '1');
SELECT t_val('72 structure : voit l''historique de sa course', :c1, format($$SELECT count(*)::text FROM public.delivery_dispatch_history WHERE dispatch_id = %L$$, t_id('d1')), '10');
SELECT t_val('73 autre structure : ne voit rien', :c2, format($$SELECT count(*)::text FROM public.delivery_dispatch_history WHERE dispatch_id = %L$$, t_id('d1')), '0');
SELECT t_val('74 autre structure : ne voit pas la course', :c2, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('d1')), '0');
SELECT t_val('75 tiers : ne voit rien', :x, $$SELECT ((SELECT count(*) FROM public.delivery_dispatches) + (SELECT count(*) FROM public.delivery_dispatch_history))::text$$, '0');
SELECT t_val('76 autre boutique : ne voit rien', :s2, $$SELECT ((SELECT count(*) FROM public.delivery_dispatches) + (SELECT count(*) FROM public.delivery_dispatch_history))::text$$, '0');

-- ===============================================================================================================
-- E. Annulation, échec, retour
-- ===============================================================================================================
SELECT t_run('80 s transmet oC à Express A', :s, t_tx('C', 'c1'), 'ok');
INSERT INTO t_ids SELECT 'd5', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oC');
SELECT t_run('81 structure : annuler avant d''avoir accepté refusé (elle doit refuser)', :c1, t_st('d5', 'cancelled', 'non'), 'err:42501:%Transition non autorisée%');
SELECT t_run('82 marchand : annuler tant que rien n''est parti', :s, t_st('d5', 'cancelled', 'client injoignable'), 'ok');
SELECT t_admin('83 …structure prévenue, motif conservé',
  $$SELECT (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'dispatch_cancelled' AND user_id = 'c1c1c1c1-0000-0000-0000-000000000001')::text || '/' || cancel_reason FROM public.delivery_dispatches WHERE id = (SELECT v FROM t_ids WHERE k = 'd5')$$, '1/client injoignable');

SELECT t_run('85 s transmet oD', :s, t_tx('D', 'c1'), 'ok');
INSERT INTO t_ids SELECT 'd6', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oD');
SELECT t_run('86 accepter', :c1, t_act('delivery_dispatch_accept', 'd6'), 'ok');
SELECT t_run('87 préparer', :c1, t_st('d6', 'preparing'), 'ok');
SELECT t_run('88 affecter depuis « preparing »', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d6'), t_id('drvA1')), 'ok');
SELECT t_run('89 récupéré', :c1, t_st('d6', 'picked_up'), 'ok');
SELECT t_run('90 échec sans motif refusé', :c1, t_st('d6', 'failed'), 'err:22023:%motif%');
SELECT t_run('91 échec avec motif', :c1, t_st('d6', 'failed', 'Client absent'), 'ok');
SELECT t_admin('92 …marchand prévenu (ton erreur) avec le motif',
  $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'dispatch_failed' AND tone = 'error' AND body LIKE '%Client absent%' AND user_id = '05050505-0000-0000-0000-000000000005'$$, '1');
SELECT t_run('93 retour au marchand', :c1, t_st('d6', 'returned'), 'ok');
SELECT t_run('94 retourné est final', :c1, t_st('d6', 'in_transit'), 'err:42501:%Transition non autorisée%');
SELECT t_run('95 …et la commande peut repartir chez une autre structure', :s, t_tx('D', 'c2'), 'ok');

-- ===============================================================================================================
-- F. Sans encaissement, litige, administrateur, anciennes courses
-- ===============================================================================================================
SELECT t_run('100 d3 (payée en ligne) : accepter', :c1, t_act('delivery_dispatch_accept', 'd3'), 'ok');
SELECT t_run('101 …affecter', :c1, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d3'), t_id('drvA1')), 'ok');
SELECT t_run('102 …récupérer', :c1, t_st('d3', 'picked_up'), 'ok');
SELECT t_run('103 …livré', :c1, t_st('d3', 'delivered'), 'ok');
SELECT t_run('104 …encaissement sans montant refusé', :c1, t_st('d3', 'cod_collected'), 'err:42501:%Transition non autorisée%');
SELECT t_run('105 …clôture directe (cod = 0)', :s, t_st('d3', 'completed'), 'ok');

SELECT t_run('110 d4 (Express B) : accepter', :c2, t_act('delivery_dispatch_accept', 'd4'), 'ok');
SELECT t_run('111 …affecter', :c2, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d4'), t_id('drvB1')), 'ok');
SELECT t_run('112 …récupérer', :c2, t_st('d4', 'picked_up'), 'ok');
SELECT t_run('113 …livré', :c2, t_st('d4', 'delivered'), 'ok');
SELECT t_run('114 litige sans motif refusé', :s, t_st('d4', 'disputed'), 'err:22023:%motif%');
SELECT t_run('115 litige avec motif', :s, t_st('d4', 'disputed', 'Montant non reversé'), 'ok');
SELECT t_run('116 administrateur : résolution du litige (transition libre)', :a, t_st('d4', 'completed', 'Résolu par l''administration'), 'ok');
SELECT t_admin('117 …tracé comme action « admin »', $$SELECT count(*)::text FROM public.delivery_dispatch_history WHERE dispatch_id = (SELECT v FROM t_ids WHERE k = 'd4') AND actor_kind = 'admin'$$, '1');
SELECT t_run('118 administrateur : modification directe de colonne permise', :a, format($$UPDATE public.delivery_dispatches SET delivery_fee = 100 WHERE id = %L$$, t_id('d4')), 'ok');

-- Ancienne course (créée avant la refonte, statut « assigned », sans acceptation) : le parcours historique continue.
ALTER TABLE public.delivery_dispatches DISABLE TRIGGER USER;
INSERT INTO public.delivery_dispatches (order_id, shop_id, company_id, assigned_driver_id, status, city, delivery_address, recipient_name, recipient_phone, cod_amount, delivery_fee)
VALUES ((SELECT v FROM t_ids WHERE k = 'oE'), '5a000000-0000-0000-0000-000000000001', (SELECT v FROM t_ids WHERE k = 'c1'), (SELECT v FROM t_ids WHERE k = 'drvA1'), 'assigned', 'Abidjan', 'Rue 7', 'Eric', '+22507', 2500, 500);
ALTER TABLE public.delivery_dispatches ENABLE TRIGGER USER;
INSERT INTO t_ids SELECT 'dL', id FROM public.delivery_dispatches WHERE order_id = (SELECT v FROM t_ids WHERE k = 'oE');
SELECT t_run('120 ancienne course « assigned » : récupérée sans passer par l''acceptation', :c1, t_st('dL', 'picked_up'), 'ok');
SELECT t_run('121 …livrée', :c1, t_st('dL', 'delivered'), 'ok');

-- Un administrateur qui possède une structure agit comme structure sur ses propres courses (pas de contournement).
INSERT INTO public.user_roles (user_id, role) VALUES ('c2c2c2c2-0000-0000-0000-000000000002', 'admin');
SELECT t_run('130 s2 transmet oS2 à Express B (dont le propriétaire est aussi admin)', :s2, t_tx('S2', 'c2'), 'ok');
INSERT INTO t_ids SELECT 'd7', id FROM public.delivery_dispatches d WHERE d.order_id = (SELECT v FROM t_ids WHERE k = 'oS2');
SELECT t_run('131 propriétaire-admin : affecter sans avoir accepté refusé (agit comme structure)', :c2, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('d7'), t_id('drvB1')), 'err:42501:%Transition non autorisée%');
SELECT t_run('132 …accuser réception possible', :c2, t_act('delivery_dispatch_receive', 'd7'), 'ok');
SELECT t_run('133 …accepter possible', :c2, t_act('delivery_dispatch_accept', 'd7'), 'ok');
SELECT t_run('134 administrateur étranger à la structure : supervision libre conservée', :a, t_st('d7', 'cancelled', 'supervision'), 'ok');

-- ===============================================================================================================
-- G. Équipe de la structure (étape B)
-- ===============================================================================================================
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('0a0a0a0a-0000-0000-0000-00000000000a', 'ops@test.io', now()),
  ('0b0b0b0b-0000-0000-0000-00000000000b', 'rec@test.io', now()),
  ('0d0d0d0d-0000-0000-0000-00000000000d', 'drv@test.io', now()),
  ('0e0e0e0e-0000-0000-0000-00000000000e', 'adm@test.io', now()),
  ('0f0f0f0f-0000-0000-0000-00000000000f', 'unconf@test.io', NULL);
\set ops '''0a0a0a0a-0000-0000-0000-00000000000a'''
\set rec '''0b0b0b0b-0000-0000-0000-00000000000b'''
\set drv '''0d0d0d0d-0000-0000-0000-00000000000d'''
\set adm '''0e0e0e0e-0000-0000-0000-00000000000e'''
\set unc '''0f0f0f0f-0000-0000-0000-00000000000f'''

CREATE TABLE t_tok (k text PRIMARY KEY, v text);
GRANT ALL ON t_tok TO authenticated, anon;
CREATE FUNCTION t_inv(p_company text, p_email text, p_role text, p_driver text DEFAULT NULL) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT public.delivery_staff_invite(%L, %L, %L, %L)', t_id(p_company), p_email, p_role, CASE WHEN p_driver IS NULL THEN NULL ELSE t_id(p_driver) END) $$;
CREATE FUNCTION t_acc(p_k text) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT (public.delivery_staff_accept(%L))->>''error''', (SELECT v FROM t_tok WHERE k = p_k)) $$;
CREATE FUNCTION t_accok(p_k text) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT format('SELECT (public.delivery_staff_accept(%L))->>''success''', (SELECT v FROM t_tok WHERE k = p_k)) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- livreur approuvé supplémentaire (A3) pour tester l'isolation entre livreurs
ALTER TABLE public.delivery_drivers DISABLE TRIGGER USER;
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, id_expiry, photo_url, national_id_photo_url, license_photo_url, verification_status, is_active)
VALUES ((SELECT v FROM t_ids WHERE k = 'c1'), 'Drv A3', 'Drv', 'A3', '9', 'car', ARRAY['B'], current_date + 400, current_date + 400, 'p', 'i', 'l', 'approved', true);
ALTER TABLE public.delivery_drivers ENABLE TRIGGER USER;
INSERT INTO t_ids SELECT 'drvA3', id FROM public.delivery_drivers WHERE full_name = 'Drv A3';
INSERT INTO public.orders (id, shop_id, order_number, customer_name, customer_phone, customer_address, customer_city, total, payment_status) VALUES
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oT1', 'T1', '+2250001', 'Rue T1', 'Abidjan', 6000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oT2', 'T2', '+2250002', 'Rue T2', 'Abidjan', 6000, 'pending'),
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', 'oT3', 'T3', '+2250003', 'Rue T3', 'Abidjan', 6000, 'pending');
INSERT INTO t_ids SELECT order_number, id FROM public.orders WHERE order_number LIKE 'oT%';

-- Invitations
SELECT t_run('200 tiers : inviter dans une structure refusé', :x, t_inv('c1', 'ops@test.io', 'operations'), 'err:42501:%réservée%');
SELECT t_run('201 propriétaire invite un responsable des opérations', :c1, t_inv('c1', 'ops@test.io', 'operations'), 'ok');
INSERT INTO t_tok SELECT 'ops', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io';
SELECT t_run('202 même e-mail deux fois refusé', :c1, t_inv('c1', 'OPS@test.io', 'reception'), 'err:23505:%');
SELECT t_run('203 livreur d''une autre structure refusé', :c1, t_inv('c1', 'drv@test.io', 'driver', 'drvB1'), 'err:22023:%livreur de votre structure%');
SELECT t_run('204 rôle livreur sans fiche livreur refusé', :c1, t_inv('c1', 'drv@test.io', 'driver'), 'err:22023:%livreur de votre structure%');
SELECT t_run('205 invitation d''un livreur lié à sa fiche', :c1, t_inv('c1', 'drv@test.io', 'driver', 'drvA1'), 'ok');
INSERT INTO t_tok SELECT 'drv', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'drv@test.io';
SELECT t_run('206 une fiche livreur ne se lie qu''à un compte', :c1, t_inv('c1', 'autre@test.io', 'driver', 'drvA1'), 'err:23505:%');
SELECT t_run('207 invitation réception', :c1, t_inv('c1', 'rec@test.io', 'reception'), 'ok');
INSERT INTO t_tok SELECT 'rec', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'rec@test.io';
SELECT t_run('208 propriétaire nomme un administrateur', :c1, t_inv('c1', 'adm@test.io', 'admin'), 'ok');
INSERT INTO t_tok SELECT 'adm', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'adm@test.io';
SELECT t_run('209 e-mail invalide refusé', :c1, t_inv('c1', 'pas-un-mail', 'reception'), 'err:22023:%e-mail%');
SELECT t_run('210 rôle inconnu refusé', :c1, t_inv('c1', 'z@test.io', 'owner'), 'err:22023:%Rôle%');
SELECT t_run('211 jeton non lisible par le collaborateur invité (table fermée)', :x, 'SELECT count(*) FROM public.delivery_company_staff', 'ok');
SELECT t_val('212 …et il ne voit aucune ligne', :x, 'SELECT count(*)::text FROM public.delivery_company_staff', '0');
SELECT t_run('213 écriture directe sur la table refusée (même propriétaire)', :c1, format($$INSERT INTO public.delivery_company_staff (company_id, invited_email, role) VALUES (%L, 'hack@test.io', 'admin')$$, t_id('c1')), 'err:42501:%');

-- Acceptation
SELECT t_val('220 mauvais compte : refusé', :x, t_acc('ops'), 'email_mismatch');
INSERT INTO t_tok SELECT 'unc', invitation_token FROM public.delivery_company_staff WHERE false;
INSERT INTO public.delivery_company_staff (company_id, invited_email, role, invitation_token) VALUES ((SELECT v FROM t_ids WHERE k = 'c1'), 'unconf@test.io', 'reception', 'u' || repeat('a', 63));
INSERT INTO t_tok VALUES ('unc', 'u' || repeat('a', 63));
SELECT t_val('221 e-mail non confirmé : refusé', :unc, t_acc('unc'), 'email_not_confirmed');
DELETE FROM public.delivery_company_staff WHERE invited_email = 'unconf@test.io';
SELECT t_run('222 invitation adressée au propriétaire d''une autre structure', :c1, t_inv('c1', 'co2@test.io', 'reception'), 'ok');
INSERT INTO t_tok SELECT 'own', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'co2@test.io';
SELECT t_val('222b …le propriétaire d''une autre structure ne peut pas la rejoindre', :c2, t_acc('own'), 'already_owner');
SELECT t_val('223 ops accepte', :ops, t_accok('ops'), 'true');
SELECT t_val('224 jeton à usage unique', :ops, t_acc('ops'), 'invalid_token');
SELECT t_val('225 livreur accepte', :drv, t_accok('drv'), 'true');
SELECT t_val('226 réception accepte', :rec, t_accok('rec'), 'true');
SELECT t_val('227 admin accepte', :adm, t_accok('adm'), 'true');
SELECT t_admin('228 le propriétaire a été prévenu des arrivées', $$SELECT (count(*) >= 4)::text FROM public.delivery_notifications WHERE kind = 'staff_joined' AND user_id = 'c1c1c1c1-0000-0000-0000-000000000001'$$, 'true');
UPDATE public.delivery_company_staff SET invited_at = now() - interval '20 days' WHERE false;
SELECT t_run('229 un membre ne peut pas être invité dans une seconde structure', :c2, t_inv('c2', 'ops@test.io', 'operations'), 'ok');
INSERT INTO t_tok SELECT 'ops2', invitation_token FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io' AND company_id = (SELECT v FROM t_ids WHERE k = 'c2');
SELECT t_val('230 …mais ne peut pas accepter (déjà actif ailleurs)', :ops, t_acc('ops2'), 'already_member');
UPDATE public.delivery_company_staff SET invited_at = now() - interval '20 days' WHERE invitation_token = (SELECT v FROM t_tok WHERE k = 'ops2');
SELECT t_val('231 invitation expirée', :ops, t_acc('ops2'), 'expired');

-- Droits par rôle sur les courses
SELECT t_run('240 s transmet oT1', :s, t_tx('T1', 'c1'), 'ok');
SELECT t_run('241 s transmet oT2', :s, t_tx('T2', 'c1'), 'ok');
SELECT t_run('242 s transmet oT3', :s, t_tx('T3', 'c1'), 'ok');
INSERT INTO t_ids SELECT 't1', id FROM public.delivery_dispatches WHERE order_id = (SELECT v FROM t_ids WHERE k = 'oT1');
INSERT INTO t_ids SELECT 't2', id FROM public.delivery_dispatches WHERE order_id = (SELECT v FROM t_ids WHERE k = 'oT2');
INSERT INTO t_ids SELECT 't3', id FROM public.delivery_dispatches WHERE order_id = (SELECT v FROM t_ids WHERE k = 'oT3');
SELECT t_admin('243 l''équipe de gestion et la réception ont été prévenues (propriétaire, admin, ops, réception)',
  $$SELECT count(DISTINCT user_id)::text FROM public.delivery_notifications WHERE kind = 'dispatch_transmitted' AND body LIKE '%oT1%'$$, '4');
SELECT t_admin('244 …pas le livreur', $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'dispatch_transmitted' AND body LIKE '%oT1%' AND user_id = '0d0d0d0d-0000-0000-0000-00000000000d'$$, '0');
SELECT t_val('245 ops voit la course', :ops, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t1')), '1');
SELECT t_val('246 réception voit la course', :rec, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t1')), '1');
SELECT t_val('247 admin de la structure voit la course', :adm, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t1')), '1');
SELECT t_val('248 livreur non affecté : ne voit pas la course', :drv, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t1')), '0');
SELECT t_run('249 réception : accepter refusé', :rec, t_act('delivery_dispatch_accept', 't1'), 'err:42501:%Transition non autorisée%');
SELECT t_run('250 réception : accuser réception', :rec, t_act('delivery_dispatch_receive', 't1'), 'ok');
SELECT t_run('251 livreur : accuser réception refusé', :drv, t_act('delivery_dispatch_receive', 't1'), 'err:42501:%');
SELECT t_run('252 ops : accepter', :ops, t_act('delivery_dispatch_accept', 't1'), 'ok');
SELECT t_run('253 réception : mettre en préparation', :rec, t_st('t1', 'preparing'), 'ok');
SELECT t_run('254 réception : affecter refusé', :rec, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('t1'), t_id('drvA1')), 'err:42501:%Transition non autorisée%');
SELECT t_run('255 ops : affecter au livreur A1', :ops, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('t1'), t_id('drvA1')), 'ok');
SELECT t_admin('256 le livreur a reçu « Nouvelle mission »', $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'dispatch_mission' AND user_id = '0d0d0d0d-0000-0000-0000-00000000000d'$$, '1');
SELECT t_val('257 livreur affecté : voit sa mission', :drv, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t1')), '1');
SELECT t_run('258 livreur : annuler refusé', :drv, t_st('t1', 'cancelled', 'je ne veux pas'), 'err:42501:%Transition non autorisée%');
SELECT t_run('259 livreur : récupérer', :drv, t_st('t1', 'picked_up'), 'ok');
SELECT t_run('260 livreur : en route', :drv, t_st('t1', 'in_transit'), 'ok');
SELECT t_run('261 livreur : livré', :drv, t_st('t1', 'delivered'), 'ok');
SELECT t_run('262 livreur : confirmer l''encaissement refusé (argent = gestion)', :drv, t_st('t1', 'cod_collected'), 'err:42501:%Transition non autorisée%');
SELECT t_run('263 ops : confirmer l''encaissement', :ops, t_st('t1', 'cod_collected'), 'ok');
SELECT t_val('264 livreur : ne voit pas l''argent', :drv, 'SELECT count(*)::text FROM public.delivery_cash_transfers', '0');
SELECT t_val('265 ops : voit l''argent', :ops, format($$SELECT count(*)::text FROM public.delivery_cash_transfers WHERE dispatch_id = %L$$, t_id('t1')), '1');
SELECT t_val('266 réception : ne voit pas l''argent', :rec, 'SELECT count(*)::text FROM public.delivery_cash_transfers', '0');
SELECT t_val('267 livreur : ne voit pas l''historique', :drv, 'SELECT count(*)::text FROM public.delivery_dispatch_history', '0');
SELECT t_val('268 ops : voit l''historique', :ops, format($$SELECT (count(*) > 3)::text FROM public.delivery_dispatch_history WHERE dispatch_id = %L$$, t_id('t1')), 'true');

-- Isolation entre livreurs : t2 est affectée à A3 (pas au livreur lié au compte drv)
SELECT t_run('270 ops : accepter t2', :ops, t_act('delivery_dispatch_accept', 't2'), 'ok');
SELECT t_run('271 ops : affecter t2 à A3', :ops, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('t2'), t_id('drvA3')), 'ok');
SELECT t_val('272 livreur A1 : ne voit pas la mission de A3', :drv, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t2')), '0');
SELECT t_run('273 livreur A1 : récupérer la mission de A3 refusé', :drv, t_st('t2', 'picked_up'), 'err:42501:%');
-- Réaffectation : t3 d'abord à A1 puis à A3
SELECT t_run('274 ops : accepter et affecter t3 à A1', :ops, t_act('delivery_dispatch_accept', 't3'), 'ok');
SELECT t_run('275 …', :ops, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('t3'), t_id('drvA1')), 'ok');
SELECT t_run('276 ops : réaffecter t3 à A3', :ops, format('SELECT public.delivery_dispatch_assign(%L, %L)', t_id('t3'), t_id('drvA3')), 'ok');
SELECT t_admin('277 l''ancien livreur est prévenu « Mission retirée »', $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'dispatch_mission_removed' AND user_id = '0d0d0d0d-0000-0000-0000-00000000000d'$$, '1');
SELECT t_val('278 …et ne voit plus la course', :drv, format($$SELECT count(*)::text FROM public.delivery_dispatches WHERE id = %L$$, t_id('t3')), '0');

-- Gestion de l'équipe
SELECT t_run('280 ops : inviter refusé', :ops, t_inv('c1', 'n@test.io', 'reception'), 'err:42501:%réservée%');
SELECT t_run('281 admin de la structure : inviter une réception', :adm, t_inv('c1', 'rec2@test.io', 'reception'), 'ok');
SELECT t_run('282 admin de la structure : nommer un autre admin refusé', :adm, t_inv('c1', 'adm2@test.io', 'admin'), 'err:42501:%propriétaire%');
SELECT t_run('283 admin : modifier un admin refusé', :adm, format($$SELECT public.delivery_staff_set_role(%L, 'operations')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'adm@test.io')), 'err:42501:%propriétaire%');
SELECT t_run('284 admin : désactiver ops', :adm, format($$SELECT public.delivery_staff_set_status(%L, 'inactive')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io' AND company_id = (SELECT v FROM t_ids WHERE k = 'c1'))), 'ok');
SELECT t_run('285 ops désactivé : plus d''action possible', :ops, t_st('t3', 'preparing'), 'err:42501:%introuvable%');
SELECT t_val('286 …plus aucune course visible', :ops, 'SELECT count(*)::text FROM public.delivery_dispatches', '0');
SELECT t_admin('287 …et prévenu', $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'staff_deactivated' AND user_id = '0a0a0a0a-0000-0000-0000-00000000000a'$$, '1');
SELECT t_run('288 réactivation', :c1, format($$SELECT public.delivery_staff_set_status(%L, 'active')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io' AND company_id = (SELECT v FROM t_ids WHERE k = 'c1'))), 'ok');
SELECT t_run('289 propriétaire : passer ops en réception', :c1, format($$SELECT public.delivery_staff_set_role(%L, 'reception')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io' AND company_id = (SELECT v FROM t_ids WHERE k = 'c1'))), 'ok');
SELECT t_run('290 …puis de nouveau en opérations', :c1, format($$SELECT public.delivery_staff_set_role(%L, 'operations')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'ops@test.io' AND company_id = (SELECT v FROM t_ids WHERE k = 'c1'))), 'ok');
SELECT t_run('291 révoquer une invitation en attente', :c1, format($$SELECT public.delivery_staff_revoke_invite(%L)$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'rec2@test.io')), 'ok');
SELECT t_run('292 révoquer un membre actif refusé', :c1, format($$SELECT public.delivery_staff_revoke_invite(%L)$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'rec@test.io')), 'err:22023:%');
SELECT t_run('293 autre structure : modifier un de nos collaborateurs refusé', :c2, format($$SELECT public.delivery_staff_set_status(%L, 'inactive')$$, (SELECT id::text FROM public.delivery_company_staff WHERE invited_email = 'rec@test.io')), 'err:42501:%');

-- Tableau d'équipe et espace de travail
SELECT t_run('300 autre structure : liste refusée', :c2, format('SELECT public.delivery_staff_list(%L)', t_id('c1')), 'err:42501:%');
SELECT t_run('301 ops : liste refusée', :ops, format('SELECT public.delivery_staff_list(%L)', t_id('c1')), 'err:42501:%');
SELECT t_val('302 propriétaire : liste de l''équipe (4 membres + 1 invitation en attente)', :c1, format($$SELECT jsonb_array_length(public.delivery_staff_list(%L))::text$$, t_id('c1')), '5');
SELECT t_val('303 …statistiques du livreur A1 : 4 courses livrées au total, 0 en cours', :c1,
  format($$SELECT (e->>'delivered') || '/' || (e->>'in_progress') FROM jsonb_array_elements(public.delivery_staff_list(%L)) e WHERE e->>'driver_name' = 'Drv A1'$$, t_id('c1')), '4/0');
SELECT t_val('304 …activité de ops sur 30 jours', :c1,
  format($$SELECT ((e->>'actions_30d')::int > 0)::text FROM jsonb_array_elements(public.delivery_staff_list(%L)) e WHERE e->>'invited_email' = 'ops@test.io'$$, t_id('c1')), 'true');
SELECT t_val('305 espace de travail du livreur : rôle et fiche', :drv, $$SELECT (w->>'role') || '/' || (w->>'driver_id' IS NOT NULL) FROM public.delivery_my_workspace() w$$, 'driver/true');
SELECT t_val('306 espace de travail du propriétaire', :c1, $$SELECT w->>'role' FROM public.delivery_my_workspace() w$$, 'owner');
SELECT t_val('307 espace de travail d''un tiers : vide', :x, $$SELECT COALESCE(public.delivery_my_workspace()::text, 'NULL')$$, 'NULL');
SELECT t_val('308 le livreur n''a pas les droits de gestion dans son espace', :drv, $$SELECT (w->'perms' ? 'operate')::text FROM public.delivery_my_workspace() w$$, 'false');
SELECT t_run('309 livreur : liste des livreurs refusée', :drv, format('SELECT * FROM public.delivery_company_drivers(%L)', t_id('c1')), 'err:42501:%');
SELECT t_val('310 ops : liste des livreurs (sans pièces)', :ops, format('SELECT count(*)::text FROM public.delivery_company_drivers(%L)', t_id('c1')), '3');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
