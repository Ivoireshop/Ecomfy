-- Planifie le traitement de la file d'e-mails (Edge Function process-email-queue), toutes les 5 secondes.
-- La migration 20260410182641_email_infra.sql décrit cette tâche en commentaire mais ne la crée pas :
-- sur dev (xfpbpxncserliskrbaim) elle n'existait pas, les mails restaient « pending ».
--
-- PRÉREQUIS (une seule fois par projet, à faire à la main : la clé ne doit jamais être écrite dans un fichier) :
--   select vault.create_secret('<clé service_role du projet>', 'email_queue_service_role_key');
--   (le secret 'supabase_project_url' doit aussi exister dans le coffre : https://<ref>.supabase.co)
--
-- Rejouable : la tâche est supprimée puis recréée.
-- Retour arrière : select cron.unschedule('process-email-queue');

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'email_queue_service_role_key') then
    raise exception 'Secret vault email_queue_service_role_key absent : voir les prérequis en tête de fichier';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'supabase_project_url') then
    raise exception 'Secret vault supabase_project_url absent : voir les prérequis en tête de fichier';
  end if;
end $$;

select cron.unschedule('process-email-queue')
where exists (select 1 from cron.job where jobname = 'process-email-queue');

select cron.schedule(
  'process-email-queue',
  '5 seconds',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_project_url')
           || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  )
  where exists (
          select 1 from public.email_send_state
          where id = 1 and (retry_after_until is null or retry_after_until <= now())
        )
    and (
          exists (select 1 from pgmq.q_auth_emails where vt <= now())
       or exists (select 1 from pgmq.q_transactional_emails where vt <= now())
        );
  $job$
);

-- Contrôle
select jobid, jobname, schedule, active from cron.job where jobname = 'process-email-queue';
