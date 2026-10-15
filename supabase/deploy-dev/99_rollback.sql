-- ============================================================================
-- RETOUR ARRIÈRE du déploiement dev. À n'utiliser qu'en cas de flux bloqué à tort :
-- chaque section REMET LES FAILLES EN PLACE. Le plus sûr reste de restaurer un snapshot.
-- Exécuter uniquement les sections voulues (elles sont indépendantes).
-- ============================================================================

-- (1) Rouvrir les fonctions de facturation et d'activation à authenticated (état d'avant 130000 / 140000)
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid) TO authenticated;
-- Pour rouvrir aussi à anon (état d'origine, FAILLE) : remplacer « TO authenticated » par « TO anon, authenticated ».

-- (2) Rouvrir le lot de 16 fonctions serveur (état d'avant 150000, FAILLE)
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
--            WHERE p.pronamespace = 'public'::regnamespace
--              AND p.proname = ANY (ARRAY['read_email_batch','enqueue_email','delete_email','move_to_dlq',
--                'cleanup_expired_trash','cleanup_old_generated_media','cleanup_old_image_cache',
--                'expire_stale_pending_payments','expire_subscriptions','enforce_shop_payment_state','check_rate_limit',
--                'record_app_incident','increment_promo_usage','get_next_queue_item','count_processing_generations',
--                'get_or_create_affiliate'])
--   LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig); END LOOP;
-- END $$;

-- (3) Retirer get_shop_orders_secure (elle n'existait pas sur dev avant ce déploiement)
-- DROP FUNCTION IF EXISTS public.get_shop_orders_secure(uuid);

-- (4) Retirer le système Ecomfy Pay déployé par 02_c1_wallet_dev.sql (DÉTRUIT les données de ces tables ;
--     elles n'existaient pas avant). Ne touche pas à payment_links (table de cours préexistante).
-- DROP FUNCTION IF EXISTS public.request_wallet_withdrawal_atomic(numeric, text, text, text, text, text);
-- DROP FUNCTION IF EXISTS public.save_merchant_payout_config(text, text, text);
-- DROP FUNCTION IF EXISTS public.review_merchant_kyc(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.merchant_kyc_guard_review_columns();
-- DROP FUNCTION IF EXISTS public.process_wallet_settlements();
-- DROP FUNCTION IF EXISTS public.credit_merchant_wallet_pending(uuid, uuid, numeric, numeric, text, int, text);
-- DROP FUNCTION IF EXISTS public.get_or_create_merchant_wallet(uuid);
-- DROP TABLE IF EXISTS public.withdrawal_requests, public.wallet_ledger, public.settlements, public.payment_events,
--                      public.ecomfy_payments, public.wallets, public.merchant_kyc, public.ecomfy_pay_settings CASCADE;


-- (5) Retirer H1 (05_h1_kyc_private_bucket.sql). Ne déplace aucun fichier : les pièces déjà déposées dans
--     kyc-documents y restent, et les lignes merchant_kyc contiennent des chemins, pas des URL. À ne faire qu'avec un
--     bucket kyc-documents vide (suppression des fichiers par l'API Storage ou le tableau de bord, pas par SQL).
-- DROP TRIGGER IF EXISTS merchant_kyc_guard_document_paths ON public.merchant_kyc;
-- DROP FUNCTION IF EXISTS public.merchant_kyc_guard_document_paths();
-- DROP POLICY IF EXISTS "kyc_documents_owner_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "kyc_documents_owner_select" ON storage.objects;
-- DROP POLICY IF EXISTS "kyc_documents_founders_select" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'kyc-documents';  -- échoue tant que le bucket contient des fichiers
