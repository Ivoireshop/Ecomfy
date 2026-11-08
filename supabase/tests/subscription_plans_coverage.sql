-- Tests des grilles d'abonnement paramétrables, de la couverture par compte (N boutiques les plus anciennes)
-- et des réglages de commission (migration 20261107100000_subscription_plans_settings.sql).
--
-- Base JETABLE uniquement (jamais la base de dev ou de prod). Le schéma de départ est celui du test
-- subscription_activation_and_expiry.sql (état de la production du 22/10/2026), puis les migrations 20261019120000 et
-- 20261107100000 sont appliquées, puis les cas ci-dessous.
--
--   docker run -d --rm --name plans-pgtest -e POSTGRES_PASSWORD=test postgres:17-alpine
--   (sed -n '1,/^-- ====== FIN DU SCHÉMA/p' supabase/tests/subscription_activation_and_expiry.sql;
--    cat supabase/migrations/20261019120000_fix_subscription_activation_and_expiry.sql;
--    cat supabase/migrations/20261107100000_subscription_plans_settings.sql;
--    sed -n '1,/^-- ====== REJEU/p' supabase/tests/subscription_plans_coverage.sql;
--    cat supabase/migrations/20261107100000_subscription_plans_settings.sql;
--    sed -n '/^-- ====== REJEU/,$p' supabase/tests/subscription_plans_coverage.sql) \
--   | docker exec -i plans-pgtest psql -U postgres -v ON_ERROR_STOP=1 -P pager=off
-- Chaque cas affiche « OK : ... » ; toute erreur arrête le script.
-- La migration est rejouée une seconde fois avant les derniers cas (idempotence).

\set ON_ERROR_STOP on
SET lc_messages = 'C';

CREATE FUNCTION public.t_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; RAISE NOTICE 'OK : %', msg; END $$;
CREATE FUNCTION public.t_login(p uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', p::text, false) $$;

-- Acteurs : un fondateur, trois marchands
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000000f0', 'founder');

-- Marchand 2 : trois boutiques (la plus ancienne en premier)
INSERT INTO public.shops (id, user_id, business_name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-000000000002', 'M2 boutique 1', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-000000000002', 'M2 boutique 2', now() - interval '20 days'),
  ('00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-000000000002', 'M2 boutique 3', now() - interval '10 days');
-- Marchand 3 : trois boutiques, il paiera depuis la plus récente
INSERT INTO public.shops (id, user_id, business_name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-000000000003', 'M3 boutique 1', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-000000000003', 'M3 boutique 2', now() - interval '20 days'),
  ('00000000-0000-0000-0000-0000000003a3', '00000000-0000-0000-0000-000000000003', 'M3 boutique 3', now() - interval '10 days');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Données de départ et droits
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_assert((SELECT count(*) FROM public.subscription_plans) = 3, 'trois plans de départ');
SELECT public.t_assert((SELECT price_monthly = 12000 AND price_annual = 118800 AND max_shops = 3 FROM public.subscription_plans WHERE code = 'pro_monthly'),
                       'pro_monthly : 12 000 / 118 800, 3 boutiques incluses');
SELECT public.t_assert((SELECT value = '50'::jsonb FROM public.billing_settings WHERE key = 'commission_per_order'), 'commission de départ : 50');
SELECT public.t_assert(public.subscription_grace_interval() = interval '3 days', 'délai de grâce de départ : 3 jours');

SET ROLE anon;
SELECT public.t_assert((SELECT count(*) FROM public.subscription_plans) = 3, 'un visiteur lit les plans');
DO $$ BEGIN
  INSERT INTO public.subscription_plans (code, name, price_monthly) VALUES ('hack', 'Hack', 200);
  RAISE EXCEPTION 'ÉCHEC : un visiteur écrit un plan';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : un visiteur ne peut pas écrire un plan'; END $$;
RESET ROLE;

SELECT public.t_login('00000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
DO $$ BEGIN
  UPDATE public.subscription_plans SET price_monthly = 200;
  RAISE EXCEPTION 'ÉCHEC : un marchand modifie un plan';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : un marchand ne peut pas modifier un plan'; END $$;
DO $$ BEGIN
  UPDATE public.billing_settings SET value = '0'::jsonb;
  RAISE EXCEPTION 'ÉCHEC : un marchand modifie la commission';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : un marchand ne peut pas modifier un réglage'; END $$;
DO $$ BEGIN
  PERFORM public.apply_shop_subscription('00000000-0000-0000-0000-0000000002a1', NULL, 'pro_monthly', 12000, 'X-HACK', 'geniuspay', NULL);
  RAISE EXCEPTION 'ÉCHEC : un marchand s''abonne gratuitement';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : apply_shop_subscription reste réservée à service_role'; END $$;
DO $$ BEGIN
  PERFORM public.apply_subscription_coverage('00000000-0000-0000-0000-000000000002', true);
  RAISE EXCEPTION 'ÉCHEC : un marchand déclenche la couverture';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : apply_subscription_coverage réservée à service_role'; END $$;
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"X","price_monthly":200}'::jsonb)->>'error') = 'forbidden',
                       'un marchand ne peut pas enregistrer un plan');
SELECT public.t_assert((public.founder_save_billing_settings('{"commission_per_order": 0}'::jsonb)->>'error') = 'forbidden',
                       'un marchand ne peut pas enregistrer un réglage');
SELECT public.t_assert((public.founder_subscription_overview()->>'error') = 'forbidden', 'l''aperçu est réservé aux fondateurs');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Le fondateur règle les plans
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SET ROLE authenticated;
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Pro","price_monthly":100}'::jsonb)->>'error') = 'invalid_price',
                       'prix mensuel sous 200 FCFA refusé');
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Pro","price_monthly":10000,"price_annual":20000}'::jsonb)->>'error') = 'invalid_price',
                       'prix annuel sous 5 fois le mensuel refusé');
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Pro","price_monthly":12000,"max_shops":500}'::jsonb)->>'error') = 'invalid_max_shops',
                       'plus de 100 boutiques refusé');
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"free","name":"Gratuit","price_monthly":300}'::jsonb)->>'error') = 'invalid_code',
                       'le code « free » est réservé');
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Ecomfy Pro","price_monthly":12000,"price_annual":118800,"max_shops":2,"ai_video_quota":10,"ai_image_quota":20,"features":["A","B"]}'::jsonb)->>'success')::boolean,
                       'le fondateur enregistre pro_monthly à 2 boutiques incluses');
SELECT public.t_assert((SELECT max_shops = 2 FROM public.subscription_plans WHERE code = 'pro_monthly'), 'max_shops = 2 en base');
SELECT public.t_assert((SELECT count(*) = 1 FROM public.billing_config_audit WHERE kind = 'plan' AND key = 'pro_monthly'
                          AND (old_value->>'max_shops')::int = 3 AND (new_value->>'max_shops')::int = 2),
                       'modification journalisée (ancienne et nouvelle valeur)');
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"vip_test","name":"VIP test","price_monthly":5000,"price_annual":50000,"max_shops":5,"is_public":false}'::jsonb)->>'success')::boolean,
                       'le fondateur crée un nouveau plan');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Couverture : plan à 2 boutiques, compte à 3 boutiques
-- ---------------------------------------------------------------------------------------------------------------
-- Marchand 2 paie depuis sa boutique la plus ancienne
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-000000000002',
                                                      'pro_monthly', 12000, 'REF-M2-1', 'geniuspay', 'monthly')->>'success')::boolean,
                       'M2 : abonnement pro_monthly');
SELECT public.t_assert((SELECT bool_and(is_subscribed AND subscription_active_until > now() AND commission_rate = 0)
                          FROM public.shops WHERE id IN ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002a2')),
                       'M2 : les 2 plus anciennes boutiques sont couvertes');
SELECT public.t_assert((SELECT NOT COALESCE(is_subscribed, false) AND commission_rate > 0 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a3'),
                       'M2 : la 3e boutique n''est pas couverte');
SELECT public.t_assert((SELECT plan_code = 'pro_monthly' FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000002'),
                       'M2 : plan enregistré sur le compte');

INSERT INTO public.orders (shop_id, total) SELECT '00000000-0000-0000-0000-0000000002a1', 1000 FROM generate_series(1, 4);
INSERT INTO public.orders (shop_id, total) SELECT '00000000-0000-0000-0000-0000000002a3', 1000 FROM generate_series(1, 4);
SELECT public.t_assert((SELECT commission_balance_due = 0 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a1'),
                       'M2 : boutique couverte, 4 commandes, 0 commission');
SELECT public.t_assert((SELECT commission_balance_due = 200 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a3'),
                       'M2 : boutique non couverte, 4 commandes, 4 x 50 = 200 FCFA de commission');

-- Marchand 3 paie depuis sa boutique la plus récente (hors des 2 incluses) : rien n'est effacé sur elle
UPDATE public.shops SET commission_balance_due = 350 WHERE id = '00000000-0000-0000-0000-0000000003a3';
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-0000000003a3', '00000000-0000-0000-0000-000000000003',
                                                      'pro_monthly', 12000, 'REF-M3-1', 'geniuspay', 'monthly')->>'target_covered')::boolean = false,
                       'M3 : paiement depuis une boutique hors plan, signalé comme non couverte');
SELECT public.t_assert((SELECT commission_balance_due = 350 AND NOT COALESCE(is_subscribed, false) FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000003a3'),
                       'M3 : le solde de la boutique hors plan est conservé');
SELECT public.t_assert((SELECT bool_and(is_subscribed) FROM public.shops WHERE id IN ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003a2')),
                       'M3 : ses 2 plus anciennes boutiques sont couvertes');

-- Une nouvelle boutique n'est couverte que s'il reste de la place
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000002a4', '00000000-0000-0000-0000-000000000002', 'M2 boutique 4');
SELECT public.t_assert((SELECT NOT COALESCE(is_subscribed, false) FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a4'),
                       'M2 : une 4e boutique n''est pas couverte (plan plein)');

-- Marchand 4 : une boutique, plan à 2 -> la 2e boutique hérite, la 3e non
INSERT INTO public.shops (id, user_id, business_name, created_at) VALUES ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-000000000004', 'M4 boutique 1', now() - interval '5 days');
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-000000000004', 'pro_monthly', 12000, 'REF-M4-1', 'geniuspay', 'monthly');
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000004a2', '00000000-0000-0000-0000-000000000004', 'M4 boutique 2');
SELECT public.t_assert((SELECT is_subscribed AND subscription_active_until > now() AND commission_rate = 0 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000004a2'),
                       'M4 : la 2e boutique hérite de l''abonnement (il reste de la place)');
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000004a3', '00000000-0000-0000-0000-000000000004', 'M4 boutique 3');
SELECT public.t_assert((SELECT NOT COALESCE(is_subscribed, false) FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000004a3'),
                       'M4 : la 3e boutique n''hérite pas (plan plein)');
-- Un compte sans abonnement n'hérite de rien
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000005', 'M5 boutique 1');
SELECT public.t_assert((SELECT NOT COALESCE(is_subscribed, false) AND subscription_active_until IS NULL FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000005a1'),
                       'M5 : compte non abonné, boutique à la commission');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Hausse puis baisse de la limite
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SET ROLE authenticated;
SELECT public.t_assert((public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Ecomfy Pro","price_monthly":12000,"price_annual":118800,"max_shops":3}'::jsonb)->>'accounts_resynced')::int = 3,
                       'hausse à 3 boutiques : 3 comptes abonnés re-synchronisés');
RESET ROLE;
SELECT public.t_assert((SELECT is_subscribed AND commission_rate = 0 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a3'),
                       'hausse : la 3e boutique de M2 est couverte aussitôt');
SELECT public.t_assert((SELECT NOT COALESCE(is_subscribed, false) FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a4'),
                       'hausse : la 4e boutique de M2 reste hors plan');

SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SET ROLE authenticated;
SELECT public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Ecomfy Pro","price_monthly":12000,"price_annual":118800,"max_shops":1}'::jsonb);
RESET ROLE;
SELECT public.t_assert((SELECT count(*) = 3 FROM public.shops WHERE user_id = '00000000-0000-0000-0000-000000000002' AND is_subscribed),
                       'baisse à 1 : aucune couverture payée n''est retirée sur le champ');

SELECT public.t_assert(jsonb_array_length(public.apply_shop_subscription('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-000000000002',
                                                      'pro_monthly', 12000, 'REF-M2-2', 'geniuspay', 'monthly')->'uncovered_shop_ids') = 2,
                       'baisse à 1 : au renouvellement, 2 boutiques repassent à la commission');
SELECT public.t_assert((SELECT is_subscribed FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a1')
                   AND (SELECT NOT COALESCE(is_subscribed, false) AND subscription_active_until IS NULL AND commission_rate > 0
                          FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a3'),
                       'baisse à 1 : la plus ancienne reste couverte, les autres reviennent à la commission');
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-0000000002a3') = 'none',
                       'une boutique retirée du plan n''est pas traitée comme un abonnement échu (pas de fermeture)');
INSERT INTO public.orders (shop_id, total) VALUES ('00000000-0000-0000-0000-0000000002a3', 1000);
SELECT public.t_assert((SELECT commission_balance_due = 250 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000002a3'),
                       'une boutique retirée du plan paie de nouveau 50 FCFA par commande');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Durée mensuelle / annuelle quand les prix changent
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SET ROLE authenticated;
SELECT public.founder_save_subscription_plan('{"code":"pro_monthly","name":"Ecomfy Pro","price_monthly":10000,"price_annual":60000,"max_shops":3}'::jsonb);
RESET ROLE;
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-000000000006', 'M6');
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-000000000007', 'M7');
INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-000000000008', 'M8');
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-0000000006a1', NULL, 'pro_monthly', 60000, 'REF-ANN', 'geniuspay', NULL);
SELECT public.t_assert((SELECT subscription_active_until > now() + interval '364 days' FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000006a1'),
                       'prix annuel 60 000 (modifié) sans cycle transmis : 365 jours');
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-0000000007a1', NULL, 'pro_monthly', 10000, 'REF-MENS', 'geniuspay', NULL);
SELECT public.t_assert((SELECT subscription_active_until BETWEEN now() + interval '29 days' AND now() + interval '31 days' FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000007a1'),
                       'prix mensuel 10 000 (modifié) sans cycle transmis : 30 jours');
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-0000000008a1', NULL, 'pro_monthly', 60000, 'REF-ANN2', 'geniuspay', 'monthly');
SELECT public.t_assert((SELECT subscription_active_until < now() + interval '31 days' FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000008a1'),
                       'le cycle transmis par le paiement l''emporte sur le montant');
-- Rejouer la même référence ne prolonge pas
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-0000000007a1', NULL, 'pro_monthly', 10000, 'REF-MENS', 'geniuspay', NULL)->>'already_applied')::boolean,
                       'même référence : déjà appliquée');

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Commission, seuil et délais paramétrables
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SET ROLE authenticated;
SELECT public.t_assert((public.founder_save_billing_settings('{"commission_per_order": -5}'::jsonb)->>'error') = 'out_of_range', 'commission négative refusée');
SELECT public.t_assert((public.founder_save_billing_settings('{"commission_per_order": "abc"}'::jsonb)->>'error') = 'invalid_number', 'commission non numérique refusée');
SELECT public.t_assert((public.founder_save_billing_settings('{"inconnu": 1}'::jsonb)->>'error') = 'unknown_setting', 'réglage inconnu refusé');
SELECT public.t_assert((public.founder_save_billing_settings('{"commission_per_order": 40, "commission_threshold": 200, "payment_deadline_days": 5, "subscription_grace_days": 7}'::jsonb)->>'success')::boolean,
                       'le fondateur règle commission 40, seuil 200, délai 5 jours, grâce 7 jours');
RESET ROLE;
SELECT public.t_assert((SELECT bool_and(commission_per_order = 40 AND commission_threshold = 200) FROM public.shops),
                       'toutes les boutiques suivent le nouveau montant et le nouveau seuil');
SELECT public.t_assert(public.subscription_grace_interval() = interval '7 days', 'délai de grâce abonnement : 7 jours');
SELECT public.t_assert((SELECT count(*) = 4 FROM public.billing_config_audit WHERE kind = 'setting'), 'quatre réglages journalisés');

INSERT INTO public.shops (id, user_id, business_name) VALUES ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-000000000009', 'M9 nouvelle');
SELECT public.t_assert((SELECT commission_per_order = 40 AND commission_threshold = 200 FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000009a1'),
                       'une nouvelle boutique naît avec le montant et le seuil du moment');

UPDATE public.shops SET commission_balance_due = 0, shop_payment_status = 'active', payment_deadline = NULL WHERE id = '00000000-0000-0000-0000-0000000009a1';
INSERT INTO public.orders (shop_id, total) SELECT '00000000-0000-0000-0000-0000000009a1', 1000 FROM generate_series(1, 5);
SELECT public.t_assert((SELECT commission_balance_due = 200 AND shop_payment_status = 'payment_pending' FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000009a1'),
                       '5 commandes x 40 = 200 : seuil atteint, paiement demandé');
SELECT public.t_assert((SELECT first_deadline_at BETWEEN now() + interval '4 days 23 hours' AND now() + interval '5 days 1 hour' FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000009a1'),
                       'échéance de paiement = 5 jours (réglage)');
SELECT public.t_assert((SELECT note LIKE 'Seuil de 200 FCFA atteint - 5 jours%' FROM public.shop_payment_events
                          WHERE shop_id = '00000000-0000-0000-0000-0000000009a1' AND event_type = 'threshold_reached'),
                       'le message du journal reprend le seuil et le délai réels');

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Lectures pour les écrans
-- ---------------------------------------------------------------------------------------------------------------
SELECT public.t_login('00000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
SELECT public.t_assert((public.get_my_shop_coverage()->>'subscription_active')::boolean
                   AND (public.get_my_shop_coverage()->>'max_shops')::int = 3
                   AND jsonb_array_length(public.get_my_shop_coverage()->'shops') = 4
                   AND (public.get_my_shop_coverage()->>'commission_per_order')::int = 40,
                       'get_my_shop_coverage : plan, limite, 4 boutiques, commission');
SELECT public.t_login('00000000-0000-0000-0000-000000000005');
SELECT public.t_assert(NOT (public.get_my_shop_coverage()->>'subscription_active')::boolean, 'get_my_shop_coverage : compte non abonné');
SELECT public.t_login('00000000-0000-0000-0000-0000000000f0');
SELECT public.t_assert((public.founder_subscription_overview()->>'success')::boolean
                   AND (SELECT (e->>'active_accounts')::int >= 3 FROM jsonb_array_elements(public.founder_subscription_overview()->'plans') e WHERE e->>'code' = 'pro_monthly'),
                       'aperçu fondateur : abonnés par plan');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 7b. Boutique hors des boutiques incluses : à l'échéance, commission au lieu de fermeture
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscription_enforcement_start() RETURNS timestamptz LANGUAGE sql IMMUTABLE
AS $$ SELECT '2026-01-01'::timestamptz $$;
INSERT INTO public.subscription_plans (code, name, price_monthly, max_shops) VALUES ('solo_test', 'Solo', 5000, 1);

INSERT INTO public.shops (id, user_id, business_name, created_at, subscription_plan, subscription_active_until, is_subscribed, commission_rate) VALUES
  ('00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-000000000010', 'M10 incluse', now() - interval '30 days', 'solo_test', now() - interval '4 days', true, 0),
  ('00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-000000000010', 'M10 hors plan', now() - interval '20 days', 'solo_test', now() - interval '4 days', true, 0);
INSERT INTO public.subscriptions (user_id, status, plan_code, end_date) VALUES ('00000000-0000-0000-0000-000000000010', 'active', 'solo_test', now() - interval '4 days');

SELECT public.t_assert(NOT public.shop_is_beyond_plan_limit('00000000-0000-0000-0000-0000000010a1') AND public.shop_is_beyond_plan_limit('00000000-0000-0000-0000-0000000010a2'),
                       'rang 1 dans le plan, rang 2 hors du plan (1 boutique incluse)');
SELECT public.t_assert(NOT public.shop_is_beyond_plan_limit('00000000-0000-0000-0000-0000000005a1'), 'compte sans plan connu : jamais hors plan');
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-0000000010a2') = 'expired', 'échéance d''une boutique hors plan : constatée');
SELECT public.t_assert((SELECT subscription_plan = 'free' AND subscription_active_until IS NULL AND NOT is_subscribed AND commission_rate > 0
                          AND shop_payment_status = 'active' AND NOT is_suspended FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000010a2'),
                       'boutique hors plan échue : commission rétablie, aucune fermeture');
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-0000000010a1') IN ('expired', 'locked'),
                       'boutique incluse échue : traitée normalement');
SELECT public.t_assert((SELECT shop_payment_status = 'active' AND NOT is_subscribed FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000010a1'),
                       'boutique incluse échue : taux rétabli, délai de grâce (7 jours) pas encore écoulé');

-- Boutique hors plan déjà fermée pour abonnement échu : le propriétaire la repasse à la commission
INSERT INTO public.shops (id, user_id, business_name, created_at, subscription_plan, subscription_active_until, is_subscribed, commission_rate,
                          shop_payment_status, is_suspended, locked_at, commission_balance_due) VALUES
  ('00000000-0000-0000-0000-0000000011a1', '00000000-0000-0000-0000-000000000011', 'M11 incluse', now() - interval '30 days', 'free', NULL, false, 0.025, 'active', false, NULL, 0),
  ('00000000-0000-0000-0000-0000000011a2', '00000000-0000-0000-0000-000000000011', 'M11 hors plan fermée', now() - interval '20 days', 'solo_test', now() - interval '10 days', false, 0.025, 'locked', true, now() - interval '3 days', 100);
INSERT INTO public.subscriptions (user_id, status, plan_code, end_date) VALUES ('00000000-0000-0000-0000-000000000011', 'active', 'solo_test', now() + interval '20 days');

SELECT public.t_login('00000000-0000-0000-0000-000000000011');
SET ROLE authenticated;
SELECT public.t_assert((SELECT (s->>'within_plan')::boolean FROM jsonb_array_elements(public.get_my_shop_coverage()->'shops') s WHERE s->>'id' = '00000000-0000-0000-0000-0000000011a1')
                   AND NOT (SELECT (s->>'within_plan')::boolean FROM jsonb_array_elements(public.get_my_shop_coverage()->'shops') s WHERE s->>'id' = '00000000-0000-0000-0000-0000000011a2'),
                       'get_my_shop_coverage : within_plan par boutique');
SELECT public.t_assert(public.release_shop_to_commission('00000000-0000-0000-0000-0000000011a1') = 'covered', 'boutique incluse : rien à libérer');
SELECT public.t_login('00000000-0000-0000-0000-000000000010');
SELECT public.t_assert(public.release_shop_to_commission('00000000-0000-0000-0000-0000000011a2') = 'forbidden', 'un autre marchand ne peut pas libérer la boutique');
SELECT public.t_login('00000000-0000-0000-0000-000000000011');
SELECT public.t_assert(public.release_shop_to_commission('00000000-0000-0000-0000-0000000011a2') = 'released', 'le propriétaire repasse sa boutique hors plan à la commission');
RESET ROLE;
SELECT public.t_assert((SELECT shop_payment_status = 'active' AND NOT is_suspended AND locked_at IS NULL AND subscription_plan = 'free' AND subscription_active_until IS NULL
                          FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000011a2'),
                       'boutique libérée : rouverte, commission par commande');

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Rejouer la migration ne change rien (idempotence)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE before_replay AS
  SELECT (SELECT count(*) FROM public.subscription_plans) AS plans, (SELECT max_shops FROM public.subscription_plans WHERE code = 'pro_monthly') AS max_shops,
         (SELECT value FROM public.billing_settings WHERE key = 'commission_per_order') AS commission;
-- ====== REJEU DE LA MIGRATION : intercaler ici le fichier de migration (voir la commande en tête) ======
SELECT public.t_assert((SELECT b.plans = (SELECT count(*) FROM public.subscription_plans)
                          AND b.max_shops = (SELECT max_shops FROM public.subscription_plans WHERE code = 'pro_monthly')
                          AND b.commission = (SELECT value FROM public.billing_settings WHERE key = 'commission_per_order')
                          FROM before_replay b),
                       'migration rejouée : plans et réglages modifiés par le fondateur conservés');
SELECT public.t_assert((SELECT count(*) = 1 FROM pg_proc WHERE proname = 'apply_shop_subscription'), 'une seule version de apply_shop_subscription (pas de surcharge ambiguë)');
