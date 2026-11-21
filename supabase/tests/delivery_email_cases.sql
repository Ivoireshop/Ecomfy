-- Cas de test de 20261121120000_delivery_email_channel.sql : canal e-mail des notifications (§12).
--
-- À jouer APRÈS delivery_finance_cases.sql (mêmes utilisateurs d1..d5, administrateur :a, aides t_*, résultats cumulés t_res),
-- sur la même base JETABLE, avec 20261121120000 jouée juste avant ce fichier.
\set ON_ERROR_STOP on

DELETE FROM public.delivery_notifications;   -- l'outbox suit en cascade

-- ===============================================================================================================
-- Création des envois (déclencheur)
-- ===============================================================================================================
SELECT public.delivery_notify(:d1, NULL, NULL, 'dispatch_transmitted', 'info', 'Nouvelle commande', 'Une commande à Abidjan', '/delivery/partner-dashboard');
SELECT t_admin('E01 une notification crée un envoi e-mail en attente',
  $$SELECT o.status || '/' || o.channel || '/' || o.attempts FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.user_id = '$$ || :d1 || $$'$$, 'pending/email/0');

SELECT t_val('E02 préférence par défaut : activée', :d2, $$SELECT public.delivery_get_email_pref()::text$$, 'true');
SELECT t_run('E03 anonyme : changer la préférence est refusé', NULL, $$SELECT public.delivery_set_email_pref(false)$$, 'err:42501:%', 'anon');
SELECT t_run('E04 valeur nulle refusée', :d2, $$SELECT public.delivery_set_email_pref(NULL)$$, 'err:22023:%');
SELECT t_val('E05 l''utilisateur coupe l''e-mail', :d2, $$SELECT public.delivery_set_email_pref(false)::text$$, 'false');
SELECT t_val('E06 la préférence est relue', :d2, $$SELECT public.delivery_get_email_pref()::text$$, 'false');
SELECT t_val('E07 la préférence d''un autre n''est pas touchée', :d1, $$SELECT public.delivery_get_email_pref()::text$$, 'true');

SELECT public.delivery_notify(:d2, NULL, NULL, 'dispatch_transmitted', 'info', 'Autre commande', NULL, NULL);
SELECT t_admin('E08 e-mail coupé : aucune ligne d''envoi', $$SELECT count(*)::text FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.user_id = '$$ || :d2 || $$'$$, '0');
SELECT t_admin('E09 mais la notification dans l''application existe toujours', $$SELECT count(*)::text FROM public.delivery_notifications WHERE user_id = '$$ || :d2 || $$'$$, '1');

SELECT t_val('E10 réactiver l''e-mail', :d2, $$SELECT public.delivery_set_email_pref(true)::text$$, 'true');
SELECT public.delivery_notify(:d2, NULL, NULL, 'fee_confirmed', 'success', 'Cotisation confirmée', 'Merci', '/delivery/fees');
SELECT t_admin('E11 réactivé : un envoi est créé', $$SELECT count(*)::text FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.user_id = '$$ || :d2 || $$'$$, '1');

SELECT public.delivery_notify_admins(NULL, NULL, 'submitted', 'info', 'Nouvelle inscription', 'Une structure s''est inscrite');
SELECT t_admin('E12 les notifications aux administrateurs créent aussi leurs envois', $$SELECT count(*)::text FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'submitted'$$, '2');

-- ===============================================================================================================
-- Droits
-- ===============================================================================================================
SELECT t_run('E20 un utilisateur ne peut pas réserver les envois', :d1, $$SELECT * FROM public.delivery_email_claim(10)$$, 'err:42501:%');
SELECT t_run('E21 un anonyme non plus', NULL, $$SELECT * FROM public.delivery_email_claim(10)$$, 'err:42501:%', 'anon');
SELECT t_run('E22 ni marquer un résultat', :d1, $$SELECT public.delivery_email_mark(gen_random_uuid(), 'sent')$$, 'err:42501:%');
SELECT t_run('E23 la file n''est pas lisible par l''API', :d1, $$SELECT * FROM public.delivery_notification_outbox$$, 'err:42501:%');
SELECT t_run('E24 les préférences ne sont pas lisibles par l''API', :d1, $$SELECT * FROM public.delivery_notification_prefs$$, 'err:42501:%');
SELECT t_run('E25 la file n''est pas modifiable par l''API', :d1, $$UPDATE public.delivery_notification_outbox SET status = 'sent'$$, 'err:42501:%');

-- ===============================================================================================================
-- Réservation, résultat, reprises
-- ===============================================================================================================
SELECT t_val('E30 le service réserve les 4 envois en attente', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '4', 'service_role');
SELECT t_admin('E31 réservés : en cours d''envoi, 1 essai', $$SELECT string_agg(DISTINCT status || '/' || attempts, ',') FROM public.delivery_notification_outbox$$, 'sending/1');
SELECT t_val('E32 un second passage immédiat ne les reprend pas', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '0', 'service_role');

-- Contenu retourné : adresse du destinataire et texte.
UPDATE public.delivery_notification_outbox SET status = 'pending', attempts = 0, claimed_at = NULL;
SELECT t_val('E33 le contenu retourné contient l''adresse et le titre', NULL,
  $$SELECT string_agg(email || '|' || title || '|' || COALESCE(link, '-'), ',' ORDER BY title) FROM public.delivery_email_claim(10) WHERE kind IN ('dispatch_transmitted', 'fee_confirmed')$$,
  '%|Cotisation confirmée|/delivery/fees,%|Nouvelle commande|/delivery/partner-dashboard', 'service_role');

SELECT t_run('E34 résultat inconnu refusé', NULL, $$SELECT public.delivery_email_mark((SELECT id FROM public.delivery_notification_outbox LIMIT 1), 'peut-etre')$$, 'err:22023:%', 'service_role');

-- Marquage : envoyé.
SELECT public.delivery_email_mark(o.id, 'sent') FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'fee_confirmed';
SELECT t_admin('E35 envoyé : statut et date posés', $$SELECT o.status || '/' || (o.sent_at IS NOT NULL) FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'fee_confirmed'$$, 'sent/true');

-- Marquage : ignoré (désinscrit) avec motif.
SELECT public.delivery_email_mark(o.id, 'skipped', 'adresse désinscrite') FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'submitted';
SELECT t_admin('E36 ignoré : motif conservé', $$SELECT o.status || '/' || o.last_error FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'submitted'$$, 'skipped/adresse désinscrite');

-- Reprises : 3 essais puis échec définitif.
SELECT public.delivery_email_mark(o.id, 'retry', 'timeout') FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'dispatch_transmitted' AND n.user_id = :d1;
SELECT t_admin('E37 reprise : retourne en attente', $$SELECT o.status || '/' || o.attempts FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'dispatch_transmitted' AND n.user_id = '$$ || :d1 || $$'$$, 'pending/1');
SELECT t_val('E38 le deuxième essai est réservé', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '1', 'service_role');
SELECT public.delivery_email_mark(o.id, 'retry', 'timeout') FROM public.delivery_notification_outbox o WHERE o.status = 'sending';
SELECT t_val('E39 le troisième essai est réservé', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '1', 'service_role');
SELECT public.delivery_email_mark(o.id, 'retry', 'timeout') FROM public.delivery_notification_outbox o WHERE o.status = 'sending';
SELECT t_admin('E40 après 3 essais : échec définitif', $$SELECT o.status || '/' || o.attempts || '/' || o.last_error FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'dispatch_transmitted' AND n.user_id = '$$ || :d1 || $$'$$, 'failed/3/timeout');
SELECT t_val('E41 plus rien à réserver', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '0', 'service_role');

-- Marquer un envoi non réservé est sans effet.
SELECT public.delivery_email_mark(o.id, 'failed', 'x') FROM public.delivery_notification_outbox o WHERE o.status = 'sent';
SELECT t_admin('E42 marquer un envoi déjà terminé ne le change pas', $$SELECT count(*)::text FROM public.delivery_notification_outbox WHERE status = 'sent' AND last_error IS NULL$$, '1');

-- Réservation restée sans réponse : reprise après 10 minutes.
INSERT INTO public.delivery_notifications (user_id, kind, tone, title) VALUES (:d3, 'dispatch_mission', 'info', 'Mission test');
UPDATE public.delivery_notification_outbox o SET status = 'sending', attempts = 1, claimed_at = now() - interval '11 minutes'
  FROM public.delivery_notifications n WHERE n.id = o.notification_id AND n.title = 'Mission test';
SELECT t_val('E43 une réservation sans réponse depuis 10 minutes est reprise', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '1', 'service_role');
SELECT t_admin('E44 reprise : 2e essai', $$SELECT o.attempts::text FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.title = 'Mission test'$$, '2');

-- Une réservation toute récente n'est pas reprise.
INSERT INTO public.delivery_notifications (user_id, kind, tone, title) VALUES (:d3, 'dispatch_mission', 'info', 'Mission récente');
UPDATE public.delivery_notification_outbox o SET status = 'sending', attempts = 1, claimed_at = now() - interval '1 minute'
  FROM public.delivery_notifications n WHERE n.id = o.notification_id AND n.title = 'Mission récente';
SELECT t_val('E45 une réservation récente n''est pas reprise', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '0', 'service_role');

-- Expiration : plus de 48 h, abandonné.
INSERT INTO public.delivery_notifications (user_id, kind, tone, title) VALUES (:d3, 'dispatch_mission', 'info', 'Mission ancienne');
UPDATE public.delivery_notification_outbox o SET created_at = now() - interval '3 days'
  FROM public.delivery_notifications n WHERE n.id = o.notification_id AND n.title = 'Mission ancienne';
SELECT t_val('E46 un envoi de plus de 48 h n''est pas réservé', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '0', 'service_role');
SELECT t_admin('E47 il est marqué abandonné avec son motif', $$SELECT o.status || '/' || o.last_error FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.title = 'Mission ancienne'$$, 'skipped/expiré%');

-- Purge de l'historique de plus de 90 jours.
UPDATE public.delivery_notification_outbox o SET created_at = now() - interval '100 days'
  FROM public.delivery_notifications n WHERE n.id = o.notification_id AND n.kind = 'fee_confirmed';
SELECT t_val('E48 réservation sans effet de bord sur la purge visible', NULL, $$SELECT count(*)::text FROM public.delivery_email_claim(10)$$, '0', 'service_role');
SELECT t_admin('E49 l''historique de plus de 90 jours est purgé', $$SELECT count(*)::text FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.kind = 'fee_confirmed'$$, '0');

-- ===============================================================================================================
-- Couper l'e-mail annule les envois en attente
-- ===============================================================================================================
SELECT public.delivery_notify(:d4, NULL, NULL, 'dispatch_transmitted', 'info', 'À annuler', NULL, NULL);
SELECT t_val('E50 couper l''e-mail', :d4, $$SELECT public.delivery_set_email_pref(false)::text$$, 'false');
SELECT t_admin('E51 l''envoi en attente est annulé', $$SELECT o.status FROM public.delivery_notification_outbox o JOIN public.delivery_notifications n ON n.id = o.notification_id WHERE n.title = 'À annuler'$$, 'skipped');

-- ===============================================================================================================
-- Robustesse
-- ===============================================================================================================
DELETE FROM public.delivery_notifications WHERE title = 'Mission récente';
SELECT t_admin('E60 supprimer une notification supprime son envoi', $$SELECT count(*)::text FROM public.delivery_notification_outbox o WHERE NOT EXISTS (SELECT 1 FROM public.delivery_notifications n WHERE n.id = o.notification_id)$$, '0');

-- Une file cassée ne doit jamais empêcher d'écrire une notification.
ALTER TABLE public.delivery_notification_outbox RENAME TO delivery_notification_outbox_off;
SELECT public.delivery_notify(:d5, NULL, NULL, 'dispatch_transmitted', 'info', 'File cassée', NULL, NULL);
ALTER TABLE public.delivery_notification_outbox_off RENAME TO delivery_notification_outbox;
SELECT t_admin('E61 file indisponible : la notification est quand même écrite', $$SELECT count(*)::text FROM public.delivery_notifications WHERE title = 'File cassée'$$, '1');

SELECT t_admin('E62 droits d''exécution',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_email_claim(integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_email_claim(integer)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.delivery_email_mark(uuid,text,text)', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.delivery_set_email_pref(boolean)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_set_email_pref(boolean)', 'EXECUTE'))::text$$, 'true');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
