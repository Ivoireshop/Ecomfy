-- Finance boutique : le résumé hebdomadaire promis « chaque lundi à 8h » n'était planifié nulle part dans les migrations
-- (aucun cron.schedule ne l'appelait) : l'interrupteur « Rapport auto » de la page Finance n'envoyait jamais rien.
--
-- Planifie send-weekly-finance-summary le lundi à 8h (UTC = heure d'Abidjan et de Dakar) via public.invoke_edge_function
-- (migration 20261011120000) : elle lit l'URL du projet dans Vault (`supabase_project_url`) et transmet le secret
-- `cron_secret` en en-tête x-cron-secret, que la fonction contrôle avec isAuthorizedCron. Sans ces deux secrets Vault,
-- l'appel est ignoré ou refusé en 401 (voir docs/DEPLOIEMENT-FINANCE-2026-10.md).
--
-- Idempotent : le job est remplacé s'il existe déjà. Si un job équivalent a été créé à la main sous un autre nom, le
-- doublon est sans effet : la fonction n'envoie qu'un résumé par adresse et par heure (la clé d'idempotence ne suffit pas,
-- la file d'envoi ne déduplique que sur `message_id`).

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regprocedure('public.invoke_edge_function(text,jsonb)') IS NULL THEN
    RAISE WARNING 'invoke_edge_function absente : appliquer d''abord 20261011120000_edge_function_url_from_vault.sql';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'weekly-finance-summary';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'weekly-finance-summary',
    '0 8 * * 1',
    $cmd$ SELECT public.invoke_edge_function('send-weekly-finance-summary'); $cmd$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'weekly-finance-summary non planifié : %', SQLERRM;
END $$;

-- Montant d'une dépense : la page refuse déjà > 1 milliard de FCFA ; la base ne le refusait pas (faute de frappe à 12 zéros
-- qui fausse tous les totaux). NOT VALID : les lignes existantes ne sont pas revérifiées, seules les nouvelles le sont.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_expenses_amount_max') THEN
    ALTER TABLE public.shop_expenses
      ADD CONSTRAINT shop_expenses_amount_max CHECK (amount <= 1000000000) NOT VALID;
  END IF;
END $$;
