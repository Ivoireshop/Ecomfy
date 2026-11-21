-- Cas de test de 20261121100000_delivery_premium.sql : abonnement Premium des structures (§4.2).
--
-- À jouer APRÈS delivery_fees_activation_cases.sql (mêmes utilisateurs d1..d5, structures dA/dB/dG/dP/dD, aides t_*,
-- résultats cumulés t_res), sur la même base JETABLE, avec 20261121100000 jouée juste avant ce fichier.
-- dA, dB, dP, dD sont des structures ; dG est un livreur indépendant. :s est un tiers sans structure.
\set ON_ERROR_STOP on

-- Fixture : règle d'activation coupée (le Premium est indépendant de la cotisation) ; dA, dB, dG approuvées et visibles.
SELECT t_run('P00 fixture : règle d''activation coupée', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', 'x', false)$$, 'ok');
UPDATE public.delivery_companies SET verification_status = 'approved', trust_badge_active = true
 WHERE id IN (SELECT v FROM t_ids WHERE k IN ('dA', 'dB', 'dG'));

-- ===============================================================================================================
-- Formules
-- ===============================================================================================================
SELECT t_val('P01 par défaut : une formule mensuelle à 3250 XOF', :a,
  $$SELECT (public.delivery_admin_fee_settings())->'premium_plans'->0->>'code' || '/' || ((public.delivery_admin_fee_settings())->'premium_plans'->0->>'amount') || '/' || ((public.delivery_admin_fee_settings())->'premium_plans'->0->>'currency')$$, 'monthly/3250/XOF');
SELECT t_run('P02 propriétaire : ne modifie pas les formules', :d1, $$SELECT public.delivery_admin_set_premium_plans('[]'::jsonb)$$, 'err:42501:%');
SELECT t_run('P03 anonyme : refusé', NULL, $$SELECT public.delivery_admin_set_premium_plans('[]'::jsonb)$$, 'err:42501:%', 'anon');
SELECT t_run('P04 montant nul refusé', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"x1","label":"Test","months":1,"amount":0,"currency":"USD"}]')$$, 'err:22023:%');
SELECT t_run('P05 durée hors limites refusée', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"x1","label":"Test","months":0,"amount":5,"currency":"USD"}]')$$, 'err:22023:%');
SELECT t_run('P06 durée décimale refusée', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"x1","label":"Test","months":1.5,"amount":5,"currency":"USD"}]')$$, 'err:22023:%');
SELECT t_run('P07 code en double refusé', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"x1","label":"A1","months":1,"amount":5,"currency":"USD"},{"code":"x1","label":"B1","months":3,"amount":12,"currency":"USD"}]')$$, 'err:22023:%');
SELECT t_run('P08 code invalide refusé', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"A B","label":"Test","months":1,"amount":5,"currency":"USD"}]')$$, 'err:22023:%');
SELECT t_run('P09 liste non tableau refusée', :a, $$SELECT public.delivery_admin_set_premium_plans('{"a":1}'::jsonb)$$, 'err:22023:%');
SELECT t_run('P10 admin : deux formules (mensuelle 5 USD, trimestrielle 12 USD)', :a,
  $$SELECT public.delivery_admin_set_premium_plans('[{"code":"monthly","label":"Premium mensuel","months":1,"amount":5,"currency":"usd"},{"code":"quarterly","label":"Premium trimestriel","months":3,"amount":12,"currency":"USD"}]')$$, 'ok');
SELECT t_val('P11 les formules sont enregistrées (devise en majuscules)', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_fee_settings())->'premium_plans')::text || '/' || ((public.delivery_admin_fee_settings())->'premium_plans'->0->>'currency')$$, '2/USD');

-- ===============================================================================================================
-- Souscription par la structure
-- ===============================================================================================================
SELECT t_val('P20 avant souscription : ni actif ni expiré', :d1,
  $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active' || '/' || ((public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'expired')$$, 'false/false');
SELECT t_run('P21 dA : déclare la formule mensuelle', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P1', 'Premium')$$, 'ok');
SELECT t_admin('P22 montant, devise et durée viennent de la formule',
  $$SELECT amount::text || '/' || currency || '/' || period_months::text || '/' || status || '/' || plan_code FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'premium'$$, '5.00/USD/1/pending/monthly');
SELECT t_run('P23 dA : seconde déclaration en attente refusée', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'quarterly', 'Wave', 'W-P2')$$, 'err:23505:%');
SELECT t_run('P24 formule inconnue refusée', :d2, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dB'), 'gold', 'Wave', 'W-P3')$$, 'err:22023:%');
SELECT t_run('P25 dB ne peut pas déclarer pour dA', :d2, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P3')$$, 'err:42501:%');
SELECT t_run('P26 livreur indépendant : non concerné', :d3, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dG'), 'monthly', 'Wave', 'W-P3')$$, 'err:22023:%');
SELECT t_run('P27 mode de paiement manquant refusé', :d2, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dB'), 'monthly', '', 'W-P3')$$, 'err:22023:%');
SELECT t_run('P28 anonyme : refusé', NULL, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P3')$$, 'err:42501:%', 'anon');
SELECT t_val('P29 dA : paiement en attente visible', :d1, $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'pending'$$, 'true');
SELECT t_admin('P30 l''administration est notifiée',
  $$SELECT (count(*) >= 1)::text FROM public.delivery_notifications WHERE kind = 'fee_declared' AND company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND body LIKE '%Premium%'$$, 'true');
SELECT t_run('P31 un tiers ne voit pas le Premium de dA', :d2, $$SELECT public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');
SELECT t_run('P32 un tiers sans structure : refusé', :s, $$SELECT public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');
SELECT t_val('P33 l''historique cotisation/caution ne montre pas le Premium', :d1,
  $$SELECT (SELECT count(*) FROM jsonb_array_elements((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->'payments') e WHERE e->>'kind' = 'premium')::text$$, '0');
SELECT t_run('P34 table : écriture directe interdite', :d1,
  $$INSERT INTO public.delivery_company_payments (company_id, kind, amount, method, status, period_start, period_end) VALUES ((SELECT v FROM t_ids WHERE k = 'dA'), 'premium', 1, 'x', 'confirmed', now(), now() + interval '1 year')$$, 'err:42501:%');
SELECT t_val('P35 pas encore de Premium dans le répertoire (paiement en attente)', :s,
  $$SELECT COALESCE((SELECT bool_or((e->>'premium')::boolean) FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') e), false)::text$$, 'false');

-- ===============================================================================================================
-- Décision de l'administration
-- ===============================================================================================================
SELECT t_run('P40 propriétaire : ne confirme pas son paiement', :d1, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' LIMIT 1), true)$$, 'err:42501:%');
SELECT t_run('P41 admin : rejet sans motif refusé', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' LIMIT 1), false, '')$$, 'err:22023:%');
SELECT t_run('P42 admin : rejette avec motif', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' LIMIT 1), false, 'Référence introuvable')$$, 'ok');
SELECT t_val('P43 après rejet : ni actif ni en attente', :d1,
  $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active' || '/' || ((public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'pending')$$, 'false/false');
SELECT t_run('P44 dA : redéclare', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P4')$$, 'ok');
SELECT t_run('P45 admin : confirme', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' LIMIT 1), true)$$, 'ok');
SELECT t_run('P46 admin : second traitement refusé', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'confirmed' LIMIT 1), true)$$, 'err:22023:%');
SELECT t_val('P47 dA : Premium actif, formule mensuelle', :d1,
  $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active' || '/' || ((public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'plan_code')$$, 'true/monthly');
SELECT t_admin('P48 durée d''un mois exactement',
  $$SELECT (period_end = period_start + interval '1 month')::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'premium' AND status = 'confirmed'$$, 'true');
SELECT t_admin('P49 notifications de dA : rejet puis confirmation, vers la page Premium',
  $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '08080808-0000-0000-0000-000000000008' AND kind IN ('fee_rejected', 'fee_confirmed') AND link = '/delivery/premium'$$, '2');

-- ===============================================================================================================
-- Indépendance vis-à-vis de la vérification et de la cotisation
-- ===============================================================================================================
SELECT t_admin('P50 le Premium ne change pas la vérification',
  $$SELECT verification_status || '/' || trust_badge_active::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dA')$$, 'approved/true');
SELECT t_val('P51 le Premium ne règle pas la cotisation (état inchangé : caution en contrôle)', :d1, $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state'$$, 'payment_review');
UPDATE public.delivery_companies SET verification_status = 'pending_verification', trust_badge_active = false WHERE id = (SELECT v FROM t_ids WHERE k = 'dB');
SELECT t_run('P52 structure non vérifiée : peut souscrire', :d2, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dB'), 'quarterly', 'Orange Money', 'OM-P5')$$, 'ok');
SELECT t_run('P53 admin : confirme le Premium de dB', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' LIMIT 1), true)$$, 'ok');
SELECT t_val('P54 dB (non vérifiée, Premium) absente du répertoire', :s,
  $$SELECT (SELECT count(*) FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') e WHERE e->>'company_name' = 'Dir Beta')::text$$, '0');
SELECT t_run('P55 dB : consultation directe refusée tant qu''elle n''est pas vérifiée', :s, $$SELECT public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dB'))$$, 'err:P0002:%');
SELECT t_admin('P56 durée de trois mois pour la formule trimestrielle',
  $$SELECT (period_end = period_start + interval '3 months')::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dB') AND kind = 'premium' AND status = 'confirmed'$$, 'true');

-- ===============================================================================================================
-- Répertoire : badge et classement
-- ===============================================================================================================
UPDATE public.delivery_companies SET verification_status = 'approved', trust_badge_active = true WHERE id = (SELECT v FROM t_ids WHERE k = 'dB');
-- dG (livreur indépendant, non Premium) reçoit la meilleure note : le Premium doit quand même passer devant.
UPDATE public.delivery_companies SET rating_score = 5.0, successful_deliveries_count = 100 WHERE id = (SELECT v FROM t_ids WHERE k = 'dG');
SELECT t_val('P60 badge Premium exposé pour dA et dB, pas pour les autres', :s,
  $$SELECT string_agg(e->>'company_name' || '=' || (e->>'premium'), ',' ORDER BY e->>'company_name') FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') e$$,
  'Dir Alpha=true,Dir Beta=true,Dir Delta=false,Dir Gamma=false');
SELECT t_val('P61 les Premium passent devant un non-Premium mieux noté (puis par note entre eux)', :s,
  $$SELECT string_agg(x.e->>'company_name', ',' ORDER BY x.n) FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') WITH ORDINALITY AS x(e, n)$$,
  'Dir Beta,Dir Alpha,Dir Gamma,Dir Delta');
SELECT t_val('P62 la fiche détaillée porte aussi le badge', :s, $$SELECT (public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dA')))->>'premium'$$, 'true');
SELECT t_val('P63 un livreur indépendant ne peut pas être Premium', :s, $$SELECT (public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dG')))->>'premium'$$, 'false');

-- ===============================================================================================================
-- Renouvellement, changement de formule, expiration
-- ===============================================================================================================
SELECT t_run('P70 dA : renouvelle avec la formule trimestrielle (changement de formule)', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'quarterly', 'Wave', 'W-P6')$$, 'ok');
SELECT t_run('P71 admin : confirme', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' AND company_id = (SELECT v FROM t_ids WHERE k = 'dA')), true)$$, 'ok');
SELECT t_admin('P72 la nouvelle période commence à l''échéance de la précédente (rien n''est perdu)',
  $$SELECT (n.period_start = o.period_end AND n.period_end = n.period_start + interval '3 months')::text
      FROM public.delivery_company_payments n, public.delivery_company_payments o
     WHERE n.company_id = o.company_id AND n.company_id = (SELECT v FROM t_ids WHERE k = 'dA')
       AND n.kind = 'premium' AND o.kind = 'premium' AND n.plan_code = 'quarterly' AND o.plan_code = 'monthly' AND n.status = 'confirmed' AND o.status = 'confirmed'$$, 'true');
SELECT t_val('P73 la formule en cours reste la mensuelle jusqu''à l''échéance', :d1, $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'plan_code'$$, 'monthly');
-- Fin de la première période : la formule trimestrielle devient celle en cours.
UPDATE public.delivery_company_payments SET period_start = period_start - interval '2 months', period_end = period_end - interval '2 months'
 WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'premium' AND status = 'confirmed';
SELECT t_val('P74 après l''échéance de la première période : formule trimestrielle en cours, toujours actif', :d1,
  $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'plan_code' || '/' || ((public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active')$$, 'quarterly/true');
-- Tout est échu : expiration.
UPDATE public.delivery_company_payments SET period_start = period_start - interval '1 year', period_end = period_end - interval '1 year'
 WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'premium' AND status = 'confirmed';
SELECT t_val('P75 expiré : plus actif, marqué « expiré »', :d1,
  $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active' || '/' || ((public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'expired')$$, 'false/true');
SELECT t_val('P76 expiré : le badge disparaît du répertoire', :s,
  $$SELECT (public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dA')))->>'premium'$$, 'false');
SELECT t_val('P77 expiré : le classement ne favorise plus dA', :s,
  $$SELECT string_agg(x.e->>'company_name', ',' ORDER BY x.n) FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') WITH ORDINALITY AS x(e, n)$$,
  'Dir Beta,Dir Gamma,Dir Delta,Dir Alpha');
SELECT t_run('P78 dA : se réabonne après expiration', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P7')$$, 'ok');
SELECT t_run('P79 admin : confirme', :a, $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE kind = 'premium' AND status = 'pending' AND company_id = (SELECT v FROM t_ids WHERE k = 'dA')), true)$$, 'ok');
SELECT t_admin('P80 réabonnement après expiration : repart de maintenant',
  $$SELECT (period_start > now() - interval '1 minute' AND period_start <= now())::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'premium' AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1$$, 'true');
SELECT t_val('P81 de nouveau actif', :d1, $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active'$$, 'true');

-- ===============================================================================================================
-- Enregistrement par l'administration, fin anticipée, suspension
-- ===============================================================================================================
SELECT t_run('P90 propriétaire : n''enregistre pas un paiement', :d2, $$SELECT public.delivery_admin_record_premium((SELECT v FROM t_ids WHERE k = 'dB'), 'monthly', 'Espèces')$$, 'err:42501:%');
SELECT t_run('P91 admin : formule inconnue refusée', :a, $$SELECT public.delivery_admin_record_premium((SELECT v FROM t_ids WHERE k = 'dP'), 'gold', 'Espèces')$$, 'err:22023:%');
SELECT t_run('P92 admin : livreur indépendant refusé', :a, $$SELECT public.delivery_admin_record_premium((SELECT v FROM t_ids WHERE k = 'dG'), 'monthly', 'Espèces')$$, 'err:22023:%');
SELECT t_run('P93 admin : enregistre un Premium reçu hors ligne pour dP', :a, $$SELECT public.delivery_admin_record_premium((SELECT v FROM t_ids WHERE k = 'dP'), 'monthly', 'Espèces', 'Reçu 12')$$, 'ok');
SELECT t_admin('P94 confirmé tout de suite, source « admin »',
  $$SELECT status || '/' || source || '/' || (SELECT public.delivery_company_is_premium((SELECT v FROM t_ids WHERE k = 'dP')))::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND kind = 'premium'$$, 'confirmed/admin/true');
SELECT t_run('P95 propriétaire : n''arrête pas un Premium', :d1, $$SELECT public.delivery_admin_end_premium((SELECT v FROM t_ids WHERE k = 'dP'), 'Motif de test')$$, 'err:42501:%');
SELECT t_run('P96 admin : fin anticipée sans motif refusée', :a, $$SELECT public.delivery_admin_end_premium((SELECT v FROM t_ids WHERE k = 'dP'), '')$$, 'err:22023:%');
SELECT t_run('P97 admin : arrête le Premium de dP', :a, $$SELECT public.delivery_admin_end_premium((SELECT v FROM t_ids WHERE k = 'dP'), 'Usage abusif du badge')$$, 'ok');
SELECT t_admin('P98 dP n''est plus Premium', $$SELECT public.delivery_company_is_premium((SELECT v FROM t_ids WHERE k = 'dP'))::text$$, 'false');
SELECT t_run('P99 admin : plus rien à arrêter', :a, $$SELECT public.delivery_admin_end_premium((SELECT v FROM t_ids WHERE k = 'dP'), 'Usage abusif du badge')$$, 'err:P0002:%');
SELECT t_admin('P100 la fin anticipée est tracée et notifiée',
  $$SELECT (SELECT count(*) FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND action = 'premium_ended')::text || '/' ||
           (SELECT count(*) FROM public.delivery_notifications WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND kind = 'premium_ended')::text$$, '1/1');
SELECT t_run('P101 admin : suspend dB', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), true, false, 'Plainte en cours')$$, 'ok');
SELECT t_run('P102 structure suspendue : ne peut plus souscrire', :d2, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dB'), 'monthly', 'Wave', 'W-P8')$$, 'err:42501:%');
SELECT t_val('P103 structure suspendue : plus de badge dans le répertoire (non opérationnelle)', :s,
  $$SELECT (SELECT count(*) FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') e WHERE e->>'company_name' = 'Dir Beta')::text$$, '0');
SELECT t_run('P104 admin : rétablit dB', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), false, false, NULL)$$, 'ok');

-- ===============================================================================================================
-- Désactivation des formules, tableau de contrôle, droits
-- ===============================================================================================================
SELECT t_run('P110 admin : liste vide = souscription désactivée', :a, $$SELECT public.delivery_admin_set_premium_plans('[]'::jsonb)$$, 'ok');
SELECT t_run('P111 aucune formule : déclaration refusée', :d1, $$SELECT public.delivery_company_declare_premium((SELECT v FROM t_ids WHERE k = 'dA'), 'monthly', 'Wave', 'W-P9')$$, 'err:22023:%');
SELECT t_val('P112 un abonnement déjà payé reste actif après le retrait des formules', :d1, $$SELECT (public.delivery_company_premium((SELECT v FROM t_ids WHERE k = 'dA')))->>'active'$$, 'true');
SELECT t_run('P113 admin : remet la formule mensuelle', :a, $$SELECT public.delivery_admin_set_premium_plans('[{"code":"monthly","label":"Premium mensuel","months":1,"amount":5,"currency":"USD"}]')$$, 'ok');
SELECT t_val('P114 tableau de contrôle : Premium par structure et formules', :a,
  $$SELECT (SELECT (e->'premium'->>'active') FROM jsonb_array_elements((public.delivery_admin_fee_overview())->'companies') e WHERE e->>'company_name' = 'Dir Alpha') || '/' ||
           jsonb_array_length((public.delivery_admin_fee_overview())->'premium_plans')::text$$, 'true/1');
SELECT t_val('P115 tableau de contrôle : pas de livreur indépendant', :a,
  $$SELECT (SELECT bool_and(e->>'company_name' <> 'Dir Gamma') FROM jsonb_array_elements((public.delivery_admin_fee_overview())->'companies') e)::text$$, 'true');
SELECT t_admin('P116 droits d''exécution',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_company_declare_premium(uuid,text,text,text,text)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_company_premium(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_admin_set_premium_plans(jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_admin_record_premium(uuid,text,text,text,text)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_admin_end_premium(uuid,text)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_premium_state(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_premium_plans_list()', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_company_is_premium(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_fee_confirm_row(uuid,text)', 'EXECUTE'))::text$$, 'true');
SELECT t_admin('P117 la cotisation et la caution fonctionnent toujours (non-régression)',
  $$SELECT (public.delivery_company_fee_state((SELECT v FROM t_ids WHERE k = 'dA')))->>'state'$$, 'payment_review');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
