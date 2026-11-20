-- Cas de test de 20261120120000_delivery_fees_activation.sql : cotisation, caution, activation opérationnelle (§4.1).
--
-- À jouer APRÈS delivery_field_visits_cases.sql (il réutilise ses utilisateurs d1..d5, ses structures dA/dB/dG/dP/dD, ses aides t_*
-- et ses résultats cumulés), sur la même base JETABLE, avec 20261120120000 jouée juste avant ce fichier.
-- Rappel : dA, dB, dP, dD sont des structures (manager) ; dG est un livreur indépendant. :s est un tiers sans structure.
\set ON_ERROR_STOP on

-- Insertion d'une course sous une identité (les politiques d'insertion des marchands ne sont pas l'objet du test :
-- c'est le déclencheur d'accès opérationnel qui est vérifié).
CREATE FUNCTION t_insert_dispatch(p_uid uuid, p_company uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_obs text := 'ok';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), true);
    INSERT INTO public.delivery_dispatches (company_id, city, status) VALUES (p_company, 'Abidjan', 'pending_assignment');
  EXCEPTION WHEN OTHERS THEN
    v_obs := 'err:' || SQLSTATE || ':' || SQLERRM;
  END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v_obs;
END $$;

-- Fixture : les tests précédents ont pu modifier le statut de dA et dB ; une course ne va qu'à une structure approuvée avec badge.
UPDATE public.delivery_companies SET verification_status = 'approved', trust_badge_active = true
 WHERE id IN ((SELECT v FROM t_ids WHERE k = 'dA'), (SELECT v FROM t_ids WHERE k = 'dB'));

-- ===============================================================================================================
-- Réglages
-- ===============================================================================================================
SELECT t_val('F01 par défaut : règle désactivée, aucun montant, la structure est « active » et opérationnelle', :a,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state' || '/' ||
           ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'operational')$$, 'active/true');
SELECT t_run('F02 propriétaire : ne peut pas modifier les réglages', :d1, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', 'x', false)$$, 'err:42501:%');
SELECT t_run('F03 anonyme : refusé', NULL, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', 'x', false)$$, 'err:42501:%', 'anon');
SELECT t_run('F04 montant négatif refusé', :a, $$SELECT public.delivery_admin_set_fee_settings(-1, 12, 50000, 'XOF', 'x', false)$$, 'err:22023:%');
SELECT t_run('F05 devise invalide refusée', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'FRANCS', 'x', false)$$, 'err:22023:%');
SELECT t_run('F06 périodicité hors limites refusée', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 200, 50000, 'XOF', 'x', false)$$, 'err:22023:%');
SELECT t_run('F07 admin : fixe cotisation 15000 / 12 mois, caution 50000, règle encore désactivée', :a,
  $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'xof', 'Restituée à la fermeture du compte, sans litige.', false)$$, 'ok');
SELECT t_val('F08 les réglages sont lus par l''admin', :a, $$SELECT (public.delivery_admin_fee_settings())->'membership_fee'->>'amount'$$, '15000');
SELECT t_run('F09 propriétaire : ne lit pas les réglages d''administration', :d1, $$SELECT public.delivery_admin_fee_settings()$$, 'err:42501:%');

-- ===============================================================================================================
-- Règle désactivée : rien n'est bloqué, mais l'état est visible
-- ===============================================================================================================
SELECT t_val('F10 règle désactivée : dA doit des frais mais reste opérationnelle', :d1,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state' || '/' ||
           ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'operational')$$, 'payment_due/true');
SELECT t_admin('F11 règle désactivée : une course vers dA est acceptée',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';

-- ===============================================================================================================
-- Déclaration d'un paiement par la structure
-- ===============================================================================================================
SELECT t_run('F20 dA : déclare sa cotisation', :d1, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 'Orange Money', 'OM-12345', 'Reçu envoyé')$$, 'ok');
SELECT t_admin('F21 le montant est celui du barème, pas celui du client',
  $$SELECT amount::text || '/' || status || '/' || source FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'membership'$$, '15000.00/pending/declared');
SELECT t_run('F22 dA : seconde déclaration en attente refusée', :d1, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 'Wave', 'W-1')$$, 'err:23505:%');
SELECT t_run('F23 dB ne peut pas déclarer pour dA', :d2, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 'Wave', 'W-1')$$, 'err:42501:%');
SELECT t_run('F24 livreur indépendant : non concerné', :d3, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dG'), 'membership', 'Wave', 'W-1')$$, 'err:22023:%');
SELECT t_run('F25 nature invalide refusée', :d2, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dB'), 'premium', 'Wave', 'W-1')$$, 'err:22023:%');
SELECT t_run('F26 mode de paiement manquant refusé', :d2, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dB'), 'membership', '', 'W-1')$$, 'err:22023:%');
SELECT t_run('F27 anonyme : refusé', NULL, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 'Wave', 'W-1')$$, 'err:42501:%', 'anon');
SELECT t_val('F28 dA : état « paiement en contrôle »', :d1, $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state'$$, 'payment_review');
SELECT t_admin('F29 l''administration est notifiée du paiement à contrôler',
  $$SELECT (count(*) >= 1)::text FROM public.delivery_notifications WHERE kind = 'fee_declared' AND company_id = (SELECT v FROM t_ids WHERE k = 'dA')$$, 'true');
SELECT t_run('F30 un tiers ne voit pas les frais de dA', :d2, $$SELECT public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');
SELECT t_run('F31 un tiers sans structure ne voit pas les frais de dA', :s, $$SELECT public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');
SELECT t_val('F32 table : le propriétaire lit ses paiements, pas ceux d''un autre', :d1,
  $$SELECT count(*)::text FROM public.delivery_company_payments$$, '1');
SELECT t_run('F33 table : écriture directe interdite', :d1,
  $$INSERT INTO public.delivery_company_payments (company_id, kind, amount, method, status) VALUES ((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 1, 'x', 'confirmed')$$, 'err:42501:%');
SELECT t_run('F34 table : modification directe interdite', :d1,
  $$UPDATE public.delivery_company_payments SET status = 'confirmed'$$, 'err:42501:%');

-- ===============================================================================================================
-- Règle activée
-- ===============================================================================================================
SELECT t_run('F40 admin : active la règle', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', 'Restituée à la fermeture du compte, sans litige.', true)$$, 'ok');
SELECT t_admin('F41 règle activée : course vers dA refusée (paiement non confirmé)',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%cotisation%');
SELECT t_admin('F42 règle activée : course vers un livreur indépendant toujours acceptée',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dG'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';
SELECT t_admin('F43 système (sans utilisateur) : non bloqué',
  $$SELECT t_insert_dispatch(NULL, (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';

-- Décision de l'administration
SELECT t_run('F50 propriétaire : ne peut pas confirmer son paiement', :d1,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND status = 'pending'), true)$$, 'err:42501:%');
SELECT t_run('F51 admin : un rejet sans motif est refusé', :a,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND status = 'pending'), false, '')$$, 'err:22023:%');
SELECT t_run('F52 admin : paiement inconnu', :a, $$SELECT public.delivery_admin_decide_payment(gen_random_uuid(), true)$$, 'err:P0002:%');
SELECT t_run('F53 admin : confirme la cotisation de dA', :a,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND status = 'pending'), true, 'Reçu vérifié')$$, 'ok');
SELECT t_run('F54 admin : un paiement déjà traité ne se retraite pas', :a,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND status = 'confirmed'), false, 'Erreur de saisie')$$, 'err:22023:%');
SELECT t_admin('F55 la cotisation court 12 mois',
  $$SELECT (period_end > now() + interval '11 months 20 days' AND period_end < now() + interval '12 months 10 days')::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'membership'$$, 'true');
SELECT t_val('F56 cotisation payée mais caution manquante : toujours « paiement dû »', :d1,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state' || '/' || ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'operational')$$, 'payment_due/false');
SELECT t_admin('F57 course toujours refusée sans caution',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');

-- Caution : enregistrement par l'administration
SELECT t_run('F60 propriétaire : ne peut pas enregistrer de paiement', :d1, $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 50000, 'Espèces')$$, 'err:42501:%');
SELECT t_run('F61 admin : montant nul refusé', :a, $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 0, 'Espèces')$$, 'err:22023:%');
SELECT t_run('F62 admin : livreur indépendant non concerné', :a, $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dG'), 'deposit', 50000, 'Espèces')$$, 'err:22023:%');
SELECT t_run('F63 admin : enregistre la caution de dA (espèces)', :a, $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 50000, 'Espèces', 'Reçu 0042')$$, 'ok');
SELECT t_run('F64 admin : seconde caution refusée', :a, $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 50000, 'Espèces')$$, 'err:23505:%');
SELECT t_run('F65 dA : ne peut plus déclarer de caution', :d1, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 'Wave', 'W-2')$$, 'err:23505:%');
SELECT t_val('F66 dA : active et opérationnelle', :d1,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state' || '/' || ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'operational')$$, 'active/true');
SELECT t_admin('F67 course vers dA acceptée',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';
SELECT t_val('F68 historique : 2 paiements confirmés lus par le propriétaire', :d1,
  $$SELECT jsonb_array_length((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->'payments')::text$$, '2');
SELECT t_admin('F69 le propriétaire est notifié des confirmations',
  $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '08080808-0000-0000-0000-000000000008' AND kind = 'fee_confirmed'$$, '2');
SELECT t_admin('F70 le journal garde les paiements (visibles du propriétaire)',
  $$SELECT string_agg(DISTINCT visibility, ',') FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND action LIKE 'fee_%'$$, 'owner');

-- Renouvellement : la nouvelle échéance part de la fin en cours
SELECT t_run('F80 dA : renouvelle sa cotisation', :d1, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'membership', 'Wave', 'W-9')$$, 'ok');
SELECT t_run('F81 admin : confirme le renouvellement', :a,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND status = 'pending'), true)$$, 'ok');
SELECT t_admin('F82 la fin de validité est repoussée (≈ 24 mois)',
  $$SELECT (max(period_end) > now() + interval '23 months 20 days')::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'membership'$$, 'true');

-- Expiration
UPDATE public.delivery_company_payments SET period_end = now() - interval '1 day' WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'membership';
SELECT t_val('F85 cotisation échue : état « expirée », non opérationnelle', :d1,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'state' || '/' || ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dA')))->>'operational')$$, 'expired/false');
SELECT t_admin('F86 course refusée après expiration',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');

-- Rejet d'un paiement
SELECT t_run('F90 dB : déclare sa cotisation', :d2, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dB'), 'membership', 'Wave', 'W-777')$$, 'ok');
SELECT t_run('F91 admin : rejette avec motif', :a,
  $$SELECT public.delivery_admin_decide_payment((SELECT id FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dB') AND status = 'pending'), false, 'Référence introuvable')$$, 'ok');
SELECT t_val('F92 dB : état « paiement dû » après rejet', :d2, $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dB')))->>'state'$$, 'payment_due');
SELECT t_admin('F93 dB est notifié du rejet avec le motif',
  $$SELECT (body LIKE '%Référence introuvable%')::text FROM public.delivery_notifications WHERE user_id = '09090909-0000-0000-0000-000000000009' AND kind = 'fee_rejected'$$, 'true');
SELECT t_run('F94 dB peut redéclarer après un rejet', :d2, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dB'), 'membership', 'Wave', 'W-778')$$, 'ok');
SELECT t_run('F95 admin : un enregistrement direct remplace la déclaration en attente', :a,
  $$SELECT public.delivery_admin_record_payment((SELECT v FROM t_ids WHERE k = 'dB'), 'membership', 15000, 'Virement', 'VIR-1')$$, 'ok');
SELECT t_admin('F96 dB : plus aucune déclaration en attente',
  $$SELECT count(*)::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dB') AND status = 'pending'$$, '0');

-- ===============================================================================================================
-- Suspension, dispense, restitution
-- ===============================================================================================================
SELECT t_run('F100 admin : suspension sans motif refusée', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), true, false, '')$$, 'err:22023:%');
SELECT t_run('F101 propriétaire : ne peut pas lever sa suspension', :d2, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), false, false, NULL)$$, 'err:42501:%');
SELECT t_run('F102 admin : suspend dB', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), true, false, 'Plaintes répétées de marchands')$$, 'ok');
SELECT t_val('F103 dB : suspendue, non opérationnelle', :d2,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dB')))->>'state' || '/' || ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dB')))->>'operational')$$, 'suspended/false');
SELECT t_admin('F104 course refusée vers une structure suspendue',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dB'))$$, 'err:42501:%');
-- La suspension joue même si la règle d'activation est désactivée.
SELECT t_run('F105 admin : désactive la règle', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', '', false)$$, 'ok');
SELECT t_admin('F106 règle désactivée : la suspension bloque quand même',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dB'))$$, 'err:42501:%');
SELECT t_run('F107 admin : réactive la règle', :a, $$SELECT public.delivery_admin_set_fee_settings(15000, 12, 50000, 'XOF', '', true)$$, 'ok');
SELECT t_run('F108 admin : lève la suspension de dB', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), false, false, NULL)$$, 'ok');
SELECT t_admin('F109 dB : cotisation payée mais caution manquante, toujours bloquée',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dB'))$$, 'err:42501:%');
SELECT t_run('F110 admin : dispense dB (décision motivée)', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dB'), false, true, 'Partenaire historique, caution exemptée')$$, 'ok');
SELECT t_admin('F111 dB dispensée : course acceptée',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dB'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';
SELECT t_val('F112 dB : état « dispensée »', :d2, $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dB')))->>'state'$$, 'waived');
SELECT t_run('F113 admin : livreur indépendant non concerné par la suspension', :a, $$SELECT public.delivery_admin_set_activation((SELECT v FROM t_ids WHERE k = 'dG'), true, false, 'Test de suspension')$$, 'err:22023:%');

-- Restitution de la caution (dA, caution versée)
SELECT t_run('F120 propriétaire : ne peut pas se faire restituer lui-même', :d1, $$SELECT public.delivery_admin_refund_deposit((SELECT v FROM t_ids WHERE k = 'dA'), 'Restitution demandée')$$, 'err:42501:%');
SELECT t_run('F121 admin : modalités obligatoires', :a, $$SELECT public.delivery_admin_refund_deposit((SELECT v FROM t_ids WHERE k = 'dA'), '')$$, 'err:22023:%');
SELECT t_run('F122 admin : restitue la caution de dA', :a, $$SELECT public.delivery_admin_refund_deposit((SELECT v FROM t_ids WHERE k = 'dA'), 'Virement du 20/11, fermeture du compte')$$, 'ok');
SELECT t_run('F123 admin : plus de caution à restituer', :a, $$SELECT public.delivery_admin_refund_deposit((SELECT v FROM t_ids WHERE k = 'dA'), 'Virement du 20/11, fermeture du compte')$$, 'err:P0002:%');
SELECT t_admin('F124 la restitution est tracée',
  $$SELECT status || '/' || (refunded_at IS NOT NULL)::text || '/' || (refunded_by IS NOT NULL)::text FROM public.delivery_company_payments WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND kind = 'deposit'$$, 'refunded/true/true');
SELECT t_admin('F125 dA notifiée de la restitution',
  $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '08080808-0000-0000-0000-000000000008' AND kind = 'deposit_refunded'$$, '1');
SELECT t_run('F126 dA peut reverser une caution après restitution', :d1, $$SELECT public.delivery_company_declare_payment((SELECT v FROM t_ids WHERE k = 'dA'), 'deposit', 'Wave', 'W-300')$$, 'ok');

-- ===============================================================================================================
-- Livreur indépendant, tableau de contrôle, droits
-- ===============================================================================================================
SELECT t_val('F130 livreur indépendant : « non concerné », opérationnel', :d3,
  $$SELECT (public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dG')))->>'state' || '/' || ((public.delivery_company_fees((SELECT v FROM t_ids WHERE k = 'dG')))->>'operational')$$, 'not_applicable/true');
SELECT t_admin('F131 course vers le livreur indépendant acceptée, règle active',
  $$SELECT t_insert_dispatch('05050505-0000-0000-0000-000000000005', (SELECT v FROM t_ids WHERE k = 'dG'))$$, 'ok');
DELETE FROM public.delivery_dispatches WHERE city = 'Abidjan' AND status = 'pending_assignment';
SELECT t_val('F131b répertoire : dA (caution à reverser, règle active) n''est plus proposée ; dB (dispensée) et dG le restent', :s,
  $$SELECT (public.delivery_directory_search('Dir'))->>'total' || '/' ||
           (SELECT string_agg(e->>'company_name', ',' ORDER BY e->>'company_name') FROM jsonb_array_elements((public.delivery_directory_search('Dir'))->'items') e)$$, '2/Dir Beta,Dir Gamma');
SELECT t_val('F132 tableau de contrôle : uniquement des structures (pas le livreur indépendant)', :a,
  $$SELECT (SELECT bool_and(e->>'company_name' <> 'Dir Gamma') FROM jsonb_array_elements((public.delivery_admin_fee_overview())->'companies') e)::text$$, 'true');
SELECT t_val('F133 tableau de contrôle : la caution déclarée de dA est en attente', :a,
  $$SELECT (SELECT count(*) FROM jsonb_array_elements((public.delivery_admin_fee_overview())->'pending') e WHERE e->>'company_name' = 'Dir Alpha' AND e->>'kind' = 'deposit')::text$$, '1');
SELECT t_run('F134 propriétaire : le tableau de contrôle est refusé', :d1, $$SELECT public.delivery_admin_fee_overview()$$, 'err:42501:%');
SELECT t_run('F135 anonyme : le tableau de contrôle est refusé', NULL, $$SELECT public.delivery_admin_fee_overview()$$, 'err:42501:%', 'anon');

SELECT t_admin('F140 fonctions d''administration et internes non exécutables par anon / authenticated selon le cas',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_admin_decide_payment(uuid,boolean,text)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_company_declare_payment(uuid,text,text,text,text)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_company_fee_state(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_company_is_operational(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_fee_confirm_row(uuid,text)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_fee_setting_amount(text)', 'EXECUTE'))::text$$, 'true');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
