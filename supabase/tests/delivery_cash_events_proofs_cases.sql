-- Cas de test de 20261105110000_delivery_cash_events_proofs.sql.
-- À exécuter APRÈS delivery_flow_guards_cases.sql (réutilise ses fonctions fg_* et son état final). Base JETABLE uniquement.
-- État de départ : D2 et D5 livrées sur commandes non payées (2 encaissements : 15000 et 7000), D3 en route (livreur 1),
-- D4 en attente (livreur 2), D9 en échec (annulation de commande).
\set ON_ERROR_STOP on

\set cs '88888888-0000-0000-0000-000000000001'
\set ad '99999999-0000-0000-0000-000000000001'

-- ===== Argent encaissé =====
SELECT public.fg_state('C01 deux livraisons non payées livrées = deux encaissements', 'SELECT count(*)::text FROM public.delivery_payments', '2');
SELECT public.fg_state('C02 montants = total des commandes (15000 + 7000)',           'SELECT sum(amount_collected)::int::text FROM public.delivery_payments', '22000');
SELECT public.fg_state('C03 la commande payée (O8) n''a jamais d''encaissement',       $q$SELECT count(*)::text FROM public.delivery_payments dp JOIN public.order_deliveries od ON od.id = dp.delivery_id WHERE od.order_id = public.fg_o(8)$q$, '0');
SELECT public.fg_val('C04 propriétaire du prestataire : voit 2 encaissements', 'authenticated', :'p',  'SELECT count(*) FROM public.delivery_payments', '2');
SELECT public.fg_val('C05 caissier : voit 2 encaissements',                    'authenticated', :'cs', 'SELECT count(*) FROM public.delivery_payments', '2');
SELECT public.fg_val('C06 admin : voit 2 encaissements',                       'authenticated', :'ad', 'SELECT count(*) FROM public.delivery_payments', '2');
SELECT public.fg_val('C07 dispatcher : ne voit pas l''argent',                 'authenticated', :'mg', 'SELECT count(*) FROM public.delivery_payments', '0');
SELECT public.fg_val('C08 livreur 1 : voit ses encaissements',                 'authenticated', :'d1', 'SELECT count(*) FROM public.delivery_payments', '2');
SELECT public.fg_val('C09 livreur 2 : rien',                                   'authenticated', :'d2', 'SELECT count(*) FROM public.delivery_payments', '0');
SELECT public.fg_val('C10 propriétaire de la boutique : voit les 2',           'authenticated', :'o',  'SELECT count(*) FROM public.delivery_payments', '2');
SELECT public.fg_val('C11 tiers : rien',                                       'authenticated', :'x',  'SELECT count(*) FROM public.delivery_payments', '0');
SELECT public.fg_val('C12 autre prestataire : rien',                           'authenticated', :'q',  'SELECT count(*) FROM public.delivery_payments', '0');
SELECT public.fg_exec('C13 INSERT direct refusé',  'authenticated', :'p', $q$INSERT INTO public.delivery_payments (delivery_id, amount_collected) SELECT id, 1 FROM public.order_deliveries WHERE order_id = public.fg_o(4)$q$, 'err permission denied%');
SELECT public.fg_exec('C14 DELETE direct refusé',  'authenticated', :'p', 'DELETE FROM public.delivery_payments', 'err permission denied%');
SELECT public.fg_exec('C15 caissier : saut d''étape refusé (collecté -> reversé boutique)', 'authenticated', :'cs',
  $q$UPDATE public.delivery_payments SET status = 'remitted_to_shop' WHERE amount_collected = 15000$q$, 'err Étape d''argent interdite%');
SELECT public.fg_exec('C16 caissier : changer le montant refusé', 'authenticated', :'cs',
  $q$UPDATE public.delivery_payments SET amount_collected = 1 WHERE amount_collected = 15000$q$, 'err Le montant encaissé%');
SELECT public.fg_exec('C17 caissier : argent reçu du livreur', 'authenticated', :'cs',
  $q$UPDATE public.delivery_payments SET status = 'remitted_to_company', remitted_to_company_at = '2000-01-01' WHERE amount_collected = 15000$q$, 'ok rows=1');
SELECT public.fg_state('C18 … horodatage posé par le serveur (pas celui du client)',
  $q$SELECT (remitted_to_company_at > now() - interval '1 minute')::text FROM public.delivery_payments WHERE amount_collected = 15000$q$, 'true');
SELECT public.fg_exec('C19 dispatcher : 0 ligne',  'authenticated', :'mg', $q$UPDATE public.delivery_payments SET status = 'remitted_to_company' WHERE amount_collected = 7000$q$, 'ok rows=0');
SELECT public.fg_exec('C20 livreur : 0 ligne',     'authenticated', :'d1', $q$UPDATE public.delivery_payments SET status = 'remitted_to_company' WHERE amount_collected = 7000$q$, 'ok rows=0');
SELECT public.fg_exec('C21 boutique : 0 ligne',    'authenticated', :'o',  $q$UPDATE public.delivery_payments SET status = 'remitted_to_company' WHERE amount_collected = 7000$q$, 'ok rows=0');
SELECT public.fg_exec('C22 propriétaire : reversé à la boutique', 'authenticated', :'p',
  $q$UPDATE public.delivery_payments SET status = 'remitted_to_shop' WHERE amount_collected = 15000$q$, 'ok rows=1');
SELECT public.fg_state('C23 … date de reversement posée', $q$SELECT (remitted_to_shop_at IS NOT NULL)::text FROM public.delivery_payments WHERE amount_collected = 15000$q$, 'true');
SELECT public.fg_exec('C24 retour en arrière refusé (reversé -> collecté)', 'authenticated', :'p',
  $q$UPDATE public.delivery_payments SET status = 'collected_by_driver' WHERE amount_collected = 15000$q$, 'err Étape d''argent interdite%');
SELECT public.fg_exec('C25 forger remitted_to_shop_at sans changer l''étape', 'authenticated', :'p',
  $q$UPDATE public.delivery_payments SET remitted_to_shop_at = '2000-01-01' WHERE amount_collected = 7000$q$, 'ok rows=1');
SELECT public.fg_state('C26 … horodatage non modifié', $q$SELECT (remitted_to_shop_at IS NULL)::text FROM public.delivery_payments WHERE amount_collected = 7000$q$, 'true');

-- ===== Journal / notifications =====
SELECT public.fg_val('C27 boutique : lit le motif d''annulation de O9', 'authenticated', :'o',
  $q$SELECT detail FROM public.delivery_events WHERE order_number = 'O9' AND status = 'failed'$q$, 'Commande annulée par la boutique');
SELECT public.fg_val('C28 livreur 1 : ne voit que ses événements', 'authenticated', :'d1',
  $q$SELECT count(*) FILTER (WHERE driver_user_id IS DISTINCT FROM auth.uid()) FROM public.delivery_events$q$, '0');
SELECT public.fg_val('C29 livreur 1 : en voit', 'authenticated', :'d1', 'SELECT (count(*) > 0)::text FROM public.delivery_events', 'true');
SELECT public.fg_val('C30 dispatcher : voit les événements du prestataire', 'authenticated', :'mg', 'SELECT (count(*) > 0)::text FROM public.delivery_events', 'true');
SELECT public.fg_val('C31 tiers : rien',              'authenticated', :'x', 'SELECT count(*) FROM public.delivery_events', '0');
SELECT public.fg_val('C32 autre prestataire : rien',  'authenticated', :'q', 'SELECT count(*) FROM public.delivery_events', '0');
SELECT public.fg_exec('C33 écriture directe refusée', 'authenticated', :'p',
  $q$INSERT INTO public.delivery_events (delivery_id, order_id, provider_id, kind) VALUES (gen_random_uuid(), gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'status')$q$, 'err permission denied%');
SELECT public.fg_state('C34 événements d''argent journalisés (2 encaissements + 2 étapes)', $q$SELECT count(*)::text FROM public.delivery_events WHERE kind = 'cash'$q$, '4');
SELECT public.fg_state('C35 affectation du livreur 2 sur D4 journalisée', $q$SELECT count(*)::text FROM public.delivery_events e JOIN public.order_deliveries od ON od.id = e.delivery_id WHERE od.order_id = public.fg_o(4) AND e.kind = 'assigned'$q$, '1');

-- ===== Accès du personnel (RPC) =====
SELECT public.fg_val('C36 propriétaire : son prestataire en tête',   'authenticated', :'p',  'SELECT member_role FROM public.get_my_delivery_provider()', 'owner');
SELECT public.fg_val('C37 dispatcher : trouve son prestataire',       'authenticated', :'mg', 'SELECT member_role FROM public.get_my_delivery_provider()', 'dispatcher');
SELECT public.fg_val('C38 caissier : trouve son prestataire',         'authenticated', :'cs', 'SELECT member_role FROM public.get_my_delivery_provider()', 'cashier');
SELECT public.fg_val('C39 livreur : pas d''écran prestataire',        'authenticated', :'d1', 'SELECT member_role FROM public.get_my_delivery_provider()', '(null)');
SELECT public.fg_val('C40 tiers : rien',                              'authenticated', :'x',  'SELECT member_role FROM public.get_my_delivery_provider()', '(null)');
SELECT public.fg_val('C41 dispatcher : lit les 7 livraisons avec le client', 'authenticated', :'mg',
  $q$SELECT count(*) || '/' || count(customer_name) FROM public.get_provider_deliveries('b0000000-0000-0000-0000-000000000001')$q$, '7/7');
SELECT public.fg_val('C42 tiers : aucune livraison',        'authenticated', :'x', $q$SELECT count(*) FROM public.get_provider_deliveries('b0000000-0000-0000-0000-000000000001')$q$, '0');
SELECT public.fg_val('C43 autre prestataire : aucune',      'authenticated', :'q', $q$SELECT count(*) FROM public.get_provider_deliveries('b0000000-0000-0000-0000-000000000001')$q$, '0');
SELECT public.fg_val('C44 livreur : aucune',                'authenticated', :'d1', $q$SELECT count(*) FROM public.get_provider_deliveries('b0000000-0000-0000-0000-000000000001')$q$, '0');
SELECT public.fg_val('C45 dispatcher : équipe avec noms',   'authenticated', :'mg',
  $q$SELECT string_agg(full_name, ',' ORDER BY full_name) FROM public.get_provider_drivers('b0000000-0000-0000-0000-000000000001') WHERE full_name IS NOT NULL$q$, 'Caissier,Dispatcher,Livreur Deux,Livreur Un');
SELECT public.fg_val('C46 livreur : pas d''équipe',          'authenticated', :'d1', $q$SELECT count(*) FROM public.get_provider_drivers('b0000000-0000-0000-0000-000000000001')$q$, '0');
SELECT public.fg_val('C47 caisse : propriétaire voit 2 lignes', 'authenticated', :'p',  $q$SELECT count(*) FROM public.get_provider_payments('b0000000-0000-0000-0000-000000000001')$q$, '2');
SELECT public.fg_val('C48 caisse : dispatcher exclu',           'authenticated', :'mg', $q$SELECT count(*) FROM public.get_provider_payments('b0000000-0000-0000-0000-000000000001')$q$, '0');
SELECT public.fg_val('C49 caisse : nom du livreur',             'authenticated', :'cs', $q$SELECT DISTINCT driver_name FROM public.get_provider_payments('b0000000-0000-0000-0000-000000000001')$q$, 'Livreur Un');

-- ===== Preuves de livraison =====
SELECT public.fg_exec('C50 livreur 1 dépose sa preuve (D3, en route)', 'authenticated', :'d1',
  format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', %L)$q$,
         (SELECT id::text FROM public.order_deliveries WHERE order_id = public.fg_o(3)) || '/sig.png'), 'ok rows=1');
SELECT public.fg_exec('C51 livreur 1 dans le dossier d''une course du livreur 2 : refusé', 'authenticated', :'d1',
  format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', %L)$q$,
         (SELECT id::text FROM public.order_deliveries WHERE order_id = public.fg_o(4)) || '/sig.png'), 'err new row violates%');
SELECT public.fg_exec('C52 livreur 1 dans le dossier d''une course déjà livrée : refusé', 'authenticated', :'d1',
  format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', %L)$q$,
         (SELECT id::text FROM public.order_deliveries WHERE order_id = public.fg_o(5)) || '/sig.png'), 'err new row violates%');
SELECT public.fg_exec('C53 livreur 2 dans le dossier de D3 : refusé', 'authenticated', :'d2',
  format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', %L)$q$,
         (SELECT id::text FROM public.order_deliveries WHERE order_id = public.fg_o(3)) || '/x.png'), 'err new row violates%');
SELECT public.fg_exec('C54 boutique ne dépose pas de preuve', 'authenticated', :'o',
  format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', %L)$q$,
         (SELECT id::text FROM public.order_deliveries WHERE order_id = public.fg_o(3)) || '/x.png'), 'err new row violates%');
SELECT public.fg_exec('C55 dossier qui n''est pas un identifiant : refusé', 'authenticated', :'d1',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-proofs', 'abc/x.png')$q$, 'err new row violates%');
SELECT public.fg_exec('C56 autre bucket : refusé', 'authenticated', :'d1',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('shop-images', 'x/y.png')$q$, 'err new row violates%');
SELECT public.fg_val('C57 livreur 1 relit sa preuve',            'authenticated', :'d1', 'SELECT count(*) FROM storage.objects', '1');
SELECT public.fg_val('C58 boutique relit la preuve',             'authenticated', :'o',  'SELECT count(*) FROM storage.objects', '1');
SELECT public.fg_val('C59 propriétaire du prestataire la relit', 'authenticated', :'p',  'SELECT count(*) FROM storage.objects', '1');
SELECT public.fg_val('C60 dispatcher la relit',                  'authenticated', :'mg', 'SELECT count(*) FROM storage.objects', '1');
SELECT public.fg_val('C61 livreur 2 : ne la voit pas',           'authenticated', :'d2', 'SELECT count(*) FROM storage.objects', '0');
SELECT public.fg_val('C62 tiers : ne la voit pas',               'authenticated', :'x',  'SELECT count(*) FROM storage.objects', '0');
SELECT public.fg_val('C63 autre prestataire : ne la voit pas',   'authenticated', :'q',  'SELECT count(*) FROM storage.objects', '0');
SELECT public.fg_state('C64 bucket privé', $q$SELECT public::text FROM storage.buckets WHERE id = 'delivery-proofs'$q$, 'false');

-- Garde de chemin de preuve (colonne order_deliveries)
SELECT public.fg_exec('C65 livreur : image encodée en base refusée', 'authenticated', :'d1',
  $q$UPDATE public.order_deliveries SET pod_signature_url = 'data:image/png;base64,AAAA' WHERE order_id = public.fg_o(3)$q$, 'err La preuve doit être déposée%');
SELECT public.fg_exec('C66 livreur : chemin d''une autre livraison refusé', 'authenticated', :'d1',
  $q$UPDATE public.order_deliveries SET pod_signature_url = 'ffffffff-ffff-ffff-ffff-ffffffffffff/sig.png' WHERE order_id = public.fg_o(3)$q$, 'err La preuve doit être déposée%');
SELECT public.fg_exec('C67 livreur : livre avec le chemin de sa preuve', 'authenticated', :'d1',
  $q$UPDATE public.order_deliveries SET status = 'delivered', pod_signature_url = id::text || '/sig.png' WHERE order_id = public.fg_o(3)$q$, 'ok rows=1');
SELECT public.fg_state('C68 … nouvel encaissement (O3 non payée, 20000)', $q$SELECT amount_collected::int::text FROM public.delivery_payments dp JOIN public.order_deliveries od ON od.id = dp.delivery_id WHERE od.order_id = public.fg_o(3)$q$, '20000');
SELECT public.fg_state('C69 … la commande passe « delivered »', $q$SELECT order_status FROM public.orders WHERE id = public.fg_o(3)$q$, 'delivered');

-- Droits
SELECT public.fg_state('C70 EXECUTE anon = faux (rôle, preuve, RPC prestataire)',
  $q$SELECT (has_function_privilege('anon','public.delivery_provider_role(uuid)','EXECUTE')
          OR has_function_privilege('anon','public.delivery_proof_access(text,boolean)','EXECUTE')
          OR has_function_privilege('anon','public.get_my_delivery_provider()','EXECUTE')
          OR has_function_privilege('anon','public.get_provider_deliveries(uuid)','EXECUTE')
          OR has_function_privilege('anon','public.get_provider_payments(uuid)','EXECUTE'))::text$q$, 'false');

\pset format aligned
SELECT test, pass, observed FROM public.fg_results WHERE test LIKE 'C%' OR NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs FROM public.fg_results;
