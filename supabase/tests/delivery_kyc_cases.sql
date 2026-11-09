-- Cas de test de 20261106110000_delivery_kyc_audit_notifications.sql (après le socle et les quatre migrations).
-- Chaque cas s'exécute sous le rôle `authenticated` avec l'identité indiquée, comme PostgREST.
\set ON_ERROR_STOP on

-- Utilisateurs : a = administrateur, f = fondateur, o1..o4 = candidats, s = boutique, x = tiers.
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test'), ('ffffffff-0000-0000-0000-000000000001', 'founder@test'),
  ('01010101-0000-0000-0000-000000000001', 'o1@test'), ('02020202-0000-0000-0000-000000000002', 'o2@test'),
  ('03030303-0000-0000-0000-000000000003', 'o3@test'), ('04040404-0000-0000-0000-000000000004', 'o4@test'),
  ('05050505-0000-0000-0000-000000000005', 's@test'), ('99999999-0000-0000-0000-000000000009', 'x@test');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'), ('ffffffff-0000-0000-0000-000000000001', 'founder');
INSERT INTO public.shops VALUES ('5a000000-0000-0000-0000-000000000001', '05050505-0000-0000-0000-000000000005');

CREATE TABLE t_res (n serial, test text, expected text, observed text, pass boolean);
CREATE TABLE t_ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON t_res, t_ids TO authenticated, anon;

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

-- Dossier valide : responsable + (option) livreur. Les chemins commencent par l'identifiant de l'appelant.
CREATE FUNCTION t_company(p_uid uuid, p_name text, p_idnum text, p_type text DEFAULT 'manager', p_drivers jsonb DEFAULT '[]'::jsonb,
                          p_dob text DEFAULT '1990-05-04', p_id_photo text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'company', jsonb_build_object('profile_type', p_type, 'company_name', p_name, 'city', 'Abidjan', 'country', 'Côte d''Ivoire', 'country_code', 'CI',
      'headquarters_address', 'Marcory', 'manager_first_name', 'Jean', 'manager_last_name', 'Kouassi', 'manager_phone', '+2250700000000',
      'manager_id_photo_url', COALESCE(p_id_photo, p_uid::text || '/id.jpg'), 'manager_id_back_photo_url', p_uid::text || '/id_back.jpg',
      'manager_selfie_with_id_url', p_uid::text || '/selfie.jpg',
      'warehouse_photo_url', CASE WHEN p_type = 'manager' THEN p_uid::text || '/wh.jpg' ELSE NULL END,
      'warehouse_latitude', CASE WHEN p_type = 'manager' THEN 5.3364 ELSE NULL END,
      'warehouse_longitude', CASE WHEN p_type = 'manager' THEN -4.0267 ELSE NULL END,
      'warehouse_accuracy_m', CASE WHEN p_type = 'manager' THEN 12 ELSE NULL END,
      'warehouse_location_source', CASE WHEN p_type = 'manager' THEN 'gps' ELSE NULL END),
    'kyc', jsonb_build_object('id_type', 'cni', 'id_number', p_idnum, 'id_expiry', (current_date + 1000)::text, 'date_of_birth', p_dob),
    'hubs', jsonb_build_array(jsonb_build_object('city', 'Abidjan', 'address', 'Marcory')),
    'drivers', p_drivers);
$$;

CREATE FUNCTION t_driver(p_uid uuid, p_vehicle text, p_cats text[], p_lic_exp date, p_lic_no text DEFAULT 'PC-1001') RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('first_name', 'Koffi', 'last_name', 'Yao', 'phone', '+2250100000000', 'date_of_birth', '1992-02-02',
    'vehicle_type', p_vehicle, 'license_number', p_lic_no, 'license_categories', to_jsonb(p_cats), 'license_expiry', p_lic_exp::text,
    'id_expiry', (current_date + 900)::text, 'national_id_photo_url', p_uid::text || '/d_id.jpg',
    'national_id_back_photo_url', p_uid::text || '/d_id_back.jpg', 'license_back_photo_url', p_uid::text || '/d_lic_back.jpg',
    'license_photo_url', p_uid::text || '/d_lic.jpg', 'selfie_with_id_url', p_uid::text || '/d_self.jpg');
$$;

CREATE FUNCTION t_register(p_uid uuid, p_payload jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT format($f$ SELECT public.register_delivery_application(%L::jsonb, %L::jsonb, %L::jsonb, %L::jsonb) $f$,
                p_payload -> 'company', p_payload -> 'kyc', p_payload -> 'hubs', p_payload -> 'drivers');
$$;

\set a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set f '''ffffffff-0000-0000-0000-000000000001'''
\set o1 '''01010101-0000-0000-0000-000000000001'''
\set o2 '''02020202-0000-0000-0000-000000000002'''
\set o3 '''03030303-0000-0000-0000-000000000003'''
\set o4 '''04040404-0000-0000-0000-000000000004'''
\set s '''05050505-0000-0000-0000-000000000005'''
\set x '''99999999-0000-0000-0000-000000000009'''

-- ===============================================================================================================
-- A. Inscription et validations serveur
-- ===============================================================================================================
SELECT t_run('01 o1 : inscription gérant valide', :o1, t_register(:o1, t_company(:o1, 'Express Logistics', 'CI 0012 3456')), 'ok');
INSERT INTO t_ids SELECT 'c1', id FROM public.delivery_companies WHERE user_id = '01010101-0000-0000-0000-000000000001';

SELECT t_run('02 o1 : second dossier refusé', :o1, t_register(:o1, t_company(:o1, 'Bis', 'CI 7777 7777')), 'err:23505:%déjà un dossier%');

SELECT t_run('03 o2 : pièce = URL blob: refusée', :o2, t_register(:o2, t_company(:o2, 'Blob Co', 'CI 1111 1111', 'manager', '[]', '1990-05-04', 'blob:http://localhost/abc')), 'err:22023:%Document invalide%');
SELECT t_run('04 o2 : chemin d''un autre utilisateur refusé', :o2, t_register(:o2, t_company(:o2, 'Vol Co', 'CI 2222 2222', 'manager', '[]', '1990-05-04', '01010101-0000-0000-0000-000000000001/id.jpg')), 'err:22023:%Document invalide%');
SELECT t_run('05 o2 : responsable mineur refusé', :o2, t_register(:o2, t_company(:o2, 'Mineur Co', 'CI 3333 3333', 'manager', '[]', (current_date - interval '15 years')::date::text)), 'err:23514:%majeur%');

SELECT t_run('06 o3 : moto avec permis B refusé (règle permis A/B)', :o3,
  t_register(:o3, t_company(:o3, 'Moto B', 'CI 4444 4444', 'driver', jsonb_build_array(t_driver(:o3, 'motorcycle', ARRAY['B'], current_date + 400)))), 'err:23514:%catégorie A requise pour Moto%');
SELECT t_run('07 o3 : permis expiré refusé', :o3,
  t_register(:o3, t_company(:o3, 'Moto exp', 'CI 4444 4444', 'driver', jsonb_build_array(t_driver(:o3, 'motorcycle', ARRAY['A'], current_date - 1)))), 'err:23514:%Permis expiré%');
SELECT t_run('08 o3 : aucune catégorie refusée', :o3,
  t_register(:o3, t_company(:o3, 'Moto vide', 'CI 4444 4444', 'driver', jsonb_build_array(t_driver(:o3, 'motorcycle', ARRAY[]::text[], current_date + 400)))), 'err:23514:%Aucune catégorie%');
SELECT t_run('09 o3 : gérant-livreur moto avec permis A accepté', :o3,
  t_register(:o3, t_company(:o3, 'Koffi Express', 'CI 5555 5555', 'driver', jsonb_build_array(t_driver(:o3, 'motorcycle', ARRAY['A'], current_date + 400)))), 'ok');
INSERT INTO t_ids SELECT 'c3', id FROM public.delivery_companies WHERE user_id = '03030303-0000-0000-0000-000000000003';

SELECT t_run('10 o4 : même pièce que o1 (casse et espaces différents) refusée', :o4, t_register(:o4, t_company(:o4, 'Doublon', 'ci00123456')), 'err:23505:%déjà associée%');
SELECT t_run('11 o2 : inscription valide', :o2, t_register(:o2, t_company(:o2, 'Rapid CI', 'CI 8888 8888')), 'ok');
INSERT INTO t_ids SELECT 'c2', id FROM public.delivery_companies WHERE user_id = '02020202-0000-0000-0000-000000000002';

SELECT t_admin('12 c1 : en attente, sans badge, propriétaire = o1',
  'SELECT verification_status::text || ''/'' || trust_badge_active || ''/'' || (user_id = ''01010101-0000-0000-0000-000000000001'') FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'')', 'pending_verification/false/true');
SELECT t_admin('13 livreur de c3 : en attente et inactif',
  'SELECT verification_status || ''/'' || is_active FROM public.delivery_drivers WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c3'')', 'pending/false');
SELECT t_admin('14 audit : « submitted » pour c1 et « driver_added » pour c3',
  'SELECT (SELECT count(*) FROM public.delivery_verification_audit WHERE action = ''submitted'')::text || ''/'' || (SELECT count(*) FROM public.delivery_verification_audit WHERE action = ''driver_added'')', '3/1');
SELECT t_admin('15 notifications : chaque administrateur est prévenu de chaque dossier (3 dossiers x 2 admins)',
  'SELECT count(*)::text FROM public.delivery_notifications WHERE kind = ''submitted''', '6');

-- ===============================================================================================================
-- B. Pas d'auto-validation, pas d'accès croisé
-- ===============================================================================================================
SELECT t_run('16 o1 : s''approuver lui-même refusé', :o1, 'UPDATE public.delivery_companies SET verification_status = ''approved'' WHERE user_id = auth.uid()', 'err:42501:%réservé aux administrateurs%');
SELECT t_run('17 o1 : s''attribuer le badge refusé', :o1, 'UPDATE public.delivery_companies SET trust_badge_active = true WHERE user_id = auth.uid()', 'err:42501:%');
SELECT t_run('18 o1 : écrire un message de l''équipe refusé', :o1, 'UPDATE public.delivery_companies SET reviewer_comments = ''ok'' WHERE user_id = auth.uid()', 'err:42501:%');
SELECT t_run('19 o1 : changer de propriétaire refusé', :o1, 'UPDATE public.delivery_companies SET user_id = ''99999999-0000-0000-0000-000000000009'' WHERE user_id = auth.uid()', 'err:42501:%');
SELECT t_run('20 o3 : activer son livreur lui-même refusé (invariant)', :o3, 'UPDATE public.delivery_drivers SET is_active = true WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c3'')', 'err:23514:%approuvé%');
SELECT t_run('21 o3 : approuver son livreur refusé', :o3, 'UPDATE public.delivery_drivers SET verification_status = ''approved'' WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c3'')', 'err:42501:%');
SELECT t_run('22 o3 : insérer un livreur déjà « approuvé et actif » : forcé en attente', :o3,
  'INSERT INTO public.delivery_drivers (company_id, full_name, phone, photo_url, national_id_photo_url, is_active, verification_status, vehicle_type, license_categories, license_expiry)
   VALUES ((SELECT v FROM t_ids WHERE k = ''c3''), ''Faux'', ''1'', ''03030303-0000-0000-0000-000000000003/p.jpg'', ''03030303-0000-0000-0000-000000000003/i.jpg'', true, ''approved'', ''motorcycle'', ARRAY[''A''], current_date + 300)', 'ok');
SELECT t_admin('23 …le livreur « Faux » est en attente et inactif',
  'SELECT verification_status || ''/'' || is_active FROM public.delivery_drivers WHERE full_name = ''Faux''', 'pending/false');
SELECT t_run('24 o3 : livreur avec une URL au lieu d''un fichier refusé', :o3,
  'INSERT INTO public.delivery_drivers (company_id, full_name, phone, photo_url, national_id_photo_url) VALUES ((SELECT v FROM t_ids WHERE k = ''c3''), ''Url'', ''1'', ''https://x/y.jpg'', ''https://x/z.jpg'')', 'err:22023:%');

SELECT t_val('25 o2 : ne voit pas le dossier c1 (non approuvé)', :o2, 'SELECT count(*)::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'')', '0');
SELECT t_val('26 o2 : ne voit aucun livreur d''un autre dossier (ex-trou « tout connecté »)', :o2, 'SELECT count(*)::text FROM public.delivery_drivers', '0');
SELECT t_val('27 o2 : ne voit pas l''identité de c1', :o2, 'SELECT count(*)::text FROM public.delivery_company_kyc WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c1'')', '0');
SELECT t_val('28 o2 : ne modifie pas le dossier de c1 (0 ligne)', :o2, 'WITH u AS (UPDATE public.delivery_companies SET city = ''Pirate'' WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'') RETURNING 1) SELECT count(*)::text FROM u', '0');
SELECT t_run('29 o2 : insérer un livreur chez c1 refusé', :o2,
  'INSERT INTO public.delivery_drivers (company_id, full_name, phone, photo_url, national_id_photo_url, license_categories, license_expiry) VALUES ((SELECT v FROM t_ids WHERE k = ''c1''), ''Intrus'', ''1'', ''02020202-0000-0000-0000-000000000002/p'', ''02020202-0000-0000-0000-000000000002/i'', ARRAY[''A''], current_date + 100)', 'err:42501:%');
SELECT t_val('30 anonyme : ne lit aucune structure', NULL, 'SELECT count(*)::text FROM public.delivery_companies', 'err:42501:%', 'anon');
SELECT t_val('31 o1 lit sa propre identité (KYC)', :o1, 'SELECT count(*)::text FROM public.delivery_company_kyc', '1');

-- ===============================================================================================================
-- C. Décisions des administrateurs
-- ===============================================================================================================
SELECT t_run('32 o1 : appeler la décision administrateur refusé', :o1, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c1''), ''approved'')', 'err:42501:%');
SELECT t_run('33 admin : refus sans code de motif', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c2''), ''rejected'', NULL, ''flou'')', 'err:22023:%');
SELECT t_run('34 admin : complément sans message', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c2''), ''action_required'')', 'err:22023:%');
SELECT t_run('35 admin : décision inconnue', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c2''), ''maybe'')', 'err:22023:%');

SELECT t_run('36 admin : refuse c2 avec code et motif, note interne', :a,
  'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c2''), ''rejected'', ''NAME_MISMATCH'', ''Le nom ne correspond pas à la pièce.'', NULL, ''Vu avec Awa, suspicion de prête-nom'')', 'ok');
SELECT t_admin('37 c2 refusée, badge retiré, code enregistré',
  'SELECT verification_status::text || ''/'' || trust_badge_active || ''/'' || rejection_reason_code FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c2'')', 'rejected/false/NAME_MISMATCH');
SELECT t_val('38 o2 voit son motif de refus dans le journal', :o2,
  'SELECT string_agg(action || ''='' || COALESCE(reason, ''-''), '';'' ORDER BY created_at) FROM public.delivery_verification_audit WHERE action = ''status_changed''', 'status_changed=Le nom ne correspond pas à la pièce.');
SELECT t_val('39 o2 ne voit PAS la note interne (journal)', :o2, 'SELECT count(*)::text FROM public.delivery_verification_audit WHERE action = ''note_added''', '0');
SELECT t_val('40 admin voit la note interne (journal)', :a, 'SELECT count(*)::text FROM public.delivery_verification_audit WHERE action = ''note_added''', '1');
SELECT t_val('41 o2 ne lit pas le registre des notes internes', :o2, 'SELECT count(*)::text FROM public.delivery_company_review_notes', '0');
SELECT t_val('42 admin lit le registre des notes internes', :a, 'SELECT internal_note FROM public.delivery_company_review_notes', 'Vu avec Awa%');
SELECT t_val('43 o2 reçoit la notification de refus (ton erreur)', :o2, 'SELECT title || ''/'' || tone FROM public.delivery_notifications WHERE kind = ''company_rejected''', 'Dossier refusé/error');
SELECT t_val('44 o1 ne voit pas la notification de o2', :o1, 'SELECT count(*)::text FROM public.delivery_notifications WHERE kind = ''company_rejected''', '0');

SELECT t_run('45 o2 : resoumission avec de nouveaux documents', :o2,
  'SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = ''c2''), ''{"manager_id_photo_url":"02020202-0000-0000-0000-000000000002/id2.jpg"}''::jsonb)', 'ok');
SELECT t_admin('46 c2 de nouveau en attente ; audit « resubmitted » ; admins prévenus',
  'SELECT (SELECT verification_status::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c2'')) || ''/'' ||
          (SELECT count(*) FROM public.delivery_verification_audit WHERE action = ''resubmitted'') || ''/'' ||
          (SELECT count(*) FROM public.delivery_notifications WHERE kind = ''resubmitted'')', 'pending_verification/1/2');
SELECT t_run('47 o2 : resoumission avec une URL refusée', :o2,
  'SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = ''c2''), ''{"manager_id_photo_url":"https://evil/x.jpg"}''::jsonb)', 'err:22023:%');

-- Livreur incompatible créé en direct (le serveur doit refuser l'approbation)
SELECT t_run('48 o1 : ajoute un livreur moto avec permis B : refusé dès la saisie', :o1,
  'INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, photo_url, national_id_photo_url, license_photo_url)
   VALUES ((SELECT v FROM t_ids WHERE k = ''c1''), ''Ali Bamba'', ''Ali'', ''Bamba'', ''1'', ''motorcycle'', ARRAY[''b''], current_date + 300,
           ''01010101-0000-0000-0000-000000000001/p'', ''01010101-0000-0000-0000-000000000001/i'', ''01010101-0000-0000-0000-000000000001/l'')', 'err:23514:%catégorie A requise%');
SELECT t_run('48b o1 : même livreur avec un permis A et des minuscules : accepté', :o1,
  'INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, photo_url, national_id_photo_url, license_photo_url)
   VALUES ((SELECT v FROM t_ids WHERE k = ''c1''), ''Ali Bamba'', ''Ali'', ''Bamba'', ''1'', ''motorcycle'', ARRAY[''a''], current_date + 300,
           ''01010101-0000-0000-0000-000000000001/p'', ''01010101-0000-0000-0000-000000000001/i'', ''01010101-0000-0000-0000-000000000001/l'')', 'ok');
SELECT t_admin('49 …catégories normalisées en majuscules', 'SELECT array_to_string(license_categories, '','') FROM public.delivery_drivers WHERE full_name = ''Ali Bamba''', 'A');
SELECT t_run('49b o1 : passer ce livreur en voiture avec le seul permis A : refusé', :o1,
  'UPDATE public.delivery_drivers SET vehicle_type = ''car'' WHERE full_name = ''Ali Bamba''', 'err:23514:%catégorie B requise pour Voiture%');
-- Ali : permis B sur une moto, créé par un administrateur (chemin privilégié) pour tester le refus à l'approbation
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, photo_url, national_id_photo_url, license_photo_url, license_number)
  VALUES ((SELECT v FROM t_ids WHERE k = 'c1'), 'Bako Incompatible', 'Bako', 'Incompatible', '1', 'motorcycle', ARRAY['B'], current_date + 300, 'p', 'i', 'l', 'PC-9');
SELECT t_run('50 admin : approbation du livreur moto/B refusée', :a,
  'SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = ''Bako Incompatible''), ''approved'')', 'err:23514:%catégorie A requise%');
SELECT t_run('51 admin : même un administrateur ne peut pas forcer is_active', :a,
  'UPDATE public.delivery_drivers SET is_active = true WHERE full_name = ''Bako Incompatible''', 'err:23514:%');

SELECT t_run('52 admin : approuve c1 (cascade livreurs) : le livreur non conforme est bloqué', :a,
  'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c1''), ''approved'', NULL, NULL, NULL, NULL, true)', 'ok');
SELECT t_admin('53 c1 approuvée, badge actif, vérifiée par l''admin, livreur non conforme resté en attente',
  'SELECT c.verification_status::text || ''/'' || c.trust_badge_active || ''/'' || (c.verified_by = ''aaaaaaaa-0000-0000-0000-000000000001'') || ''/'' || d.verification_status
     FROM public.delivery_companies c, public.delivery_drivers d WHERE c.id = (SELECT v FROM t_ids WHERE k = ''c1'') AND d.full_name = ''Bako Incompatible''', 'approved/true/true/pending');
SELECT t_val('54 o1 reçoit « Dossier approuvé »', :o1, 'SELECT title FROM public.delivery_notifications WHERE kind = ''company_approved''', 'Dossier approuvé');
SELECT t_run('55 admin : approuve c3 (gérant-livreur) avec cascade', :a,
  'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c3''), ''approved'', NULL, NULL, NULL, NULL, true)', 'ok');
SELECT t_admin('56 le livreur de c3 est approuvé et actif',
  'SELECT verification_status || ''/'' || is_active FROM public.delivery_drivers WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c3'') AND full_name = ''Koffi Yao''', 'approved/true');

SELECT t_admin('56b total_drivers_count de c3 = nombre de livreurs ACTIFS (1), celui de c1 = 0',
  $$SELECT (SELECT total_drivers_count FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c3'))::text || '/' ||
           (SELECT total_drivers_count FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c1'))::text$$, '1/0');

-- Annuaire des vendeurs
SELECT t_val('57 x (tiers connecté) : voit les structures approuvées (annuaire)', :x, 'SELECT count(*)::text FROM public.delivery_companies', '2');
SELECT t_val('58 …mais pas leur identité', :x, 'SELECT count(*)::text FROM public.delivery_company_kyc', '0');
SELECT t_val('59 …ni leurs livreurs', :x, 'SELECT count(*)::text FROM public.delivery_drivers', '0');
SELECT t_val('60 …et voit les hubs des structures approuvées seulement', :x, 'SELECT count(*)::text FROM public.delivery_hubs', '2');

-- ===============================================================================================================
-- D. Re-vérification automatique
-- ===============================================================================================================
SELECT t_run('61 o1 (approuvé) : change seulement ses villes couvertes', :o1, 'UPDATE public.delivery_companies SET covered_cities = ARRAY[''Abidjan'',''Bouaké''] WHERE user_id = auth.uid()', 'ok');
SELECT t_admin('62 …reste approuvé', 'SELECT verification_status::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'')', 'approved');
SELECT t_run('63 o1 (approuvé) : remplace sa pièce d''identité', :o1, 'UPDATE public.delivery_companies SET manager_id_photo_url = ''01010101-0000-0000-0000-000000000001/id_new.jpg'' WHERE user_id = auth.uid()', 'ok');
SELECT t_admin('64 …repasse en attente, badge retiré, audit « reverification_required », admins prévenus',
  'SELECT (SELECT verification_status::text || ''/'' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'')) || ''/'' ||
          (SELECT count(*) FROM public.delivery_verification_audit WHERE action = ''reverification_required'') || ''/'' ||
          (SELECT count(*) FROM public.delivery_notifications WHERE kind = ''reverification_required'')', 'pending_verification/false/1/2');
SELECT t_run('65 o1 : resoumettre depuis « en attente » ne casse rien', :o1, 'SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = ''c1''))', 'ok');
SELECT t_run('66 admin ré-approuve c1', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''c1''), ''approved'')', 'ok');
SELECT t_run('67 o1 : change son numéro de pièce (KYC)', :o1, 'UPDATE public.delivery_company_kyc SET id_number = ''CI 0012 9999'' WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c1'')', 'ok');
SELECT t_admin('68 …c1 repasse en attente', 'SELECT verification_status::text || ''/'' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = ''c1'')', 'pending_verification/false');
SELECT t_run('69 o1 : numéro de pièce déjà pris par un autre dossier refusé', :o1, 'UPDATE public.delivery_company_kyc SET id_number = ''CI 5555 5555'' WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c1'')', 'err:23505:%déjà associée%');
SELECT t_run('70 o3 : resoumission impossible depuis un dossier approuvé', :o3, 'SELECT public.resubmit_delivery_application((SELECT v FROM t_ids WHERE k = ''c3''))', 'err:42501:%');
SELECT t_run('71 o3 (livreur approuvé) : change la date d''expiration du permis', :o3,
  'UPDATE public.delivery_drivers SET license_expiry = current_date + 500 WHERE full_name = ''Koffi Yao''', 'ok');
SELECT t_admin('72 …le livreur est repassé en attente et inactif',
  'SELECT verification_status || ''/'' || is_active FROM public.delivery_drivers WHERE full_name = ''Koffi Yao''', 'pending/false');

-- ===============================================================================================================
-- E. Journal en ajout seul, notifications
-- ===============================================================================================================
SELECT t_run('73 journal : UPDATE refusé même au propriétaire de la base', NULL, 'UPDATE public.delivery_verification_audit SET reason = ''x''', 'err:42501:%ajout seul%', 'postgres');
SELECT t_run('74 journal : DELETE refusé', NULL, 'DELETE FROM public.delivery_verification_audit', 'err:42501:%ajout seul%', 'postgres');
SELECT t_run('75 journal : TRUNCATE refusé', NULL, 'TRUNCATE public.delivery_verification_audit', 'err:42501:%ajout seul%', 'postgres');
SELECT t_run('76 journal : insertion directe par un utilisateur refusée', :o1, 'INSERT INTO public.delivery_verification_audit (company_id, subject, action, actor_kind) VALUES (gen_random_uuid(), ''company'', ''fake'', ''admin'')', 'err:42501:%');
SELECT t_run('77 journal : écriture directe par un administrateur refusée aussi', :a, 'INSERT INTO public.delivery_verification_audit (company_id, subject, action, actor_kind) VALUES (gen_random_uuid(), ''company'', ''fake'', ''admin'')', 'err:42501:%');
SELECT t_val('78 o2 ne lit pas le journal de c1', :o2, 'SELECT count(*)::text FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = ''c1'')', '0');
SELECT t_val('79 o1 lit le journal de son dossier (hors notes internes)', :o1, 'SELECT (count(*) > 0)::text || ''/'' || count(*) FILTER (WHERE visibility = ''internal'') FROM public.delivery_verification_audit', 'true/0');
SELECT t_admin('80 acteur journalisé : l''administrateur pour la décision d''approbation',
  'SELECT actor_kind || ''/'' || (actor_id = ''aaaaaaaa-0000-0000-0000-000000000001'') FROM public.delivery_verification_audit WHERE action = ''status_changed'' AND to_status = ''approved'' ORDER BY created_at LIMIT 1', 'admin/true');
SELECT t_admin('81 le journal ne contient pas de numéro de pièce',
  'SELECT count(*)::text FROM public.delivery_verification_audit WHERE details::text ILIKE ''%0012%'' OR details::text ILIKE ''%5555%''', '0');

SELECT t_run('82 o1 : marque sa notification comme lue', :o1, 'UPDATE public.delivery_notifications SET read_at = now() WHERE kind = ''company_approved''', 'ok');
SELECT t_run('83 o1 : modifier le titre d''une notification refusé', :o1, 'UPDATE public.delivery_notifications SET title = ''x''', 'err:42501:%');
SELECT t_run('84 o1 : créer une notification refusé', :o1, 'INSERT INTO public.delivery_notifications (user_id, kind, title) VALUES (auth.uid(), ''k'', ''t'')', 'err:42501:%');
SELECT t_val('85 o1 : marquer lue la notification de o2 : 0 ligne', :o1, 'WITH u AS (UPDATE public.delivery_notifications SET read_at = now() WHERE kind = ''company_rejected'' RETURNING 1) SELECT count(*)::text FROM u', '0');

-- ===============================================================================================================
-- F. Course, argent, droits d'exécution
-- ===============================================================================================================
-- état : c3 approuvée mais son livreur a été repassé en attente (cas 72) : on le ré-approuve
SELECT t_run('86 admin : ré-approuve le livreur de c3', :a, 'SELECT public.admin_decide_delivery_driver((SELECT id FROM public.delivery_drivers WHERE full_name = ''Koffi Yao''), ''approved'')', 'ok');
INSERT INTO t_ids SELECT 'koffi', id FROM public.delivery_drivers WHERE full_name = 'Koffi Yao';
INSERT INTO t_ids SELECT 'faux', id FROM public.delivery_drivers WHERE full_name = 'Faux';
INSERT INTO t_ids SELECT 'ali', id FROM public.delivery_drivers WHERE full_name = 'Ali Bamba';
SELECT t_run('87 boutique s : course vers la structure approuvée c3', :s,
  'INSERT INTO public.delivery_dispatches (shop_id, company_id, city, status) VALUES (''5a000000-0000-0000-0000-000000000001'', (SELECT v FROM t_ids WHERE k = ''c3''), ''Abidjan'', ''assigned'')', 'ok');
INSERT INTO t_ids SELECT 'd1', id FROM public.delivery_dispatches LIMIT 1;
SELECT t_run('88 boutique s : course vers c2 (non vérifiée) refusée', :s,
  'INSERT INTO public.delivery_dispatches (shop_id, company_id, city) VALUES (''5a000000-0000-0000-0000-000000000001'', (SELECT v FROM t_ids WHERE k = ''c2''), ''Abidjan'')', 'err:23514:%pas vérifiée%');
SELECT t_run('89 structure c3 : affecte un livreur non approuvé (Faux) : refusé', :o3,
  'UPDATE public.delivery_dispatches SET assigned_driver_id = (SELECT v FROM t_ids WHERE k = ''faux'') WHERE id = (SELECT v FROM t_ids WHERE k = ''d1'')', 'err:23514:%livreur%');
SELECT t_run('89b structure c3 : affecte un livreur d''une autre structure (Ali, c1) : refusé', :o3,
  'UPDATE public.delivery_dispatches SET assigned_driver_id = (SELECT v FROM t_ids WHERE k = ''ali'') WHERE id = (SELECT v FROM t_ids WHERE k = ''d1'')', 'err:23514:%livreur%');
SELECT t_run('89c structure c3 : affecte son livreur approuvé (Koffi) : accepté', :o3,
  'UPDATE public.delivery_dispatches SET assigned_driver_id = (SELECT v FROM t_ids WHERE k = ''koffi'') WHERE id = (SELECT v FROM t_ids WHERE k = ''d1'')', 'ok');
SELECT t_run('90 transfert d''argent : tiers refusé', :x,
  'INSERT INTO public.delivery_cash_transfers (dispatch_id, company_id, shop_id, cod_amount, net_seller_amount) VALUES ((SELECT v FROM t_ids WHERE k = ''d1''), (SELECT v FROM t_ids WHERE k = ''c3''), ''5a000000-0000-0000-0000-000000000001'', 1000, 1000)', 'err:42501:%');
SELECT t_run('91 transfert d''argent : la boutique de la course', :s,
  'INSERT INTO public.delivery_cash_transfers (dispatch_id, company_id, shop_id, cod_amount, net_seller_amount) VALUES ((SELECT v FROM t_ids WHERE k = ''d1''), (SELECT v FROM t_ids WHERE k = ''c3''), ''5a000000-0000-0000-0000-000000000001'', 1000, 1000)', 'ok');

SELECT t_val('92 anon : register_delivery_application non exécutable', NULL, 'SELECT has_function_privilege(''anon'', ''public.register_delivery_application(jsonb,jsonb,jsonb,jsonb)'', ''EXECUTE'')::text', 'false');
SELECT t_val('93 anon : admin_decide_delivery_company non exécutable', NULL, 'SELECT has_function_privilege(''anon'', ''public.admin_decide_delivery_company(uuid,text,text,text,text,text,boolean)'', ''EXECUTE'')::text', 'false');
SELECT t_val('94 authenticated : tâche d''expiration, notify et audit_write non exécutables',
  NULL, 'SELECT has_function_privilege(''authenticated'', ''public.delivery_enforce_document_expiry()'', ''EXECUTE'')::text || has_function_privilege(''authenticated'', ''public.delivery_notify(uuid,uuid,uuid,text,text,text,text,text)'', ''EXECUTE'')::text || has_function_privilege(''authenticated'', ''public.delivery_audit_write(uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb)'', ''EXECUTE'')::text', 'falsefalsefalse');

-- ===============================================================================================================
-- G. Règle permis ↔ véhicule (fonction pure)
-- ===============================================================================================================
SELECT t_admin('95 moto + A valide', $$SELECT cardinality(public.delivery_driver_issues('motorcycle', ARRAY['A'], current_date + 10, NULL))::text$$, '0');
SELECT t_admin('96 moto + B refusée', $$SELECT cardinality(public.delivery_driver_issues('motorcycle', ARRAY['B'], current_date + 10, NULL))::text$$, '1');
SELECT t_admin('97 tricycle + A valide', $$SELECT cardinality(public.delivery_driver_issues('tricycle', ARRAY['A'], current_date + 10, NULL))::text$$, '0');
SELECT t_admin('98 voiture + B valide, voiture + A refusée',
  $$SELECT cardinality(public.delivery_driver_issues('car', ARRAY['B'], current_date + 10, NULL))::text || cardinality(public.delivery_driver_issues('car', ARRAY['A'], current_date + 10, NULL))::text$$, '01');
SELECT t_admin('99 van + C valide, van + A refusé',
  $$SELECT cardinality(public.delivery_driver_issues('van', ARRAY['C'], current_date + 10, NULL))::text || cardinality(public.delivery_driver_issues('van', ARRAY['A'], current_date + 10, NULL))::text$$, '01');
SELECT t_admin('100 « autre » accepte A ou B', $$SELECT cardinality(public.delivery_driver_issues('other', ARRAY['B'], current_date + 10, NULL))::text || cardinality(public.delivery_driver_issues('other', ARRAY['A'], current_date + 10, NULL))::text$$, '00');
SELECT t_admin('101 permis A+B sur une moto : valide', $$SELECT cardinality(public.delivery_driver_issues('motorcycle', ARRAY['A','B'], current_date + 10, NULL))::text$$, '0');
SELECT t_admin('102 pièce d''identité expirée : une anomalie', $$SELECT cardinality(public.delivery_driver_issues('motorcycle', ARRAY['A'], current_date + 10, current_date - 1))::text$$, '1');
SELECT t_admin('103 expiration du permis absente : une anomalie', $$SELECT cardinality(public.delivery_driver_issues('motorcycle', ARRAY['A'], NULL, NULL))::text$$, '1');

-- ===============================================================================================================
-- H. Stockage privé
-- ===============================================================================================================
SELECT t_admin('104 bucket delivery-kyc privé', $$SELECT public::text || '/' || file_size_limit FROM storage.buckets WHERE id = 'delivery-kyc'$$, 'false/10485760');
SELECT t_run('105 o1 : dépôt dans son dossier', :o1, 'INSERT INTO storage.objects (bucket_id, name) VALUES (''delivery-kyc'', ''01010101-0000-0000-0000-000000000001/a.jpg'')', 'ok');
SELECT t_run('106 o1 : dépôt dans le dossier d''un autre refusé', :o1, 'INSERT INTO storage.objects (bucket_id, name) VALUES (''delivery-kyc'', ''02020202-0000-0000-0000-000000000002/a.jpg'')', 'err:42501:%');
SELECT t_val('107 o2 ne lit pas le fichier de o1', :o2, $$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'delivery-kyc'$$, '0');
SELECT t_val('108 o1 lit son fichier', :o1, $$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'delivery-kyc'$$, '1');
SELECT t_val('109 l''administrateur lit les fichiers de tous', :a, $$SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'delivery-kyc'$$, '1');

-- ===============================================================================================================
-- I. Expiration des pièces (le temps est simulé en suspendant le garde-fou le temps de la mise en place)
-- ===============================================================================================================
ALTER TABLE public.delivery_drivers DISABLE TRIGGER trg_guard_delivery_driver;
ALTER TABLE public.delivery_company_kyc DISABLE TRIGGER trg_guard_delivery_company_kyc;
UPDATE public.delivery_drivers SET license_expiry = current_date - 2 WHERE full_name = 'Koffi Yao';
UPDATE public.delivery_company_kyc SET id_expiry = current_date - 1 WHERE company_id = (SELECT v FROM t_ids WHERE k = 'c3');
-- livreur « Zoe » (c3) : approuvé, permis valable, expire dans 30 jours -> rappel
INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, id_expiry,
                                     photo_url, national_id_photo_url, license_photo_url, verification_status, is_active)
VALUES ((SELECT v FROM t_ids WHERE k = 'c3'), 'Zoe Test', 'Zoe', 'Test', '1', 'car', ARRAY['B'], current_date + 30, current_date + 400, 'p', 'i', 'l', 'approved', true);
ALTER TABLE public.delivery_drivers ENABLE TRIGGER trg_guard_delivery_driver;
ALTER TABLE public.delivery_company_kyc ENABLE TRIGGER trg_guard_delivery_company_kyc;
DELETE FROM public.delivery_notifications WHERE kind = 'expiry_reminder';

SELECT t_run('110 la tâche d''expiration n''est pas exécutable par un utilisateur', :o1, 'SELECT public.delivery_enforce_document_expiry()', 'err:42501:%');
SELECT t_run('111 …elle l''est par service_role', NULL, 'SELECT public.delivery_enforce_document_expiry()', 'ok', 'service_role');
SELECT t_admin('112 Koffi (permis expiré, était approuvé et actif) : suspendu, inactif, code EXPIRED_LICENSE',
  $$SELECT verification_status || '/' || is_active || '/' || rejection_reason_code FROM public.delivery_drivers WHERE full_name = 'Koffi Yao'$$, 'suspended/false/EXPIRED_LICENSE');
SELECT public.delivery_enforce_document_expiry();
SELECT t_admin('114 …un seul rappel pour Zoe malgré deux exécutions le même jour',
  $$SELECT count(*)::text FROM public.delivery_notifications WHERE kind = 'expiry_reminder' AND title ILIKE 'Permis de Zoe%'$$, '1');
SELECT t_admin('115 Zoe reste approuvée et active', $$SELECT verification_status || '/' || is_active FROM public.delivery_drivers WHERE full_name = 'Zoe Test'$$, 'approved/true');
SELECT t_admin('116 c3 : pièce du responsable expirée -> complément demandé, badge retiré, code EXPIRED_ID',
  $$SELECT verification_status::text || '/' || trust_badge_active || '/' || rejection_reason_code FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'c3')$$, 'action_required/false/EXPIRED_ID');
SELECT t_admin('117 c3 : décision journalisée par le système, propriétaire prévenu',
  $$SELECT (SELECT count(*) FROM public.delivery_verification_audit WHERE actor_kind = 'system' AND action = 'status_changed' AND to_status = 'action_required' AND company_id = (SELECT v FROM t_ids WHERE k = 'c3'))::text || '/' ||
           (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'company_action_required' AND user_id = '03030303-0000-0000-0000-000000000003')$$, '1/1');

SELECT t_admin('118 …audit « driver_status_changed » par le système et notification « livreur suspendu » au propriétaire',
  $$SELECT (SELECT count(*) FROM public.delivery_verification_audit WHERE action = 'driver_status_changed' AND actor_kind = 'system' AND to_status = 'suspended')::text || '/' ||
           (SELECT count(*) FROM public.delivery_notifications WHERE kind = 'driver_suspended')$$, '1/1');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
