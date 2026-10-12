-- ============================================================================
-- Vérification EN LECTURE SEULE après déploiement (dev). Aucune écriture.
-- Résultat : une ligne par contrôle ; la colonne ok doit être TRUE partout.
-- Les contrôles C1 (portefeuille) ne s'appliquent que si 02_c1_wallet_dev.sql a été exécuté ;
-- ils sont marqués « (C1) » : s'il n'a pas été déployé, ces lignes sont attendues FALSE.
-- ============================================================================
WITH exp(fn, anon_ok, auth_ok, svc_ok, scope) AS (
  VALUES
    ('apply_commission_payment',          false, false, true, 'C2'),
    ('apply_shop_subscription',           false, false, true, 'C2'),
    ('apply_shop_activation',             false, false, true, 'C2'),
    ('prepare_shop_activation_payment',   false, false, true, 'C2'),
    ('get_shop_orders_secure',            false, true,  true, 'C3'),
    ('request_wallet_withdrawal_atomic',  false, true,  true, 'C1'),
    ('save_merchant_payout_config',       false, true,  true, 'C1'),
    ('get_or_create_merchant_wallet',     false, false, true, 'C1'),
    ('credit_merchant_wallet_pending',    false, false, true, 'C1'),
    ('process_wallet_settlements',        false, false, true, 'C1')
),
fn_checks AS (
  SELECT e.scope || ' droits ' || e.fn AS controle,
         'anon=' || e.anon_ok || ' authenticated=' || e.auth_ok || ' service_role=' || e.svc_ok AS attendu,
         CASE WHEN p.oid IS NULL THEN 'fonction absente'
              ELSE 'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
                || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
                || ' service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE') END AS observe,
         COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE') = e.anon_ok
              AND has_function_privilege('authenticated', p.oid, 'EXECUTE') = e.auth_ok
              AND has_function_privilege('service_role', p.oid, 'EXECUTE') = e.svc_ok, false) AS ok
  FROM exp e
  LEFT JOIN pg_proc p ON p.proname = e.fn AND p.pronamespace = 'public'::regnamespace
),
lot_a AS (
  SELECT 'C2 lot de 16 fonctions serveur exposees a anon/authenticated' AS controle,
         '0' AS attendu,
         count(*)::text AS observe,
         count(*) = 0 AS ok
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = ANY (ARRAY['read_email_batch','enqueue_email','delete_email','move_to_dlq','cleanup_expired_trash',
      'cleanup_old_generated_media','cleanup_old_image_cache','expire_stale_pending_payments','expire_subscriptions',
      'enforce_shop_payment_state','check_rate_limit','record_app_incident','increment_promo_usage',
      'get_next_queue_item','count_processing_generations','get_or_create_affiliate'])
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
),
corp AS (
  SELECT 'H2 politiques permissives corporate_* (insertion seule voulue)' AS controle,
         '2' AS attendu,
         count(*)::text AS observe,
         count(*) = 2 AS ok
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename LIKE 'corporate_%' AND (qual = 'true' OR with_check = 'true')
),
helpers AS (
  SELECT 'H2 fonctions is_corporate_founder / is_corporate_reader' AS controle,
         '2' AS attendu, count(*)::text AS observe, count(*) = 2 AS ok
  FROM pg_proc WHERE proname IN ('is_corporate_founder', 'is_corporate_reader')
),
rls AS (
  SELECT 'C1 RLS activee sur ' || c.relname AS controle,
         'true' AS attendu, c.relrowsecurity::text AS observe, c.relrowsecurity AS ok
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN ('wallets', 'wallet_ledger', 'withdrawal_requests', 'merchant_kyc', 'ecomfy_payments', 'settlements')
)
SELECT * FROM fn_checks
UNION ALL SELECT * FROM lot_a
UNION ALL SELECT * FROM corp
UNION ALL SELECT * FROM helpers
UNION ALL SELECT * FROM rls
ORDER BY ok, controle;
