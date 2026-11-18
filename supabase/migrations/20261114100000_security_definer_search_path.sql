-- M1 (audit 2026-10) : toute fonction SECURITY DEFINER du schéma public doit
-- fixer son search_path, sinon un schéma écrit par un utilisateur peut détourner
-- les noms non qualifiés (et le linter Supabase la signale).
--
-- État constaté sur la dev le 14/11/2026 : 191 fonctions sur 195 le fixaient déjà
-- (migrations ultérieures à l'audit). Restent les 4 enveloppes de la file d'e-mails
-- (enqueue_email, read_email_batch, delete_email, move_to_dlq) : elles appellent
-- pgmq avec le schéma explicite (pgmq.send, pgmq.read...), donc public suffit.
--
-- La boucle couvre aussi toute fonction qui apparaîtrait plus tard sans réglage,
-- y compris sur une base reconstruite. Idempotente : ne touche que les fonctions
-- sans search_path, jamais celles installées par une extension.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
    RAISE NOTICE 'search_path fixé : %', fn.sig;
  END LOOP;
END
$$;
