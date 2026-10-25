-- Pré-contrôle LECTURE SEULE avant le déploiement de jeanmarc vers main (docs/DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md).
-- À coller dans l'éditeur SQL de la PRODUCTION. Aucune écriture : un seul SELECT.
--
-- ATTENTION : l'éditeur SQL n'affiche que le résultat de la DERNIÈRE requête d'un script. Exécuter chaque section
-- séparément : sélectionner le texte d'une section (de son WITH/SELECT jusqu'au point-virgule) puis « Run selected ».
--
-- Résultat 1 : « prérequis » — pour chaque migration, les objets dont elle dépend. ok = false => ne pas l'appliquer
--              telle quelle (le guide dit quoi faire).
-- Résultat 2 : « déjà appliqué ? » — empreinte de chaque migration (true = déjà en base). Toutes sont idempotentes ;
--              un true évite seulement un passage inutile.
-- Résultat 3 : « environnement » — pg_cron, Vault, et les secrets Vault attendus par les tâches planifiées.

-- ============================================================================================================
-- 1. PRÉREQUIS
-- ============================================================================================================
WITH f(name) AS (SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace GROUP BY proname),
chk(migration, requis, ok) AS (VALUES
  ('20261019120000 abonnement',        'table shop_payment_events',            to_regclass('public.shop_payment_events') IS NOT NULL),
  ('20261019120000 abonnement',        'table commission_payments',            to_regclass('public.commission_payments') IS NOT NULL),
  ('20261019120000 abonnement',        'table subscriptions',                  to_regclass('public.subscriptions') IS NOT NULL),
  ('20261019120000 abonnement',        'fonction has_role',                    EXISTS (SELECT 1 FROM f WHERE name = 'has_role')),
  ('20261019120000 abonnement',        'subscriptions.plan ABSENTE (attendu)', NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='plan')),
  ('20261020120000 affiliation',       'table affiliates',                     to_regclass('public.affiliates') IS NOT NULL),
  ('20261020120000 affiliation',       'fonction get_or_create_my_affiliate',  EXISTS (SELECT 1 FROM f WHERE name = 'get_or_create_my_affiliate')),
  ('20261020120000 affiliation',       'fonction mark_affiliate_payout_paid',  EXISTS (SELECT 1 FROM f WHERE name = 'mark_affiliate_payout_paid')),
  ('20261020120000 affiliation',       'trigger de création de profil sur auth.users', EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal)),
  ('20261020130000 top sellers',       'fonction get_top_sellers',             EXISTS (SELECT 1 FROM f WHERE name = 'get_top_sellers')),
  ('20260902120000 + 20261021120000 SEO','table shop_collaborators',           to_regclass('public.shop_collaborators') IS NOT NULL),
  ('20260902120000 + 20261021120000 SEO','tables shop_seo_* DÉJÀ présentes (info)', to_regclass('public.shop_seo_connections') IS NOT NULL),
  ('20261021130000 communauté',        'table community_messages',             to_regclass('public.community_messages') IS NOT NULL),
  ('20261021130000 communauté',        'table community_message_reactions',    to_regclass('public.community_message_reactions') IS NOT NULL),
  ('20261021130000 communauté',        'rôle co_founder dans app_role',        EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'co_founder')),
  ('20261021140000 bibliothèque',      'table generated_images',               to_regclass('public.generated_images') IS NOT NULL),
  ('20261021150000 boutique restreinte','fonctions (has_shop_role, is_shop_owner, is_shop_collaborator, get_shop_orders_secure, push_order_to_delivery_provider)',
        (SELECT count(*) FROM f WHERE name IN ('has_shop_role','is_shop_owner','is_shop_collaborator','get_shop_orders_secure','push_order_to_delivery_provider')) = 5),
  ('20261021150000 / 22100000 / 22110000 livraison','tables order_deliveries, delivery_company_members, delivery_providers, shop_delivery_connections, delivery_zones, delivery_driver_zones',
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('order_deliveries','delivery_company_members','delivery_providers','shop_delivery_connections','delivery_zones','delivery_driver_zones')) = 6),
  ('20261021150000 / 22100000 / 22110000 livraison','vue delivery_providers_public', to_regclass('public.delivery_providers_public') IS NOT NULL),
  ('20261022120000 paniers',           'fonctions is_shop_publicly_visible, check_rate_limit, upsert_abandoned_cart, mark_abandoned_cart_converted',
        (SELECT count(*) FROM f WHERE name IN ('is_shop_publicly_visible','check_rate_limit','upsert_abandoned_cart','mark_abandoned_cart_converted')) = 4),
  ('20261022120000 paniers',           'tables abandoned_carts, products, orders',
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('abandoned_carts','products','orders')) = 3),
  ('20261022130000 codes promo',       '12 fonctions (create_public_order, guard_public_order_insert, enforce_order_item_price, recompute_order_totals, is_shop_owner, is_shop_owner_or_collaborator, is_shop_publicly_visible, check_rate_limit, has_role, generate_order_number, validate_promo_code, increment_promo_usage)',
        (SELECT count(*) FROM f WHERE name IN ('create_public_order','guard_public_order_insert','enforce_order_item_price','recompute_order_totals','is_shop_owner','is_shop_owner_or_collaborator','is_shop_publicly_visible','check_rate_limit','has_role','generate_order_number','validate_promo_code','increment_promo_usage')) = 12),
  ('20261022130000 codes promo',       'promo_codes sans remise hors bornes (0 attendu)',
        CASE WHEN to_regclass('public.promo_codes') IS NULL THEN false ELSE NOT EXISTS (SELECT 1 FROM public.promo_codes WHERE discount_percentage <= 0 OR discount_percentage > 100) END),
  ('20261022130000 codes promo',       'promo_codes sans doublon de casse',
        CASE WHEN to_regclass('public.promo_codes') IS NULL THEN false ELSE NOT EXISTS (SELECT 1 FROM public.promo_codes GROUP BY upper(code) HAVING count(*) > 1) END),
  ('ECOMFY PAY (20261022140000, 20261023100000 confirm)','tables wallets, wallet_ledger, ecomfy_payments, settlements, withdrawal_requests',
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('wallets','wallet_ledger','ecomfy_payments','settlements','withdrawal_requests')) = 5),
  ('ECOMFY PAY (20261022140000, 20261023100000 confirm)','fonctions request_wallet_withdrawal_atomic, credit_merchant_wallet_pending',
        (SELECT count(*) FROM f WHERE name IN ('request_wallet_withdrawal_atomic','credit_merchant_wallet_pending')) = 2),
  ('20261022150000 références',        'système de facturation par seuil (shop_invoices) — info : absent = n''appliquer que la partie 3', to_regclass('public.shop_invoices') IS NOT NULL),
  ('20261023100000 seo produit',       'table products',                       to_regclass('public.products') IS NOT NULL),
  ('20261023110000 résumé hebdo',      'fonction invoke_edge_function',        EXISTS (SELECT 1 FROM f WHERE name = 'invoke_edge_function')),
  ('20261023120000 / 130000 / 140000 facturation','H7 en place (apply_commission_payment avec verrou)',
        COALESCE((SELECT pg_get_functiondef(p.oid) LIKE '%pg_advisory_xact_lock%' FROM pg_proc p WHERE p.proname = 'apply_commission_payment' AND p.pronamespace = 'public'::regnamespace LIMIT 1), false)),
  ('20261023120000 / 130000 / 140000 facturation','fonction enforce_shop_payment_state_for',
        EXISTS (SELECT 1 FROM f WHERE name = 'enforce_shop_payment_state_for')),
  ('20261023150000 seuil',             'facturation par seuil déployée (shop_invoices) — absent = NE PAS appliquer', to_regclass('public.shop_invoices') IS NOT NULL),
  ('20261023160000 avis',              'tables product_reviews, products, shops',
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('product_reviews','products','shops')) = 3),
  ('20261024100000 preuve sociale',    'fonction get_shop_social_proof_orders', EXISTS (SELECT 1 FROM f WHERE name = 'get_shop_social_proof_orders')),
  ('20261025100000 garde shops',       'table shops',                          to_regclass('public.shops') IS NOT NULL)
)
SELECT '1. prérequis' AS section, migration, requis, ok FROM chk ORDER BY migration, requis;

-- ============================================================================================================
-- 2. DÉJÀ APPLIQUÉ ? (empreintes ; true = la migration a déjà produit son effet)
-- ============================================================================================================
SELECT '2. déjà appliqué ?' AS section, migration, deja_applique FROM (VALUES
  ('20261019120000 abonnement',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='is_subscribed')),
  ('20261020120000 affiliation',    COALESCE((SELECT pg_get_functiondef(p.oid) LIKE '%ne correspond pas%' FROM pg_proc p WHERE p.proname = 'mark_affiliate_payout_paid' AND p.pronamespace = 'public'::regnamespace LIMIT 1), false)),
  ('20261021120000 SEO jetons',     CASE WHEN to_regclass('public.shop_seo_connections') IS NULL THEN false
                                         ELSE NOT has_column_privilege('authenticated', 'public.shop_seo_connections', 'google_refresh_token', 'SELECT') END),
  ('20261021130000 communauté',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_messages' AND column_name='kind')),
  ('20261021140000 bibliothèque',   EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_images' AND policyname='Users can update their own images')),
  ('20261021150000 boutique restreinte', EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_shop_restricted' AND pronamespace='public'::regnamespace)),
  ('20261022110000 contacts livreurs',   EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_delivery_driver_contacts' AND pronamespace='public'::regnamespace)),
  ('20261022120000 paniers',        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='abandoned_carts' AND column_name='customer_country')),
  ('20261022130000 codes promo',    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promo_codes' AND column_name='shop_id')),
  ('20261022140000 ledger',         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallet_ledger' AND column_name='entry_seq')),
  ('20261023100000 confirm Ecomfy Pay', EXISTS (SELECT 1 FROM pg_proc WHERE proname='confirm_ecomfy_payment' AND pronamespace='public'::regnamespace)),
  ('20261023100000 seo produit',    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='seo_title')),
  ('20261023130000 temps réel shops', EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='shops')),
  ('20261023140000 échéances',      EXISTS (SELECT 1 FROM pg_proc WHERE proname='enforce_all_shop_payment_states' AND pronamespace='public'::regnamespace)),
  ('20261023160000 avis',           EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_product_reviews_guard' AND NOT tgisinternal)),
  ('20261025100000 garde shops',    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_guard_shop_billing_columns' AND NOT tgisinternal))
) AS t(migration, deja_applique) ORDER BY migration;

-- ============================================================================================================
-- 3. ENVIRONNEMENT (tâches planifiées)
-- ============================================================================================================
SELECT '3. environnement' AS section, element, valeur FROM (VALUES
  ('pg_cron installé',                      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')::text),
  ('supabase_vault installé',               EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault')::text),
  ('secrets Vault attendus présents (3 attendus : supabase_project_url, cron_secret, email_queue_service_role_key)',
        (SELECT count(*) FROM vault.secrets WHERE name IN ('supabase_project_url','cron_secret','email_queue_service_role_key'))::text),
  ('comptes sans profil (0 attendu)',       (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id))::text),
  ('boutiques en retard de paiement (seront verrouillées par 20261023140000)',
        (SELECT count(*) FROM public.shops s, LATERAL (SELECT to_jsonb(s) AS j) x
          WHERE COALESCE(s.commission_balance_due,0) > 0
            AND ((s.shop_payment_status = 'payment_pending' AND (x.j->>'first_deadline_at')::timestamptz < now())
              OR (s.shop_payment_status = 'locked' AND (x.j->>'second_deadline_at')::timestamptz < now()
                  AND NOT (COALESCE((x.j->>'extra_deadline_active')::boolean, false)
                           AND (x.j->>'extra_deadline_ends_at')::timestamptz > now()))))::text),
  ('boutiques à abonnement déjà échu (ignorées par conception)',
        (SELECT count(*) FROM public.shops s WHERE (to_jsonb(s)->>'subscription_active_until')::timestamptz < now())::text)
) AS t(element, valeur);

-- ============================================================================================================
-- 4. TÂCHES PLANIFIÉES EXISTANTES (à lancer SEULEMENT si pg_cron est installé : section 3)
-- ============================================================================================================
-- select jobname, schedule, active from cron.job order by jobname;
-- Attendu avant déploiement : pas de 'weekly-finance-summary', 'enforce-subscription-expiry', 'enforce-shop-payment-deadlines'.
-- Noter aussi qui appelle ecomfy-pay-settlement (aucune planification dans le dépôt).
