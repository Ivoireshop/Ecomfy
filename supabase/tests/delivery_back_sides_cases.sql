-- Cas de test de 20261109110000_delivery_back_sides_and_location.sql : verso des pièces, localisation de l'entrepôt,
-- confidentialité des coordonnées, garde à l'approbation, resoumission, motif « verso manquant ».
--
-- À jouer APRÈS delivery_kyc_cases.sql (il réutilise ses utilisateurs, ses aides t_* et ses résultats cumulés), sur la
-- même base JETABLE. Ordre complet : voir l'en-tête de delivery_kyc.sql, en ajoutant la migration
-- 20261109110000_delivery_back_sides_and_location.sql avant delivery_kyc_cases.sql puis ce fichier à la fin.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('06060606-0000-0000-0000-000000000006', 'o5@test'), ('07070707-0000-0000-0000-000000000007', 'o6@test');
\set o5 '''06060606-0000-0000-0000-000000000006'''
\set o6 '''07070707-0000-0000-0000-000000000007'''

-- ===============================================================================================================
-- C. Inscription : verso et localisation
-- ===============================================================================================================
SELECT t_run('120 o6 : gérant sans verso de la CNI refusé', :o6,
  t_register(:o6, t_company(:o6, 'Sans Verso', 'CI 9001 0001') #- '{company,manager_id_back_photo_url}'), 'err:22023:%verso de la pièce d''identité%');
SELECT t_run('121 o6 : gérant sans localisation refusé', :o6,
  t_register(:o6, t_company(:o6, 'Sans Loc', 'CI 9001 0002') #- '{company,warehouse_latitude}' #- '{company,warehouse_longitude}'), 'err:22023:%localisation de l''entrepôt est requise%');
SELECT t_run('122 o6 : latitude seule refusée', :o6,
  t_register(:o6, t_company(:o6, 'Lat seule', 'CI 9001 0003') #- '{company,warehouse_longitude}'), 'err:22023:%incomplète%');
SELECT t_run('123 o6 : latitude hors limites (95) refusée', :o6,
  t_register(:o6, jsonb_set(t_company(:o6, 'Lat 95', 'CI 9001 0004'), '{company,warehouse_latitude}', '95')), 'err:22023:%invalide%');
SELECT t_run('124 o6 : point (0, 0) refusé', :o6,
  t_register(:o6, jsonb_set(jsonb_set(t_company(:o6, 'Zero', 'CI 9001 0005'), '{company,warehouse_latitude}', '0'), '{company,warehouse_longitude}', '0')), 'err:22023:%invalide%');
SELECT t_run('125 o6 : livreur sans verso de la CNI refusé', :o6,
  t_register(:o6, t_company(:o6, 'Moto nv', 'CI 9001 0006', 'driver',
    jsonb_build_array(t_driver(:o6, 'motorcycle', ARRAY['A'], current_date + 400) - 'national_id_back_photo_url'))), 'err:22023:%verso de la pièce d''identité%');
SELECT t_run('126 o6 : livreur sans verso du permis refusé', :o6,
  t_register(:o6, t_company(:o6, 'Moto lv', 'CI 9001 0007', 'driver',
    jsonb_build_array(t_driver(:o6, 'motorcycle', ARRAY['A'], current_date + 400) - 'license_back_photo_url'))), 'err:22023:%verso du permis%');
SELECT t_run('127 o6 : passeport sans verso accepté (une seule page)', :o6,
  t_register(:o6, jsonb_set(t_company(:o6, 'Passeport Co', 'PP 123456') #- '{company,manager_id_back_photo_url}', '{kyc,id_type}', '"passport"')), 'ok');
SELECT t_admin('128 o6 : dossier créé sans verso, avec sa localisation GPS',
  $$SELECT (c.manager_id_back_photo_url IS NULL)::text || '/' || l.source || '/' || l.accuracy_m
      FROM public.delivery_companies c JOIN public.delivery_company_location l ON l.company_id = c.id
     WHERE c.user_id = '07070707-0000-0000-0000-000000000007'$$, 'true/gps/12');
SELECT t_run('129 o5 : inscription valide (verso + localisation)', :o5, t_register(:o5, t_company(:o5, 'Verso Express', 'CI 9002 0001')), 'ok');
INSERT INTO t_ids SELECT 'c5', id FROM public.delivery_companies WHERE user_id = '06060606-0000-0000-0000-000000000006';
SELECT t_admin('130 c5 : verso et localisation enregistrés, localisation journalisée une fois',
  $$SELECT (c.manager_id_back_photo_url IS NOT NULL)::text || '/' || round(l.latitude::numeric, 4) || '/' ||
           (SELECT count(*) FROM public.delivery_verification_audit WHERE action = 'location_recorded' AND company_id = c.id)
      FROM public.delivery_companies c JOIN public.delivery_company_location l ON l.company_id = c.id WHERE c.id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'true/5.3364/1');

-- ===============================================================================================================
-- D. Confidentialité des coordonnées de l'entrepôt
-- ===============================================================================================================
SELECT t_val('131 o4 (tiers) ne lit aucune localisation, même celle de c1 approuvée et visible de l''annuaire', :o4,
  'SELECT count(*)::text FROM public.delivery_company_location', '0');
SELECT t_val('132 o5 lit uniquement sa propre localisation', :o5, 'SELECT count(*)::text FROM public.delivery_company_location', '1');
SELECT t_val('133 admin lit toutes les localisations', :a, 'SELECT (count(*) >= 3)::text FROM public.delivery_company_location', 'true');
SELECT t_run('134 anonyme : lecture refusée', NULL, 'SELECT * FROM public.delivery_company_location', 'err:42501:%', 'anon');
SELECT t_run('135 o4 : ne peut pas poser une localisation sur le dossier de c5', :o4,
  $$INSERT INTO public.delivery_company_location (company_id, latitude, longitude) VALUES ((SELECT v FROM t_ids WHERE k = 'c5'), 5.3, -4.0)$$, 'err:42501:%');
SELECT t_run('136 o4 : ne peut pas modifier la localisation de c5', :o4,
  $$UPDATE public.delivery_company_location SET latitude = 6 WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'ok');
SELECT t_admin('137 …et rien n''a changé (aucune ligne visible)',
  $$SELECT round(latitude::numeric, 4)::text FROM public.delivery_company_location WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5')$$, '5.3364');
SELECT t_run('138 o5 : verso d''un autre utilisateur refusé', :o5,
  $$UPDATE public.delivery_companies SET manager_id_back_photo_url = '01010101-0000-0000-0000-000000000001/back.jpg' WHERE user_id = auth.uid()$$, 'err:22023:%Document invalide%');
SELECT t_run('139 o5 : verso en URL refusé', :o5,
  $$UPDATE public.delivery_companies SET manager_id_back_photo_url = 'https://evil/back.jpg' WHERE user_id = auth.uid()$$, 'err:22023:%Document invalide%');

-- ===============================================================================================================
-- E. Dossier ancien (sans verso ni localisation) : approbation refusée, complément, resoumission
-- ===============================================================================================================
-- Simule un dossier déposé AVANT cette migration (écriture en superutilisateur = chemin privilégié).
UPDATE public.delivery_companies SET manager_id_back_photo_url = NULL WHERE id = (SELECT v FROM t_ids WHERE k = 'c5');
DELETE FROM public.delivery_company_location WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5');

SELECT t_run('140 admin : approbation d''un dossier sans verso ni localisation refusée', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'c5'), 'approved')$$, 'err:23514:%Verso de la pièce%Localisation de l''entrepôt%');
SELECT t_admin('141 …le dossier reste en attente, sans badge',
  $$SELECT verification_status::text || '/' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'pending_verification/false');
SELECT t_run('142 admin : refus motivé « verso manquant » accepté', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'c5'), 'rejected', 'MISSING_BACK_SIDE', 'Importez le verso de votre pièce d''identité.')$$, 'ok');
SELECT t_admin('143 …code enregistré', $$SELECT rejection_reason_code FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'MISSING_BACK_SIDE');
SELECT t_run('144 admin : demande de complément (verso + localisation)', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'c5'), 'action_required', NULL, NULL, 'Merci d''importer le verso de votre CNI et la localisation de votre entrepôt.')$$, 'ok');
SELECT t_val('145 o5 voit le motif du complément', :o5,
  $$SELECT reviewer_comments FROM public.delivery_companies WHERE user_id = auth.uid()$$, '%verso de votre CNI%');
SELECT t_run('146 o5 : resoumission sans verso refusée', :o5,
  $$SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = 'c5'))$$, 'err:22023:%verso de la pièce d''identité%');
SELECT t_run('147 o5 : resoumission avec verso mais sans localisation refusée', :o5,
  $$SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = 'c5'), '{"manager_id_back_photo_url":"06060606-0000-0000-0000-000000000006/back.jpg"}'::jsonb)$$, 'err:22023:%localisation de l''entrepôt est requise%');
SELECT t_run('148 o5 : resoumission avec une latitude invalide refusée', :o5,
  $$SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = 'c5'), '{"manager_id_back_photo_url":"06060606-0000-0000-0000-000000000006/back.jpg","warehouse_latitude":120,"warehouse_longitude":-4}'::jsonb)$$, 'err:22023:%invalide%');
SELECT t_run('149 o5 : resoumission avec verso et localisation acceptée', :o5,
  $$SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = 'c5'),
      '{"manager_id_back_photo_url":"06060606-0000-0000-0000-000000000006/back.jpg","warehouse_latitude":5.3501,"warehouse_longitude":-3.9902,"warehouse_accuracy_m":8,"warehouse_location_source":"map"}'::jsonb)$$, 'ok');
SELECT t_admin('150 …dossier en attente, verso et localisation (source carte) enregistrés',
  $$SELECT c.verification_status::text || '/' || (c.manager_id_back_photo_url IS NOT NULL) || '/' || l.source || '/' || round(l.longitude::numeric, 4)
      FROM public.delivery_companies c JOIN public.delivery_company_location l ON l.company_id = c.id WHERE c.id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'pending_verification/true/map/-3.9902');
SELECT t_admin('151 …audit : « resubmitted » et « location_recorded » (depuis le dossier sans localisation)',
  $$SELECT (SELECT count(*) FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5') AND action = 'resubmitted')::text || '/' ||
           (SELECT count(*) FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5') AND action = 'location_recorded')$$, '1/2');
SELECT t_run('152 admin : approuve c5 (verso et localisation présents)', :a,
  $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'c5'), 'approved')$$, 'ok');
SELECT t_admin('153 …approuvée avec badge', $$SELECT verification_status::text || '/' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'approved/true');

-- Dossier approuvé : un nouveau verso déclenche une nouvelle vérification ; déplacer l'entrepôt est journalisé.
SELECT t_run('154 o5 (approuvé) : remplace son verso', :o5,
  $$UPDATE public.delivery_companies SET manager_id_back_photo_url = '06060606-0000-0000-0000-000000000006/back2.jpg' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_admin('155 …badge retiré, nouvelle vérification, audit « documents_updated »',
  $$SELECT c.verification_status::text || '/' || c.trust_badge_active || '/' ||
           (SELECT count(*) FROM public.delivery_verification_audit WHERE company_id = c.id AND action = 'documents_updated' AND details -> 'changed' ? 'manager_id_back_photo_url')
      FROM public.delivery_companies c WHERE c.id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'pending_verification/false/2');
SELECT t_run('156 admin : ré-approuve c5', :a, $$SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = 'c5'), 'approved')$$, 'ok');
SELECT t_run('157 o5 (approuvé) : déplace son entrepôt', :o5,
  $$UPDATE public.delivery_company_location SET latitude = 5.4000, longitude = -4.0500, source = 'gps' WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'ok');
SELECT t_admin('158 …reste approuvée ; le déplacement est journalisé',
  $$SELECT c.verification_status::text || '/' || (SELECT count(*) FROM public.delivery_verification_audit WHERE company_id = c.id AND action = 'location_updated')
      FROM public.delivery_companies c WHERE c.id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'approved/1');
SELECT t_run('159 o5 : coordonnées hors limites refusées par la base', :o5,
  $$UPDATE public.delivery_company_location SET latitude = 200 WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c5')$$, 'err:23514:%');

-- ===============================================================================================================
-- F. Livreurs : verso de la pièce et du permis, refus « verso manquant », correction par le propriétaire
-- ===============================================================================================================
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry,
                                     photo_url, national_id_photo_url, license_photo_url, license_number)
  VALUES ((SELECT v FROM t_ids WHERE k = 'c5'), 'Sans Versos', 'Sans', 'Versos', '1', 'motorcycle', ARRAY['A'], current_date + 300, 'p', 'i', 'l', 'PC-V1');
SELECT t_run('160 admin : approbation d''un livreur sans verso (pièce et permis) refusée', :a,
  $$SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = 'Sans Versos'), 'approved')$$, 'err:23514:%Verso de la pièce%Verso du permis%');
SELECT t_run('161 admin : refus « verso manquant » du livreur', :a,
  $$SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = 'Sans Versos'), 'rejected', 'MISSING_BACK_SIDE', 'Importez le verso de la pièce et du permis.')$$, 'ok');
SELECT t_run('162 o5 : verso d''un autre utilisateur refusé sur son livreur', :o5,
  $$UPDATE public.delivery_drivers SET national_id_back_photo_url = '01010101-0000-0000-0000-000000000001/x.jpg' WHERE full_name = 'Sans Versos'$$, 'err:22023:%Document invalide%');
SELECT t_run('163 o5 : dépose les deux versos de son livreur', :o5,
  $$UPDATE public.delivery_drivers SET national_id_back_photo_url = '06060606-0000-0000-0000-000000000006/d_id_back.jpg',
                                       license_back_photo_url = '06060606-0000-0000-0000-000000000006/d_lic_back.jpg' WHERE full_name = 'Sans Versos'$$, 'ok');
SELECT t_admin('164 …livreur repassé en attente, inactif, correction journalisée',
  $$SELECT d.verification_status || '/' || d.is_active || '/' ||
           (SELECT count(*) FROM public.delivery_verification_audit WHERE driver_id = d.id AND action = 'driver_documents_updated' AND details -> 'changed' ? 'license_back_photo_url')
      FROM public.delivery_drivers d WHERE d.full_name = 'Sans Versos'$$, 'pending/false/1');
SELECT t_run('165 admin : approuve le livreur (versos présents)', :a,
  $$SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = 'Sans Versos'), 'approved')$$, 'ok');

-- Livreur à passeport : pas de verso de pièce, mais le verso du permis reste exigé.
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry,
                                     photo_url, national_id_photo_url, license_photo_url, license_number, id_type)
  VALUES ((SELECT v FROM t_ids WHERE k = 'c5'), 'Passeport Drv', 'Pass', 'Port', '1', 'motorcycle', ARRAY['A'], current_date + 300, 'p', 'i', 'l', 'PC-V2', 'passport');
SELECT t_run('166 admin : livreur à passeport sans verso du permis refusé', :a,
  $$SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = 'Passeport Drv'), 'approved')$$, 'err:23514:%Verso du permis%');
UPDATE public.delivery_drivers SET license_back_photo_url = 'x/lic_back.jpg' WHERE full_name = 'Passeport Drv';
SELECT t_run('167 admin : livreur à passeport avec verso du permis approuvé (aucun verso de pièce requis)', :a,
  $$SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = 'Passeport Drv'), 'approved')$$, 'ok');

-- Resoumission d'un livreur indépendant : les deux versos sont exigés sur l'état final.
SELECT t_run('168 o6 (passeport) : resoumission d''un gérant sans verso acceptée', :o6,
  $$SELECT public.resubmit_delivery_application((SELECT id FROM public.delivery_companies WHERE user_id = auth.uid()))$$, 'ok');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
