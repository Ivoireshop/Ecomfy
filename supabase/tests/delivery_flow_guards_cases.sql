-- Cas de test de 20261105100000_delivery_flow_guards.sql (après le socle delivery_flow_guards.sql et la migration).
-- Base JETABLE uniquement. Les cas s'enchaînent sur le même jeu de données : l'ordre compte.
\set ON_ERROR_STOP on

\set o  '11111111-0000-0000-0000-00000000000a'
\set p  '22222222-0000-0000-0000-00000000000b'
\set q  '22222222-0000-0000-0000-00000000000c'
\set d1 '33333333-0000-0000-0000-00000000000d'
\set d2 '33333333-0000-0000-0000-00000000000f'
\set mg '55555555-0000-0000-0000-000000000001'
\set di '77777777-0000-0000-0000-000000000001'
\set x  '44444444-0000-0000-0000-000000000001'

-- Identifiant de commande d'après son numéro (d0000000-…-0000000000NN)
CREATE FUNCTION public.fg_o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('d0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Exécute une instruction sous un rôle et une identité ; observe « ok rows=N » ou « err <message> ».
CREATE FUNCTION public.fg_exec(p_test text, p_role text, p_sub text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql; GET DIAGNOSTICS v_n = ROW_COUNT; v_obs := 'ok rows=' || v_n;
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.fg_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- Lit une valeur (texte) sous un rôle et une identité.
CREATE FUNCTION public.fg_val(p_test text, p_role text, p_sub text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql INTO v_obs; v_obs := coalesce(v_obs, '(null)');
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.fg_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- Lit une valeur en superutilisateur (état de la base).
CREATE FUNCTION public.fg_state(p_test text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text;
BEGIN
  EXECUTE p_sql INTO v_obs; v_obs := coalesce(v_obs, '(null)');
  INSERT INTO public.fg_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

-- ===== Visibilité des livraisons (7 au total : D2 D3 D4 D5 D6 D8 D9 ; livreur 1 en a 5, livreur 2 en a 1) =====
SELECT public.fg_val('01 propriétaire du prestataire : voit 7 livraisons',   'authenticated', :'p',  'SELECT count(*) FROM public.order_deliveries', '7');
SELECT public.fg_val('02 dispatcher : voit 7 livraisons',                    'authenticated', :'mg', 'SELECT count(*) FROM public.order_deliveries', '7');
SELECT public.fg_val('03 livreur 1 : voit SEULEMENT ses 5 courses',          'authenticated', :'d1', 'SELECT count(*) FROM public.order_deliveries', '5');
SELECT public.fg_val('04 livreur 2 : voit SEULEMENT sa course',              'authenticated', :'d2', 'SELECT count(*) FROM public.order_deliveries', '1');
SELECT public.fg_val('05 propriétaire de la boutique : voit les 7',          'authenticated', :'o',  'SELECT count(*) FROM public.order_deliveries', '7');
SELECT public.fg_val('06 tiers : rien',                                      'authenticated', :'x',  'SELECT count(*) FROM public.order_deliveries', '0');
SELECT public.fg_val('07 propriétaire d''un autre prestataire : rien',       'authenticated', :'q',  'SELECT count(*) FROM public.order_deliveries', '0');
SELECT public.fg_val('08 livreur inactif sans course : rien',                'authenticated', :'di', 'SELECT count(*) FROM public.order_deliveries', '0');

-- ===== Missions du livreur (get_my_delivery_missions) =====
SELECT public.fg_val('09 livreur 1 : 5 missions',                            'authenticated', :'d1', 'SELECT count(*) FROM public.get_my_delivery_missions()', '5');
SELECT public.fg_val('10 livreur 1 : filtre pending = 2',                    'authenticated', :'d1', $q$SELECT count(*) FROM public.get_my_delivery_missions(NULL, ARRAY['pending'])$q$, '2');
SELECT public.fg_val('11 commande payée : rien à encaisser',                 'authenticated', :'d1', $q$SELECT amount_to_collect::int FROM public.get_my_delivery_missions() WHERE order_number = 'O8'$q$, '0');
SELECT public.fg_val('12 commande non payée : montant total à encaisser',    'authenticated', :'d1', $q$SELECT amount_to_collect::int FROM public.get_my_delivery_missions() WHERE order_number = 'O2'$q$, '15000');
SELECT public.fg_val('13 livreur 2 : 1 mission',                             'authenticated', :'d2', 'SELECT count(*) FROM public.get_my_delivery_missions()', '1');
SELECT public.fg_val('14 propriétaire de boutique : aucune mission',         'authenticated', :'o',  'SELECT count(*) FROM public.get_my_delivery_missions()', '0');
SELECT public.fg_val('15 tiers : aucune mission',                            'authenticated', :'x',  'SELECT count(*) FROM public.get_my_delivery_missions()', '0');
SELECT public.fg_val('16 livreur inactif : aucune mission',                  'authenticated', :'di', 'SELECT count(*) FROM public.get_my_delivery_missions()', '0');
SELECT public.fg_val('17 anon : refusé',                                     'anon', NULL,           'SELECT count(*) FROM public.get_my_delivery_missions()', 'err permission denied%');
SELECT public.fg_val('18 livreur : aucune lecture directe de orders',        'authenticated', :'d1', 'SELECT count(*) FROM public.orders', '0');
SELECT public.fg_val('19 livreur 1 demande la course du livreur 2 : rien',   'authenticated', :'d1',
  format('SELECT count(*) FROM public.get_my_delivery_missions(%L)', (SELECT id FROM public.order_deliveries WHERE order_id = public.fg_o(6))), '0');
SELECT public.fg_val('20 livreur 1 demande sa course par identifiant : client', 'authenticated', :'d1',
  format('SELECT customer_name FROM public.get_my_delivery_missions(%L)', (SELECT id FROM public.order_deliveries WHERE order_id = public.fg_o(2))), 'Client 2');

-- ===== Plus d'INSERT / DELETE directs =====
SELECT public.fg_exec('21 prestataire : INSERT direct refusé', 'authenticated', :'p',
  $q$INSERT INTO public.order_deliveries (order_id, provider_id) VALUES (public.fg_o(1), 'b0000000-0000-0000-0000-000000000001')$q$, 'err permission denied%');
SELECT public.fg_exec('22 prestataire : DELETE direct refusé', 'authenticated', :'p', $q$DELETE FROM public.order_deliveries WHERE order_id = public.fg_o(4)$q$, 'err permission denied%');
SELECT public.fg_exec('23 livreur : DELETE direct refusé',     'authenticated', :'d1', $q$DELETE FROM public.order_deliveries WHERE order_id = public.fg_o(2)$q$, 'err permission denied%');

-- ===== Affectation : « Expédier » et auto-transfert (charge : livreur 1 = 5 courses actives, livreur 2 = 0) =====
SELECT public.fg_val('24 Expédier O1 : ok (le définer écrit malgré le REVOKE)', 'authenticated', :'o',
  $q$SELECT (public.push_order_to_delivery_provider(public.fg_o(1), 'b0000000-0000-0000-0000-000000000001')->>'success')$q$, 'true');
SELECT public.fg_state('25 livreur le moins chargé choisi (livreur 2)',
  $q$SELECT status || '/' || right(driver_id::text, 3) FROM public.order_deliveries WHERE order_id = public.fg_o(1)$q$, 'pending/002');
UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000001' WHERE order_id = public.fg_o(1);
SELECT public.fg_val('26 nouvel envoi : le livreur déjà affecté est conservé', 'authenticated', :'o',
  $q$SELECT (public.push_order_to_delivery_provider(public.fg_o(1), 'b0000000-0000-0000-0000-000000000001')->>'success')$q$, 'true');
SELECT public.fg_state('27 … toujours le livreur 1',
  $q$SELECT status || '/' || right(driver_id::text, 3) FROM public.order_deliveries WHERE order_id = public.fg_o(1)$q$, 'pending/001');
SELECT public.fg_exec('28 auto-transfert : O10 confirmée', 'authenticated', :'o', $q$UPDATE public.orders SET order_status = 'confirmed' WHERE id = public.fg_o(10)$q$, 'ok rows=1');
SELECT public.fg_state('29 auto-transfert : livraison créée AVEC livreur (le moins chargé)',
  $q$SELECT status || '/' || right(driver_id::text, 3) FROM public.order_deliveries WHERE order_id = public.fg_o(10)$q$, 'pending/002');
-- Remise à l'état initial
DELETE FROM public.order_deliveries WHERE order_id IN (public.fg_o(1), public.fg_o(10));
UPDATE public.orders SET delivery_provider_id = NULL, delivery_transferred_at = NULL WHERE id IN (public.fg_o(1), public.fg_o(10));
UPDATE public.orders SET order_status = 'new' WHERE id = public.fg_o(10);

-- ===== Livreur : machine d'états, preuve, horodatages =====
SELECT public.fg_exec('30 livreur : pending -> delivered refusé',            'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'delivered' WHERE order_id = public.fg_o(2)$q$, 'err Changement de statut interdit%');
SELECT public.fg_exec('31 livreur : pending -> in_transit ok',               'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'in_transit' WHERE order_id = public.fg_o(2)$q$, 'ok rows=1');
SELECT public.fg_state('32 … picked_up_at posé par le serveur',              $q$SELECT status || '/' || (picked_up_at IS NOT NULL)::text FROM public.order_deliveries WHERE order_id = public.fg_o(2)$q$, 'in_transit/true');
SELECT public.fg_state('33 … la commande passe « shipped »',                 $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(2)$q$, 'shipped');
SELECT public.fg_exec('34 livreur : livré sans preuve refusé',               'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'delivered' WHERE order_id = public.fg_o(2)$q$, 'err La preuve de livraison%');
SELECT public.fg_exec('35 livreur : livré avec signature ; delivered_at forgé ignoré', 'authenticated', :'d1',
  $q$UPDATE public.order_deliveries SET status = 'delivered', pod_signature_url = id::text || '/sig.png', delivered_at = '2000-01-01' WHERE order_id = public.fg_o(2)$q$, 'ok rows=1');
SELECT public.fg_state('36 … delivered_at = maintenant',                     $q$SELECT (delivered_at > now() - interval '1 minute')::text FROM public.order_deliveries WHERE order_id = public.fg_o(2)$q$, 'true');
SELECT public.fg_state('37 … la commande passe « delivered »',               $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(2)$q$, 'delivered');
SELECT public.fg_exec('38 livreur : changer order_id refusé',                'authenticated', :'d1', $q$UPDATE public.order_deliveries SET order_id = public.fg_o(1) WHERE order_id = public.fg_o(8)$q$, 'err La commande et le prestataire%');
SELECT public.fg_exec('39 livreur : changer provider_id refusé',             'authenticated', :'d1', $q$UPDATE public.order_deliveries SET provider_id = 'b0000000-0000-0000-0000-000000000002' WHERE order_id = public.fg_o(8)$q$, 'err La commande et le prestataire%');
SELECT public.fg_exec('40 livreur : se réassigner une course refusé',        'authenticated', :'d1', $q$UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000002' WHERE order_id = public.fg_o(8)$q$, 'err Un livreur ne peut pas réassigner%');
SELECT public.fg_exec('41 livreur 1 sur la course du livreur 2 : 0 ligne',   'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'pending' WHERE order_id = public.fg_o(6)$q$, 'ok rows=0');
SELECT public.fg_exec('42 livreur : remettre un échec en attente refusé',    'authenticated', :'d2', $q$UPDATE public.order_deliveries SET status = 'pending' WHERE order_id = public.fg_o(6)$q$, 'err Changement de statut interdit%');
SELECT public.fg_exec('43 livreur : échec sans motif refusé',                'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'failed', failure_reason = '' WHERE order_id = public.fg_o(8)$q$, 'err Le motif de l''échec%');
SELECT public.fg_exec('44 livreur : échec avec motif ok',                    'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'failed', failure_reason = 'Client injoignable' WHERE order_id = public.fg_o(8)$q$, 'ok rows=1');
SELECT public.fg_state('45 … motif enregistré',                              $q$SELECT status || '/' || failure_reason FROM public.order_deliveries WHERE order_id = public.fg_o(8)$q$, 'failed/Client injoignable');
SELECT public.fg_state('46 … la commande garde son statut',                  $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(8)$q$, 'confirmed');
SELECT public.fg_exec('47 livreur : forger picked_up_at sans changer le statut', 'authenticated', :'d1', $q$UPDATE public.order_deliveries SET picked_up_at = '2000-01-01' WHERE order_id = public.fg_o(3)$q$, 'ok rows=1');
SELECT public.fg_state('48 … horodatage non modifié',                        $q$SELECT (picked_up_at IS NULL)::text FROM public.order_deliveries WHERE order_id = public.fg_o(3)$q$, 'true');

-- ===== Gestionnaire (dispatcher) et propriétaire du prestataire =====
SELECT public.fg_exec('49 dispatcher : livreur d''un autre prestataire refusé', 'authenticated', :'mg', $q$UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000004' WHERE order_id = public.fg_o(4)$q$, 'err Livreur invalide%');
SELECT public.fg_exec('50 dispatcher : livreur inactif refusé',                 'authenticated', :'mg', $q$UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000005' WHERE order_id = public.fg_o(4)$q$, 'err Livreur invalide%');
SELECT public.fg_exec('51 dispatcher : affecter un livreur valide ok',          'authenticated', :'mg', $q$UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000002' WHERE order_id = public.fg_o(4)$q$, 'ok rows=1');
SELECT public.fg_exec('52 dispatcher : livreur non modifiable en route',        'authenticated', :'mg', $q$UPDATE public.order_deliveries SET driver_id = 'c0000000-0000-0000-0000-000000000002' WHERE order_id = public.fg_o(5)$q$, 'err Le livreur ne peut plus être changé%');
SELECT public.fg_exec('53 dispatcher : relancer un échec (failed -> pending)',   'authenticated', :'mg', $q$UPDATE public.order_deliveries SET status = 'pending' WHERE order_id = public.fg_o(6)$q$, 'ok rows=1');
SELECT public.fg_state('54 … motif effacé',                                      $q$SELECT status || '/' || coalesce(failure_reason, '-') FROM public.order_deliveries WHERE order_id = public.fg_o(6)$q$, 'pending/-');
SELECT public.fg_exec('55 dispatcher : pending -> delivered refusé',             'authenticated', :'mg', $q$UPDATE public.order_deliveries SET status = 'delivered' WHERE order_id = public.fg_o(6)$q$, 'err Changement de statut interdit%');
SELECT public.fg_exec('56 dispatcher : échec sans motif refusé',                 'authenticated', :'mg', $q$UPDATE public.order_deliveries SET status = 'failed' WHERE order_id = public.fg_o(9)$q$, 'err Le motif de l''échec%');
SELECT public.fg_exec('57 prestataire : échec -> retour boutique',               'authenticated', :'p',  $q$UPDATE public.order_deliveries SET status = 'returned' WHERE order_id = public.fg_o(8)$q$, 'ok rows=1');
SELECT public.fg_state('58 … la commande passe « returned »',                    $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(8)$q$, 'returned');
SELECT public.fg_exec('59 prestataire : livré -> retourné',                      'authenticated', :'p',  $q$UPDATE public.order_deliveries SET status = 'returned' WHERE order_id = public.fg_o(2)$q$, 'ok rows=1');
SELECT public.fg_state('60 … la commande passe « returned »',                    $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(2)$q$, 'returned');
SELECT public.fg_exec('61 prestataire : retourné -> pending refusé (terminal)',  'authenticated', :'p',  $q$UPDATE public.order_deliveries SET status = 'pending' WHERE order_id = public.fg_o(2)$q$, 'err Changement de statut interdit%');
SELECT public.fg_exec('62 autre prestataire : 0 ligne',                          'authenticated', :'q',  $q$UPDATE public.order_deliveries SET status = 'failed', failure_reason = 'x' WHERE order_id = public.fg_o(4)$q$, 'ok rows=0');
SELECT public.fg_exec('63 propriétaire de boutique : pas de mise à jour',        'authenticated', :'o',  $q$UPDATE public.order_deliveries SET status = 'failed', failure_reason = 'x' WHERE order_id = public.fg_o(4)$q$, 'ok rows=0');
SELECT public.fg_exec('64 tiers : 0 ligne',                                      'authenticated', :'x',  $q$UPDATE public.order_deliveries SET status = 'failed', failure_reason = 'x' WHERE order_id = public.fg_o(4)$q$, 'ok rows=0');

-- ===== Commande annulée =====
SELECT public.fg_exec('65 livreur livre une course dont la commande est annulée', 'authenticated', :'d1', $q$UPDATE public.order_deliveries SET status = 'delivered', pod_photo_url = id::text || '/p.png' WHERE order_id = public.fg_o(5)$q$, 'ok rows=1');
SELECT public.fg_state('66 … la commande reste « cancelled » (plus ressuscitée)', $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(5)$q$, 'cancelled');
SELECT public.fg_exec('67 la boutique annule la commande O9 (course en route)',   'authenticated', :'o',  $q$UPDATE public.orders SET order_status = 'cancelled' WHERE id = public.fg_o(9)$q$, 'ok rows=1');
SELECT public.fg_state('68 … la course passe en échec avec motif',                $q$SELECT status || '/' || failure_reason FROM public.order_deliveries WHERE order_id = public.fg_o(9)$q$, 'failed/Commande annulée par la boutique');

-- ===== Droits =====
SELECT public.fg_val('69 pick_delivery_driver : fermé aux utilisateurs', 'authenticated', :'o',
  $q$SELECT (public.pick_delivery_driver('b0000000-0000-0000-0000-000000000001', 'Abidjan')).o_driver_id$q$, 'err permission denied%');
SELECT public.fg_state('70 garde actif', $q$SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.order_deliveries'::regclass AND tgname = 'order_deliveries_guard' AND tgenabled = 'O'$q$, '1');
SELECT public.fg_state('71 EXECUTE anon = faux (missions, acteur, livreur valide)',
  $q$SELECT (has_function_privilege('anon','public.get_my_delivery_missions(uuid,text[])','EXECUTE')
          OR has_function_privilege('anon','public.delivery_actor_kind(uuid,uuid)','EXECUTE')
          OR has_function_privilege('anon','public.delivery_driver_is_valid(uuid,uuid)','EXECUTE'))::text$q$, 'false');

\pset format aligned
SELECT test, pass, observed FROM public.fg_results ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs FROM public.fg_results;
