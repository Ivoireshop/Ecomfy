-- Cas de test de 20261120100000_delivery_directory_profile.sql : répertoire des structures et profil modifiable.
--
-- À jouer EN DERNIER sur la base jetable, après delivery_kyc_cases.sql et delivery_back_sides_cases.sql (il réutilise leurs
-- aides t_*, leurs résultats cumulés et l'utilisateur administrateur). Ordre complet : voir l'en-tête de delivery_kyc.sql,
-- en ajoutant 20261109110000 avant delivery_kyc_cases.sql, puis 20261120100000 juste avant ce fichier.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('08080808-0000-0000-0000-000000000008', 'd1@test'), ('09090909-0000-0000-0000-000000000009', 'd2@test'),
  ('0a0a0a0a-0000-0000-0000-00000000000a', 'd3@test'), ('0b0b0b0b-0000-0000-0000-00000000000b', 'd4@test');
\set d1 '''08080808-0000-0000-0000-000000000008'''
\set d2 '''09090909-0000-0000-0000-000000000009'''
\set d3 '''0a0a0a0a-0000-0000-0000-00000000000a'''
\set d4 '''0b0b0b0b-0000-0000-0000-00000000000b'''
\set a '''aaaaaaaa-0000-0000-0000-000000000001'''

-- Fixtures : Alpha et Beta approuvées par l'administrateur, Gamma livreur indépendant approuvé, Pending en attente.
SELECT t_run('D00 d1 : inscription Alpha', :d1, t_register(:d1, t_company(:d1, 'Dir Alpha', 'CI 4001 0001')), 'ok');
SELECT t_run('D00 d2 : inscription Beta', :d2, t_register(:d2, t_company(:d2, 'Dir Beta', 'CI 4001 0002')), 'ok');
SELECT t_run('D00 d3 : inscription Gamma', :d3, t_register(:d3, t_company(:d3, 'Dir Gamma', 'CI 4001 0003')), 'ok');
SELECT t_run('D00 d4 : inscription Pending', :d4, t_register(:d4, t_company(:d4, 'Dir Pending', 'CI 4001 0004')), 'ok');
INSERT INTO t_ids SELECT 'dA', id FROM public.delivery_companies WHERE user_id = '08080808-0000-0000-0000-000000000008';
INSERT INTO t_ids SELECT 'dB', id FROM public.delivery_companies WHERE user_id = '09090909-0000-0000-0000-000000000009';
INSERT INTO t_ids SELECT 'dG', id FROM public.delivery_companies WHERE user_id = '0a0a0a0a-0000-0000-0000-00000000000a';
INSERT INTO t_ids SELECT 'dP', id FROM public.delivery_companies WHERE user_id = '0b0b0b0b-0000-0000-0000-00000000000b';

SELECT t_run('D01 admin : approuve Alpha', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''dA''), ''approved'', NULL, NULL, NULL, NULL, true)', 'ok');
SELECT t_run('D02 admin : approuve Beta', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''dB''), ''approved'', NULL, NULL, NULL, NULL, true)', 'ok');
-- Gamma : livreur indépendant approuvé (fixture posée par le propriétaire de la base, hors des gardes).
UPDATE public.delivery_companies
   SET profile_type = 'driver', verification_status = 'approved', trust_badge_active = true, headquarters_address = 'Domicile de Gamma, rue 12',
       covered_cities = ARRAY['Yamoussoukro'], city = 'Yamoussoukro', rating_score = 2.0
 WHERE id = (SELECT v FROM t_ids WHERE k = 'dG');
-- Réputation et couverture posées par la plateforme (superutilisateur : garde non applicable).
UPDATE public.delivery_companies SET rating_score = 3.0, successful_deliveries_count = 10 WHERE id = (SELECT v FROM t_ids WHERE k = 'dA');
UPDATE public.delivery_companies SET rating_score = 4.9, successful_deliveries_count = 40, covered_cities = ARRAY['Bouaké', 'Abidjan'] WHERE id = (SELECT v FROM t_ids WHERE k = 'dB');

-- ===============================================================================================================
-- Répertoire
-- ===============================================================================================================
SELECT t_run('D10 anonyme : recherche refusée', NULL, $$SELECT public.delivery_directory_search()$$, 'err:42501:%', 'anon');
SELECT t_run('D11 utilisateur sans compte (uid nul) : recherche refusée', NULL, $$SELECT public.delivery_directory_search()$$, 'err:42501:%Connexion requise%');
SELECT t_val('D12 seules les structures approuvées avec badge sont listées (Alpha, Beta, Gamma ; pas Pending)', :s,
  $$SELECT (public.delivery_directory_search('Dir'))->>'total'$$, '3');
SELECT t_val('D13 recherche par nom, insensible à la casse', :s, $$SELECT (public.delivery_directory_search('aLPha'))->>'total'$$, '1');
SELECT t_val('D14 les jokers saisis sont littéraux (% ne ramène rien)', :s, $$SELECT (public.delivery_directory_search('%'))->>'total'$$, '0');
SELECT t_val('D15 zone : ville couverte (Bouaké) trouve Beta seule', :s,
  $$SELECT (public.delivery_directory_search('Dir', 'bouak'))->'items'->0->>'company_name' || '/' || ((public.delivery_directory_search('Dir', 'bouak'))->>'total')$$, 'Dir Beta/1');
SELECT t_val('D16 zone : ville du siège (Abidjan) trouve Alpha et Beta, pas Gamma', :s,
  $$SELECT (public.delivery_directory_search('Dir', 'Abidjan'))->>'total'$$, '2');
SELECT t_val('D17 filtre livreurs indépendants : Gamma seule', :s,
  $$SELECT (public.delivery_directory_search('Dir', NULL, 'driver'))->'items'->0->>'company_name'$$, 'Dir Gamma');
SELECT t_val('D18 filtre structures : Alpha et Beta', :s, $$SELECT (public.delivery_directory_search('Dir', NULL, 'manager'))->>'total'$$, '2');
SELECT t_run('D19 type de prestataire inconnu refusé', :s, $$SELECT public.delivery_directory_search('Dir', NULL, 'admin')$$, 'err:22023:%');
SELECT t_val('D20 classement : meilleure note en premier (Beta 4.9 avant Alpha 3.0)', :s,
  $$SELECT (public.delivery_directory_search('Dir'))->'items'->0->>'company_name'$$, 'Dir Beta');
SELECT t_val('D21 pagination : limite 1 renvoie une fiche mais le total complet', :s,
  $$SELECT jsonb_array_length((public.delivery_directory_search('Dir', NULL, NULL, 1))->'items') || '/' || ((public.delivery_directory_search('Dir', NULL, NULL, 1))->>'total')$$, '1/3');
SELECT t_val('D22 pagination : décalage 2 renvoie la dernière fiche (Gamma)', :s,
  $$SELECT (public.delivery_directory_search('Dir', NULL, NULL, 10, 2))->'items'->0->>'company_name'$$, 'Dir Gamma');
SELECT t_val('D23 limite plafonnée à 60 (demande 100000)', :s,
  $$SELECT (jsonb_array_length((public.delivery_directory_search(NULL, NULL, NULL, 100000))->'items') <= 60)::text$$, 'true');

-- Confidentialité : aucune donnée d'identité, de pièce, fiscale ou interne dans les fiches.
SELECT t_val('D30 la fiche ne contient aucun champ sensible', :s,
  $$SELECT ((public.delivery_directory_search('Dir'))->'items'->0 ?| ARRAY['user_id','manager_id_photo_url','manager_selfie_with_id_url',
      'manager_photo_url','tax_id_number','tax_document_url','trade_register_number','admin_notes','reviewer_comments','rejection_reason',
      'manager_name','manager_first_name','manager_last_name','warehouse_photo_url'])::text$$, 'false');
SELECT t_val('D31 l''adresse d''un livreur indépendant n''est jamais montrée', :s,
  $$SELECT COALESCE((public.delivery_directory_search('Dir', NULL, 'driver'))->'items'->0->>'address', 'masquée')$$, 'masquée');
SELECT t_val('D32 l''adresse d''une structure est montrée', :s,
  $$SELECT (public.delivery_directory_search('Alpha'))->'items'->0->>'address'$$, 'Marcory');
SELECT t_val('D33 le téléphone public est repris du responsable tant qu''aucun n''est saisi', :s,
  $$SELECT (public.delivery_directory_search('Alpha'))->'items'->0->>'phone'$$, '+2250700000000');
SELECT t_val('D34 la fiche est marquée vérifiée', :s, $$SELECT (public.delivery_directory_search('Alpha'))->'items'->0->>'verified'$$, 'true');

SELECT t_val('D40 fiche détaillée d''une structure vérifiée', :s,
  $$SELECT public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dB'))->>'company_name'$$, 'Dir Beta');
SELECT t_run('D41 fiche d''une structure non approuvée : introuvable', :s,
  $$SELECT public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dP'))$$, 'err:P0002:%');
SELECT t_run('D42 fiche : anonyme refusé', NULL, $$SELECT public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dB'))$$, 'err:42501:%', 'anon');

-- ===============================================================================================================
-- Profil modifiable
-- ===============================================================================================================
SELECT t_run('D50 d1 : description, services, contacts, zones modifiables', :d1,
  $$UPDATE public.delivery_companies SET description = 'Livraison express à Abidjan', services_info = 'Colis fragiles, paiement à la livraison',
      public_phone = '+2250102030405', public_email = 'contact@alpha.test', covered_cities = ARRAY['Abidjan', 'Bingerville'] WHERE user_id = auth.uid()$$, 'ok');
SELECT t_admin('D51 …la structure reste approuvée avec son badge (modification non sensible)',
  $$SELECT verification_status::text || '/' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dA')$$, 'approved/true');
SELECT t_val('D52 …et la fiche reprend le téléphone public saisi', :s, $$SELECT (public.delivery_directory_search('Alpha'))->'items'->0->>'phone'$$, '+2250102030405');
SELECT t_run('D53 d1 : description de plus de 2000 caractères refusée', :d1,
  $$UPDATE public.delivery_companies SET description = repeat('x', 2001) WHERE user_id = auth.uid()$$, 'err:23514:%');
SELECT t_run('D54 d1 : e-mail de contact invalide refusé', :d1, $$UPDATE public.delivery_companies SET public_email = 'pas-un-mail' WHERE user_id = auth.uid()$$, 'err:23514:%');
SELECT t_run('D55 d1 : logo dans son propre dossier accepté', :d1,
  $$UPDATE public.delivery_companies SET logo_url = '08080808-0000-0000-0000-000000000008/logo.png' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_run('D56 d1 : logo dans le dossier d''un autre refusé', :d1,
  $$UPDATE public.delivery_companies SET logo_url = '09090909-0000-0000-0000-000000000009/logo.png' WHERE user_id = auth.uid()$$, 'err:23514:%');
SELECT t_run('D57 d1 : logo en URL externe refusé', :d1,
  $$UPDATE public.delivery_companies SET logo_url = 'https://evil.test/x.png' WHERE user_id = auth.uid()$$, 'err:23514:%');
SELECT t_run('D58 d1 : logo avec remontée de dossier refusé', :d1,
  $$UPDATE public.delivery_companies SET logo_url = '08080808-0000-0000-0000-000000000008/../09090909-0000-0000-0000-000000000009/l.png' WHERE user_id = auth.uid()$$, 'err:23514:%');

-- Réputation : la structure ne peut pas se noter elle-même.
SELECT t_run('D60 d1 : modifier sa note refusé', :d1, $$UPDATE public.delivery_companies SET rating_score = 5 WHERE user_id = auth.uid()$$, 'err:42501:%indicateurs%');
SELECT t_run('D61 d1 : modifier son nombre d''avis refusé', :d1, $$UPDATE public.delivery_companies SET reviews_count = 500 WHERE user_id = auth.uid()$$, 'err:42501:%indicateurs%');
SELECT t_run('D62 d1 : modifier ses livraisons réussies refusé', :d1, $$UPDATE public.delivery_companies SET successful_deliveries_count = 9999 WHERE user_id = auth.uid()$$, 'err:42501:%indicateurs%');
SELECT t_admin('D63 …note inchangée', $$SELECT rating_score::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dA')$$, '3.00');
SELECT t_val('D64 d2 : ne peut pas modifier la fiche d''Alpha (0 ligne touchée)', :d2,
  $$WITH u AS (UPDATE public.delivery_companies SET description = 'piraté' WHERE id = (SELECT v FROM t_ids WHERE k = 'dA') RETURNING 1) SELECT count(*)::text FROM u$$, '0');

-- Le journal garde la trace des modifications.
SELECT t_admin('D70 le journal contient les modifications de profil d''Alpha',
  $$SELECT (count(*) >= 1)::text FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND action = 'profile_updated'$$, 'true');

-- Modification sensible : l'adresse d'une structure approuvée impose une nouvelle vérification.
SELECT t_run('D80 d1 : change l''adresse du siège (structure approuvée)', :d1,
  $$UPDATE public.delivery_companies SET headquarters_address = 'Nouvelle adresse, Cocody' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_admin('D81 …retour en vérification, badge retiré',
  $$SELECT verification_status::text || '/' || trust_badge_active FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dA')$$, 'pending_verification/false');
SELECT t_val('D82 …et la structure disparaît du répertoire', :s, $$SELECT (public.delivery_directory_search('Alpha'))->>'total'$$, '0');
SELECT t_run('D83 …sa fiche détaillée devient introuvable', :s, $$SELECT public.delivery_directory_get((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:P0002:%');
SELECT t_admin('D84 …l''entrée du journal signale la nouvelle vérification',
  $$SELECT (details ->> 'reverification') FROM public.delivery_verification_audit WHERE company_id = (SELECT v FROM t_ids WHERE k = 'dA') AND action = 'profile_updated' ORDER BY created_at DESC, id DESC LIMIT 1$$, 'true');
SELECT t_run('D85 d1 : ne peut pas se remettre approuvée', :d1,
  $$UPDATE public.delivery_companies SET verification_status = 'approved', trust_badge_active = true WHERE user_id = auth.uid()$$, 'err:42501:%');

-- Une modification de la ville ou du pays suit la même règle ; l'administrateur n'est pas soumis à la remise en vérification.
SELECT t_run('D90 d2 : change sa ville (structure approuvée)', :d2, $$UPDATE public.delivery_companies SET city = 'Bouaké' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_admin('D91 …retour en vérification', $$SELECT verification_status::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dB')$$, 'pending_verification');
SELECT t_run('D92 admin : ré-approuve Beta', :a, 'SELECT public.admin_decide_delivery_company((SELECT v FROM t_ids WHERE k = ''dB''), ''approved'', NULL, NULL, NULL, NULL, true)', 'ok');
SELECT t_run('D93 admin : corrige l''adresse de Beta sans remise en vérification', :a,
  $$UPDATE public.delivery_companies SET headquarters_address = 'Adresse corrigée par l''administration' WHERE id = (SELECT v FROM t_ids WHERE k = 'dB')$$, 'ok');
SELECT t_admin('D94 …Beta reste approuvée', $$SELECT verification_status::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dB')$$, 'approved');

-- Une structure non approuvée garde le droit de compléter sa fiche sans effet de bord.
SELECT t_run('D95 d4 (en attente) : complète sa fiche', :d4, $$UPDATE public.delivery_companies SET description = 'En cours', headquarters_address = 'Plateau' WHERE user_id = auth.uid()$$, 'ok');
SELECT t_admin('D96 …statut inchangé', $$SELECT verification_status::text FROM public.delivery_companies WHERE id = (SELECT v FROM t_ids WHERE k = 'dP')$$, 'pending_verification');

-- Droits d'exécution et bucket des logos.
SELECT t_admin('D100 les fonctions du répertoire ne sont pas exécutables par anon',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_directory_search(text,text,text,integer,integer)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_directory_get(uuid)', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.delivery_directory_search(text,text,text,integer,integer)', 'EXECUTE'))::text$$, 'true');
SELECT t_admin('D101 bucket delivery-logos : public, 2 Mo, images seulement',
  $$SELECT public::text || '/' || file_size_limit || '/' || (allowed_mime_types @> ARRAY['image/png'] AND NOT allowed_mime_types @> ARRAY['application/pdf'])::text FROM storage.buckets WHERE id = 'delivery-logos'$$, 'true/2097152/true');
SELECT t_admin('D102 trois politiques de dépôt/remplacement/suppression dans son dossier',
  $$SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'delivery_logos_owner_%'$$, '3');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
