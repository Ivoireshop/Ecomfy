-- Cas de test de 20261120110000_delivery_field_visits.sql : agents terrain, visites, rapport, règle d'approbation.
--
-- À jouer APRÈS delivery_directory_profile_cases.sql (il réutilise ses utilisateurs, ses structures dA/dB/dG/dP, ses aides
-- t_* et ses résultats cumulés), sur la même base JETABLE. Ordre complet : voir delivery_directory_profile_cases.sql, puis
-- 20261120110000 juste avant ce fichier.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('0c0c0c0c-0000-0000-0000-00000000000c', 'g1@test'), ('0d0d0d0d-0000-0000-0000-00000000000d', 'g2@test'),
  ('0e0e0e0e-0000-0000-0000-00000000000e', 'g3@test'), ('0f0f0f0f-0000-0000-0000-00000000000f', 'd5@test');
\set g1 '''0c0c0c0c-0000-0000-0000-00000000000c'''
\set g2 '''0d0d0d0d-0000-0000-0000-00000000000d'''
\set g3 '''0e0e0e0e-0000-0000-0000-00000000000e'''
\set d5 '''0f0f0f0f-0000-0000-0000-00000000000f'''

SELECT t_run('V00 d5 : inscription Delta (structure à vérifier)', :d5, t_register(:d5, t_company(:d5, 'Dir Delta', 'CI 4001 0005')), 'ok');
INSERT INTO t_ids SELECT 'dD', id FROM public.delivery_companies WHERE user_id = '0f0f0f0f-0000-0000-0000-00000000000f';

-- ===============================================================================================================
-- Agents terrain
-- ===============================================================================================================
SELECT t_run('V01 admin : désigne g1 agent terrain', :a, $$SELECT public.delivery_admin_set_field_agent('G1@test', 'Agent Un', '+2250100000001', true)$$, 'ok');
SELECT t_run('V02 admin : désigne g3 agent terrain', :a, $$SELECT public.delivery_admin_set_field_agent('g3@test', 'Agent Trois')$$, 'ok');
SELECT t_run('V03 admin : e-mail inconnu refusé', :a, $$SELECT public.delivery_admin_set_field_agent('personne@test', 'Nobody')$$, 'err:P0002:%');
SELECT t_run('V04 admin : nom trop court refusé', :a, $$SELECT public.delivery_admin_set_field_agent('g2@test', 'X')$$, 'err:23514:%');
SELECT t_run('V05 propriétaire d''une structure : ne peut pas désigner d''agent', :d4, $$SELECT public.delivery_admin_set_field_agent('g2@test', 'Agent Deux')$$, 'err:42501:%');
SELECT t_run('V06 g1 (agent) : ne peut pas désigner d''agent', :g1, $$SELECT public.delivery_admin_set_field_agent('g2@test', 'Agent Deux')$$, 'err:42501:%');
SELECT t_run('V07 anonyme : refusé', NULL, $$SELECT public.delivery_admin_set_field_agent('g2@test', 'Agent Deux')$$, 'err:42501:%', 'anon');
SELECT t_val('V08 admin : liste des agents (g1 et g3, e-mail inclus)', :a,
  $$SELECT count(*)::text || '/' || bool_or((e ->> 'email') = 'g1@test')::text FROM jsonb_array_elements(public.delivery_admin_field_agents()) e$$, '2/true');
SELECT t_run('V09 g1 : la liste des agents est refusée', :g1, $$SELECT public.delivery_admin_field_agents()$$, 'err:42501:%');
SELECT t_admin('V10 g1 est notifié de son rôle', $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '0c0c0c0c-0000-0000-0000-00000000000c' AND kind = 'field_agent_enabled'$$, '1');
SELECT t_val('V11 g1 est agent, g2 ne l''est pas', :g1, $$SELECT public.delivery_is_field_agent()::text$$, 'true');
SELECT t_val('V12 g2 n''est pas agent', :g2, $$SELECT public.delivery_is_field_agent()::text$$, 'false');

-- ===============================================================================================================
-- Programmation
-- ===============================================================================================================
SELECT t_run('V20 admin : programme une visite chez Pending avec g1', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dP'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '1 day', 'Sonner au portail bleu')$$, 'ok');
INSERT INTO t_ids SELECT 'v1', id FROM public.delivery_field_visits WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND status = 'scheduled';
SELECT t_run('V21 admin : seconde visite ouverte sur le même dossier refusée', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dP'), '0e0e0e0e-0000-0000-0000-00000000000e', now() + interval '2 day')$$, 'err:23505:%');
SELECT t_run('V22 admin : date passée refusée', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() - interval '3 day')$$, 'err:22023:%');
SELECT t_run('V23 admin : un compte qui n''est pas agent refusé', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0d0d0d0d-0000-0000-0000-00000000000d', now() + interval '1 day')$$, 'err:22023:%');
SELECT t_run('V24 admin : dossier inconnu refusé', :a,
  $$SELECT public.delivery_admin_schedule_visit(gen_random_uuid(), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '1 day')$$, 'err:P0002:%');
SELECT t_run('V25 propriétaire : ne peut pas programmer de visite', :d4,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '1 day')$$, 'err:42501:%');
SELECT t_run('V26 agent : ne peut pas programmer de visite', :g1,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '1 day')$$, 'err:42501:%');
SELECT t_admin('V27 l''agent est notifié de la mission', $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '0c0c0c0c-0000-0000-0000-00000000000c' AND kind = 'field_visit_assigned'$$, '1');
SELECT t_admin('V28 le propriétaire est notifié de la visite', $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '0b0b0b0b-0000-0000-0000-00000000000b' AND kind = 'field_visit_scheduled'$$, '1');
SELECT t_admin('V29 le journal garde la programmation (visible du propriétaire)',
  $$SELECT visibility FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND action = 'visit_scheduled'$$, 'owner');

-- Statut de vérification (§5.3)
SELECT t_val('V30 statut : « visite programmée » (vu par le propriétaire)', :d4,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP')))->>'field_status'$$, 'visit_scheduled');
SELECT t_val('V31 statut d''une structure sans visite, dossier en attente : « demandée »', :d5,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dD')))->>'field_status'$$, 'requested');
SELECT t_val('V32 statut d''une structure approuvée : « vérifiée »', :d2,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dB')))->>'field_status'$$, 'verified');
SELECT t_run('V33 un tiers ne voit pas le statut de visite d''une autre structure', :d5,
  $$SELECT public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP'))$$, 'err:42501:%');
SELECT t_val('V34 le propriétaire ne reçoit ni observations, ni photos, ni contrôles', :d4,
  $$SELECT ((public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP')))->'visit' ?| ARRAY['observations','photos','checks','outcome','agent_id'])::text$$, 'false');

-- ===============================================================================================================
-- Agent : missions, démarrage, rapport
-- ===============================================================================================================
SELECT t_val('V40 g1 voit sa mission avec la structure à visiter', :g1,
  $$SELECT count(*)::text || '/' || min(e -> 'company' ->> 'name') FROM jsonb_array_elements(public.delivery_agent_my_visits()) e$$, '1/Dir Pending');
SELECT t_val('V41 la mission ne contient aucune donnée d''identité ni fiscale', :g1,
  $$SELECT ((public.delivery_agent_my_visits())->0->'company' ?| ARRAY['user_id','id_number','tax_id_number','manager_id_photo_url','manager_selfie_with_id_url','admin_notes'])::text$$, 'false');
SELECT t_val('V42 g3 (autre agent) ne voit pas la mission de g1', :g3, $$SELECT jsonb_array_length(public.delivery_agent_my_visits())::text$$, '0');
SELECT t_run('V43 g2 (non agent) : missions refusées', :g2, $$SELECT public.delivery_agent_my_visits()$$, 'err:42501:%');
SELECT t_run('V44 propriétaire : missions refusées', :d4, $$SELECT public.delivery_agent_my_visits()$$, 'err:42501:%');
SELECT t_run('V45 g3 ne peut pas démarrer la mission de g1', :g3, $$SELECT public.delivery_agent_start_visit((SELECT v FROM t_ids WHERE k = 'v1'))$$, 'err:P0002:%');
SELECT t_run('V46 g1 : résultat avant démarrage refusé', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[])$$, 'err:22023:%');
SELECT t_run('V47 g1 démarre la visite', :g1, $$SELECT public.delivery_agent_start_visit((SELECT v FROM t_ids WHERE k = 'v1'))$$, 'ok');
SELECT t_run('V48 g1 : second démarrage refusé', :g1, $$SELECT public.delivery_agent_start_visit((SELECT v FROM t_ids WHERE k = 'v1'))$$, 'err:22023:%');
SELECT t_val('V49 statut : « vérification en cours »', :d4,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP')))->>'field_status'$$, 'in_progress');

-- Validations du rapport
SELECT t_run('V50 résultat inconnu refusé', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'ok', '{}'::jsonb, 'x', ARRAY[]::text[])$$, 'err:22023:%');
SELECT t_run('V51 concluante sans tous les contrôles refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'passed',
     '{"premises_exist":true,"address_matches":true,"company_exists":true,"delivery_activity":false,"info_consistent":true}'::jsonb,
     'RAS', ARRAY['0c0c0c0c-0000-0000-0000-00000000000c/a.jpg'])$$, 'err:23514:%activité de livraison%');
SELECT t_run('V52 concluante sans photo refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'passed',
     '{"premises_exist":true,"address_matches":true,"company_exists":true,"delivery_activity":true,"info_consistent":true}'::jsonb,
     'RAS', ARRAY[]::text[])$$, 'err:23514:%photo%');
SELECT t_run('V53 non concluante sans observations refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'court', ARRAY[]::text[])$$, 'err:23514:%observations%');
SELECT t_run('V54 photo dans le dossier d''un autre refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY['0e0e0e0e-0000-0000-0000-00000000000e/a.jpg'])$$, 'err:22023:%Photo invalide%');
SELECT t_run('V55 photo en URL externe refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY['https://evil.test/x.jpg'])$$, 'err:22023:%Photo invalide%');
SELECT t_run('V56 photo avec remontée de dossier refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY['0c0c0c0c-0000-0000-0000-00000000000c/../x.jpg'])$$, 'err:22023:%Photo invalide%');
SELECT t_run('V57 contrôle inconnu refusé', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{"hack":true}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[])$$, 'err:22023:%');
SELECT t_run('V58 contrôle non booléen refusé', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{"premises_exist":"oui"}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[])$$, 'err:22023:%');
SELECT t_run('V59 date de visite dans le futur refusée', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[], current_date + 2)$$, 'err:22023:%');
SELECT t_run('V60 g3 ne peut pas déposer le rapport de g1', :g3,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[])$$, 'err:P0002:%');
SELECT t_run('V61 g1 : rapport non concluant avec observations et photo', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed',
     '{"premises_exist":false,"address_matches":false}'::jsonb, 'Aucun local à cette adresse : terrain vague.', ARRAY['0c0c0c0c-0000-0000-0000-00000000000c/terrain.jpg'])$$, 'ok');
SELECT t_run('V62 g1 : second rapport sur la même visite refusé', :g1,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v1'), 'failed', '{}'::jsonb, 'Locaux introuvables à l''adresse', ARRAY[]::text[])$$, 'err:22023:%');
SELECT t_admin('V63 la visite est terminée, résultat « non concluante », date de visite renseignée',
  $$SELECT status || '/' || outcome || '/' || (visited_on IS NOT NULL)::text FROM public.delivery_field_visits WHERE id = (SELECT v FROM t_ids WHERE k = 'v1')$$, 'completed/failed/true');
SELECT t_admin('V64 les administrateurs sont notifiés du rapport', $$SELECT (count(*) >= 1)::text FROM public.delivery_notifications WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND kind = 'field_visit_completed'$$, 'true');
SELECT t_admin('V65 le propriétaire est informé de la visite, sans le rapport', $$SELECT count(*)::text || '/' || max(body) FROM public.delivery_notifications WHERE user_id = '0b0b0b0b-0000-0000-0000-00000000000b' AND kind = 'field_visit_done'$$, '1/L''équipe eComfy examine le rapport%');
SELECT t_admin('V66 le journal du rapport est interne (invisible du propriétaire)',
  $$SELECT visibility FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND action = 'visit_completed'$$, 'internal');
SELECT t_val('V67 le propriétaire ne lit pas l''entrée interne du journal', :d4,
  $$SELECT count(*)::text FROM public.delivery_verification_audit WHERE action = 'visit_completed'$$, '0');
SELECT t_val('V68 l''administrateur voit le rapport complet (observations, photo, agent)', :a,
  $$SELECT (e ->> 'observations') || '|' || jsonb_array_length(e -> 'photos') || '|' || (e ->> 'agent_name') FROM jsonb_array_elements(public.delivery_admin_field_visits('completed')) e WHERE e ->> 'id' = (SELECT v::text FROM t_ids WHERE k = 'v1')$$,
  'Aucun local à cette adresse : terrain vague.|1|Agent Un');
SELECT t_run('V69 le propriétaire ne peut pas lire les rapports', :d4, $$SELECT public.delivery_admin_field_visits()$$, 'err:42501:%');

-- Dossiers en attente de visite
SELECT t_val('V70 dossiers à visiter : Pending (dernière visite non concluante) et Delta', :a,
  $$SELECT string_agg(e ->> 'company_name' || ':' || COALESCE(e ->> 'last_visit_outcome', '-'), ',' ORDER BY e ->> 'company_name')
      FROM jsonb_array_elements(public.delivery_admin_pending_verifications()) e WHERE e ->> 'company_name' IN ('Dir Pending', 'Dir Delta')$$,
  'Dir Delta:-,Dir Pending:failed');

-- ===============================================================================================================
-- Règle d'approbation
-- ===============================================================================================================
SELECT t_val('V80 réglage par défaut : visite non exigée', :a, $$SELECT (public.delivery_admin_get_settings())->>'require_field_visit'$$, 'false');
SELECT t_run('V81 réglage désactivé : Delta approuvée sans visite', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'dD'), 'approved', NULL, NULL, NULL, NULL, true)$$, 'ok');
SELECT t_run('V82 propriétaire : ne peut pas activer la règle', :d4, $$SELECT public.delivery_admin_set_require_visit(true)$$, 'err:42501:%');
SELECT t_run('V83 admin : active la règle', :a, $$SELECT public.delivery_admin_set_require_visit(true)$$, 'ok');
SELECT t_run('V84 règle active : Pending (visite non concluante) ne peut pas être approuvée', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'dP'), 'approved', NULL, NULL, NULL, NULL, true)$$, 'err:23514:%visite terrain concluante%');
SELECT t_run('V85 règle active : le propriétaire ne peut pas s''approuver lui-même', :d4,
  $$UPDATE public.delivery_companies SET verification_status = 'approved' WHERE user_id = auth.uid()$$, 'err:42501:%');
SELECT t_run('V86 admin : nouvelle visite chez Pending avec g3', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dP'), '0e0e0e0e-0000-0000-0000-00000000000e', now() + interval '2 day')$$, 'ok');
INSERT INTO t_ids SELECT 'v2', id FROM public.delivery_field_visits WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dP') AND status = 'scheduled';
SELECT t_run('V87 g3 démarre', :g3, $$SELECT public.delivery_agent_start_visit((SELECT v FROM t_ids WHERE k = 'v2'))$$, 'ok');
SELECT t_run('V88 g3 : visite concluante complète', :g3,
  $$SELECT public.delivery_agent_submit_visit((SELECT v FROM t_ids WHERE k = 'v2'), 'passed',
     '{"premises_exist":true,"address_matches":true,"company_exists":true,"delivery_activity":true,"equipment_adequate":true,"info_consistent":true}'::jsonb,
     'Entrepôt conforme, 4 motos, activité confirmée.', ARRAY['0e0e0e0e-0000-0000-0000-00000000000e/entrepot.jpg', '0e0e0e0e-0000-0000-0000-00000000000e/motos.jpg'])$$, 'ok');
SELECT t_run('V89 règle active : Pending approuvée après visite concluante', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'dP'), 'approved', NULL, NULL, NULL, NULL, true)$$, 'ok');
SELECT t_val('V90 statut : « vérifiée »', :d4,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP')))->>'field_status'$$, 'verified');

-- Re-vérification : une nouvelle adresse exige une nouvelle visite.
SELECT t_run('V91 d4 : change son adresse (structure vérifiée)', :d4,
  $$UPDATE public.delivery_companies SET headquarters_address = 'Nouvelle adresse, Yopougon' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_run('V92 la visite d''avant ne suffit plus : approbation refusée', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'dP'), 'approved', NULL, NULL, NULL, NULL, true)$$, 'err:23514:%visite terrain concluante%');
SELECT t_run('V93 règle active : un refus reste possible sans visite', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'dP'), 'action_required', NULL, NULL, 'Merci de confirmer votre nouvelle adresse.')$$, 'ok');
SELECT t_val('V94 statut : « informations complémentaires demandées »', :d4,
  $$SELECT (public.delivery_company_visit_summary((SELECT v FROM t_ids WHERE k = 'dP')))->>'field_status'$$, 'info_requested');

-- ===============================================================================================================
-- Annulation, désactivation
-- ===============================================================================================================
SELECT t_run('V100 admin : visite chez Beta avec g1', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '3 day')$$, 'ok');
INSERT INTO t_ids SELECT 'v3', id FROM public.delivery_field_visits WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dB') AND status = 'scheduled';
SELECT t_run('V101 annulation sans motif refusée', :a, $$SELECT public.delivery_admin_cancel_visit((SELECT v FROM t_ids WHERE k = 'v3'), '')$$, 'err:22023:%');
SELECT t_run('V102 propriétaire : ne peut pas annuler', :d2, $$SELECT public.delivery_admin_cancel_visit((SELECT v FROM t_ids WHERE k = 'v3'), 'Je préfère non')$$, 'err:42501:%');
SELECT t_run('V103 admin : annule avec motif', :a, $$SELECT public.delivery_admin_cancel_visit((SELECT v FROM t_ids WHERE k = 'v3'), 'Agent indisponible')$$, 'ok');
SELECT t_admin('V104 la visite est annulée, motif conservé', $$SELECT status || '/' || cancelled_reason FROM public.delivery_field_visits WHERE id = (SELECT v FROM t_ids WHERE k = 'v3')$$, 'cancelled/Agent indisponible');
SELECT t_admin('V105 l''agent et le propriétaire sont prévenus', $$SELECT (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'field_visit_cancelled' AND user_id = '0c0c0c0c-0000-0000-0000-00000000000c')::text || '/' || (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'field_visit_cancelled' AND user_id = '09090909-0000-0000-0000-000000000009')::text$$, '1/1');
SELECT t_run('V106 une visite annulée ne peut plus être annulée', :a, $$SELECT public.delivery_admin_cancel_visit((SELECT v FROM t_ids WHERE k = 'v3'), 'encore')$$, 'err:22023:%');
SELECT t_run('V107 une visite terminée ne peut pas être annulée', :a, $$SELECT public.delivery_admin_cancel_visit((SELECT v FROM t_ids WHERE k = 'v2'), 'trop tard')$$, 'err:22023:%');
SELECT t_run('V108 g1 : démarrer une mission annulée refusé', :g1, $$SELECT public.delivery_agent_start_visit((SELECT v FROM t_ids WHERE k = 'v3'))$$, 'err:22023:%');
SELECT t_run('V109 après annulation, une nouvelle visite peut être programmée', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '4 day')$$, 'ok');
SELECT t_run('V110 admin : désactive g1 (sa mission non commencée est annulée)', :a, $$SELECT public.delivery_admin_set_field_agent('g1@test', 'Agent Un', NULL, false)$$, 'ok');
SELECT t_admin('V111 la mission de g1 est annulée', $$SELECT count(*)::text FROM public.delivery_field_visits WHERE agent_id = '0c0c0c0c-0000-0000-0000-00000000000c' AND status = 'cancelled' AND cancelled_reason = 'Agent désactivé'$$, '1');
SELECT t_run('V112 g1 désactivé : missions refusées', :g1, $$SELECT public.delivery_agent_my_visits()$$, 'err:42501:%');
SELECT t_run('V113 g1 désactivé ne peut plus être désigné pour une visite', :a,
  $$SELECT public.delivery_admin_schedule_visit((SELECT v FROM t_ids WHERE k = 'dB'), '0c0c0c0c-0000-0000-0000-00000000000c', now() + interval '4 day')$$, 'err:22023:%');

-- ===============================================================================================================
-- Droits sur les tables, stockage
-- ===============================================================================================================
SELECT t_val('V120 un agent ne lit aucune table directement (visites)', :g3, $$SELECT count(*)::text FROM public.delivery_field_visits$$, '0');
SELECT t_val('V121 un agent ne lit pas la table des agents', :g3, $$SELECT count(*)::text FROM public.delivery_field_agents$$, '0');
SELECT t_val('V122 un propriétaire ne lit pas les visites', :d4, $$SELECT count(*)::text FROM public.delivery_field_visits$$, '0');
SELECT t_val('V123 l''administrateur lit les visites', :a, $$SELECT (count(*) >= 3)::text FROM public.delivery_field_visits$$, 'true');
SELECT t_run('V124 un agent ne peut pas écrire dans les visites', :g3, $$UPDATE public.delivery_field_visits SET outcome = 'passed'$$, 'err:42501:%');
SELECT t_run('V125 un agent ne peut pas insérer une visite', :g3,
  $$INSERT INTO public.delivery_field_visits (company_id, agent_id, scheduled_for) VALUES ((SELECT v FROM t_ids WHERE k = 'dB'), '0e0e0e0e-0000-0000-0000-00000000000e', now())$$, 'err:42501:%');
SELECT t_run('V126 un agent ne modifie pas le réglage', :g3, $$UPDATE public.delivery_settings SET value = 'false'$$, 'err:42501:%');
SELECT t_run('V127 anonyme : tables fermées', NULL, $$SELECT count(*) FROM public.delivery_field_visits$$, 'err:42501:%', 'anon');

SELECT t_admin('V130 bucket delivery-visits : privé, 10 Mo, images seulement',
  $$SELECT public::text || '/' || file_size_limit || '/' || (allowed_mime_types @> ARRAY['image/jpeg'] AND NOT allowed_mime_types @> ARRAY['application/pdf'])::text FROM storage.buckets WHERE id = 'delivery-visits'$$, 'false/10485760/true');
SELECT t_run('V131 g3 (agent actif) : dépôt dans son dossier', :g3, $$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-visits', '0e0e0e0e-0000-0000-0000-00000000000e/a.jpg')$$, 'ok');
SELECT t_run('V132 g3 : dépôt dans le dossier d''un autre refusé', :g3, $$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-visits', '0c0c0c0c-0000-0000-0000-00000000000c/a.jpg')$$, 'err:42501:%');
SELECT t_run('V133 g2 (pas agent) : dépôt refusé même dans son dossier', :g2, $$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-visits', '0d0d0d0d-0000-0000-0000-00000000000d/a.jpg')$$, 'err:42501:%');
SELECT t_run('V134 g1 désactivé : dépôt refusé', :g1, $$INSERT INTO storage.objects (bucket_id, name) VALUES ('delivery-visits', '0c0c0c0c-0000-0000-0000-00000000000c/a.jpg')$$, 'err:42501:%');
SELECT t_val('V135 g3 lit sa photo ; g2 ne lit rien', :g2, $$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'delivery-visits'$$, '0');
SELECT t_val('V136 l''administrateur lit les photos de visite', :a, $$SELECT (count(*) >= 1)::text FROM storage.objects WHERE bucket_id = 'delivery-visits'$$, 'true');
SELECT t_val('V137 le propriétaire de la structure ne lit pas les photos de visite', :d4, $$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'delivery-visits'$$, '0');

SELECT t_admin('V140 fonctions admin/agent non exécutables par anon',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_agent_my_visits()', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_admin_schedule_visit(uuid,uuid,timestamptz,text)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_visit_audit(uuid,text,text,text,jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_notify_admins_to(uuid,text,text,text,text,text)', 'EXECUTE'))::text$$, 'true');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
