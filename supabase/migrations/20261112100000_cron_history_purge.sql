-- Historique pg_cron : purge quotidienne.
--
-- Constat (panne du 12/11/2026) : `cron.job_run_details` pesait 369 Mo, soit la moitié de la base. La tâche n° 9
-- (file d'e-mails, `process-email-queue`) s'exécute toutes les 5 secondes, ce qui ajoute puis met à jour une ligne
-- d'historique à chaque tic (≈ 17 000 lignes par jour). Cette écriture permanente alourdit le WAL (décodé par Realtime)
-- et le cache de la base, sur une petite instance déjà à court de mémoire.
--
-- Cette migration planifie une purge quotidienne (03 h 17 UTC) qui ne garde que 2 jours d'historique. Elle ne touche
-- ni à la tâche n° 9 ni à aucune autre tâche, et ne supprime rien elle-même : la première purge a lieu à 03 h 17.
-- Pour vider l'arriéré tout de suite (la table est déjà énorme), voir docs/DEPLOIEMENT-PANNE-2026-11-12.md.
-- Idempotent : la tâche est replanifiée si elle existe déjà ; sans effet si pg_cron est absent.

DO $$
DECLARE v_jobid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'purge-cron-run-details';
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;
    PERFORM cron.schedule(
      'purge-cron-run-details',
      '17 3 * * *',
      $cron$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days'; $cron$
    );
  END IF;
END $$;
