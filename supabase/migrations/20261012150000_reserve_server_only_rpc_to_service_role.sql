-- Audit C2 (suite) : fonctions SECURITY DEFINER réservées au serveur, restées exécutables par
-- anon / authenticated.
--
-- Les migrations d'origine font REVOKE ... FROM PUBLIC seulement. Sur Supabase, anon et authenticated
-- gardent EXECUTE (privilèges par défaut du schéma public). Ces fonctions n'ont aucun appelant
-- navigateur : elles sont appelées par des edge functions (client service_role), par pg_cron
-- (rôle postgres) ou ne sont pas appelées.
--   * files d'e-mails (read_email_batch, enqueue_email, delete_email, move_to_dlq) : lecture et
--     suppression des e-mails en attente par n'importe qui
--   * tâches de maintenance (cleanup_*, expire_*, enforce_shop_payment_state) : déclenchables à volonté
--   * quotas, incidents, codes promo (check_rate_limit, record_app_incident, increment_promo_usage) :
--     falsification du compteur de limitation, du journal d'incidents, de l'usage des codes
--   * file de génération IA (get_next_queue_item, count_processing_generations)
--
-- Toutes les surcharges de chaque nom sont traitées. Idempotent ; les fonctions absentes sont ignorées.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'read_email_batch', 'enqueue_email', 'delete_email', 'move_to_dlq',
        'cleanup_expired_trash', 'cleanup_old_generated_media', 'cleanup_old_image_cache',
        'expire_stale_pending_payments', 'expire_subscriptions', 'enforce_shop_payment_state',
        'check_rate_limit', 'record_app_incident', 'increment_promo_usage',
        'get_next_queue_item', 'count_processing_generations',
        'get_or_create_affiliate'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
