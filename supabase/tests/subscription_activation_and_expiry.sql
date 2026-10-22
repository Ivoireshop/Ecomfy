-- Tests du correctif « abonnement payé non appliqué / fin d'abonnement non gérée »
-- (migration 20261019120000_fix_subscription_activation_and_expiry.sql).
--
-- Base JETABLE uniquement (jamais la base de dev ou de prod). Le schéma ci-dessous reproduit l'ÉTAT DE LA PRODUCTION
-- du 22/10/2026 : pas de colonne is_subscribed ni extra_deadline_*, trigger sync_shop_order_stats de 20260701091528,
-- apply_shop_subscription de H7 (20261015130000), droits C2 (service_role seul).
--
--   docker run -d --rm --name sub-pgtest -e POSTGRES_PASSWORD=test postgres:17-alpine
--   (sed -n '1,/^-- ====== FIN DU SCHÉMA/p' supabase/tests/subscription_activation_and_expiry.sql;
--    cat supabase/migrations/20261019120000_fix_subscription_activation_and_expiry.sql;
--    sed -n '/^-- ====== FIN DU SCHÉMA/,$p' supabase/tests/subscription_activation_and_expiry.sql) \
--   | docker exec -i sub-pgtest psql -U postgres -v ON_ERROR_STOP=1 -P pager=off
-- Chaque cas affiche « OK : ... » ; toute erreur arrête le script.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role;

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, business_name text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now(),
  total_orders integer DEFAULT 0, total_sales numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0.025, commission_per_order numeric NOT NULL DEFAULT 50,
  commission_threshold numeric NOT NULL DEFAULT 12000, commission_balance_due numeric NOT NULL DEFAULT 0,
  payment_deadline timestamptz, is_suspended boolean NOT NULL DEFAULT false,
  shop_payment_status text NOT NULL DEFAULT 'active',
  threshold_reached_at timestamptz, first_deadline_at timestamptz, locked_at timestamptz,
  second_deadline_at timestamptz, final_suspension_at timestamptz,
  subscription_plan text NOT NULL DEFAULT 'free', subscription_started_at timestamptz,
  subscription_active_until timestamptz,
  CONSTRAINT shops_payment_status_check CHECK (shop_payment_status IN ('active','payment_pending','locked','final_suspension'))
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, amount numeric NOT NULL,
  payment_method text, transaction_reference text, status text, created_by uuid NOT NULL, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX commission_payments_transaction_reference_unique
  ON public.commission_payments (transaction_reference) WHERE transaction_reference IS NOT NULL;
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status text, plan text, amount numeric,
  start_date timestamptz, end_date timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.shop_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type text NOT NULL, amount numeric DEFAULT 0, note text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- sync_shop_order_stats tel que déployé en production (20260701091528)
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_shop_id uuid; v_per_order numeric; v_threshold numeric; v_new_balance numeric;
  v_current_deadline timestamptz; v_sub_until timestamptz; v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN target_shop_id := OLD.shop_id; ELSE target_shop_id := NEW.shop_id; END IF;
  UPDATE shops SET total_orders = (SELECT COUNT(*) FROM orders WHERE shop_id = target_shop_id),
    total_sales = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE shop_id = target_shop_id), updated_at = now()
  WHERE id = target_shop_id;
  IF TG_OP = 'INSERT' THEN
    SELECT commission_per_order, commission_threshold, payment_deadline, subscription_active_until, shop_payment_status
      INTO v_per_order, v_threshold, v_current_deadline, v_sub_until, v_status FROM shops WHERE id = target_shop_id;
    IF v_sub_until IS NOT NULL AND v_sub_until > now() THEN RETURN NEW; END IF;
    UPDATE shops SET commission_balance_due = COALESCE(commission_balance_due, 0) + COALESCE(v_per_order, 50)
      WHERE id = target_shop_id RETURNING commission_balance_due INTO v_new_balance;
    IF v_new_balance >= COALESCE(v_threshold, 12000) AND v_current_deadline IS NULL AND v_status = 'active' THEN
      UPDATE shops SET payment_deadline = now() + interval '3 days', threshold_reached_at = now(),
        first_deadline_at = now() + interval '3 days', shop_payment_status = 'payment_pending' WHERE id = target_shop_id;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_shop_order_stats AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_shop_order_stats();

-- apply_shop_subscription tel que déployé en production (H7 20261015130000) : écrit shops.is_subscribed
CREATE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL, p_plan text DEFAULT 'pro_monthly',
  p_amount numeric DEFAULT 0, p_transaction_reference text DEFAULT NULL, p_payment_method text DEFAULT 'geniuspay'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.shops SET subscription_plan = lower(p_plan), subscription_active_until = now() + interval '30 days',
         is_subscribed = true, commission_rate = 0, commission_balance_due = 0 WHERE id = p_shop_id;
  RETURN jsonb_build_object('success', true);
END $$;
REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) TO service_role;

-- Reproduction du bug : avant le correctif, l'abonnement plante sur la colonne manquante.
INSERT INTO public.shops (id, user_id, business_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Avant correctif');
DO $$
BEGIN
  PERFORM public.apply_shop_subscription('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
                                         'pro_monthly', 12000, 'REF-AVANT');
  RAISE EXCEPTION 'le bug de production n''est pas reproduit';
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'OK : avant correctif, apply_shop_subscription échoue (colonne is_subscribed absente)';
END $$;
DELETE FROM public.shops;
DROP FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text);
-- on repart d'une fonction vide de même signature et mêmes droits, comme CREATE OR REPLACE les trouvera en production
CREATE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL, p_plan text DEFAULT 'pro_monthly',
  p_amount numeric DEFAULT 0, p_transaction_reference text DEFAULT NULL, p_payment_method text DEFAULT 'geniuspay'
) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) TO service_role;

-- Anciens abonnés : échus longtemps AVANT le correctif (doivent rester ignorés) et boutique sans abonnement
INSERT INTO public.shops (id, user_id, business_name, subscription_plan, subscription_active_until, commission_balance_due) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'Ancien abonné échu',
   'starter', now() - interval '60 days', 300),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2', 'Jamais abonné', 'free', NULL, 100);

-- ====== FIN DU SCHÉMA ==========================================================================================

\set ON_ERROR_STOP on
SET lc_messages = 'C';

-- Raccourcis de test
CREATE FUNCTION public.t_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; RAISE NOTICE 'OK : %', msg; END $$;

-- Boutiques de test
INSERT INTO public.shops (id, user_id, business_name, commission_balance_due, shop_payment_status, is_suspended,
                          payment_deadline, first_deadline_at, locked_at, second_deadline_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'Boutique bloquée', 13950,
   'locked', true, now() - interval '5 days', now() - interval '8 days', now() - interval '5 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2', 'Boutique normale', 5750,
   'active', false, NULL, NULL, NULL, NULL);

-- 1. Les droits (C2) survivent au CREATE OR REPLACE : un utilisateur connecté ne peut pas s'abonner gratuitement
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM public.apply_shop_subscription('00000000-0000-0000-0000-000000000002', NULL, 'pro_monthly', 12000, 'X');
  RAISE EXCEPTION 'ÉCHEC : authenticated peut appeler apply_shop_subscription';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK : apply_shop_subscription reste réservée à service_role';
END $$;
RESET ROLE;

-- 2. Abonnement « pro_monthly » (plan refusé avant le correctif) sur une boutique verrouillée avec un solde dû
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
                                                      'pro_monthly', 12000, 'REF-1')->>'success')::boolean,
                      'pro_monthly accepté');
SELECT public.t_assert(subscription_active_until BETWEEN now() + interval '29 days 23 hours' AND now() + interval '30 days 1 hour',
                      'abonnement valable 30 jours') FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT public.t_assert(commission_balance_due = 0 AND commission_rate = 0 AND shop_payment_status = 'active'
                      AND is_suspended = false AND locked_at IS NULL AND second_deadline_at IS NULL
                      AND payment_deadline IS NULL AND first_deadline_at IS NULL,
                      'solde effacé, boutique rouverte, échéances supprimées') FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT public.t_assert(count(*) = 1, 'paiement tracé dans commission_payments') FROM public.commission_payments WHERE transaction_reference = 'REF-1';
SELECT public.t_assert(note LIKE '%Solde de commission effacé : 13950%', 'solde effacé conservé dans le journal (rétablissable)')
  FROM public.shop_payment_events WHERE event_type = 'subscription_activated' AND shop_id = '00000000-0000-0000-0000-000000000001';
SELECT public.t_assert(plan = 'pro_monthly' AND status = 'active', 'ligne subscriptions créée') FROM public.subscriptions
 WHERE user_id = '00000000-0000-0000-0000-0000000000f1';

-- 3. Commandes d'un abonné : aucune commission
INSERT INTO public.orders (shop_id, total) SELECT '00000000-0000-0000-0000-000000000001', 5000 FROM generate_series(1, 5);
SELECT public.t_assert(commission_balance_due = 0 AND total_orders = 5, '5 commandes d''un abonné : 0 FCFA de commission')
  FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000001';

-- 4. Idempotence : même référence, rien n'est prolongé
CREATE TEMP TABLE before_until AS SELECT subscription_active_until AS u FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
                                                      'pro_monthly', 12000, 'REF-1')->>'already_applied')::boolean,
                      'même référence : déjà appliquée');
SELECT public.t_assert(s.subscription_active_until = b.u, 'même référence : fin d''abonnement inchangée')
  FROM public.shops s, before_until b WHERE s.id = '00000000-0000-0000-0000-000000000001';

-- 5. Renouvellement anticipé : les jours s'ajoutent
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'pro_monthly', 12000, 'REF-2');
SELECT public.t_assert(s.subscription_active_until BETWEEN b.u + interval '29 days 23 hours' AND b.u + interval '30 days 1 hour',
                      'renouvellement anticipé : +30 jours cumulés') FROM public.shops s, before_until b WHERE s.id = '00000000-0000-0000-0000-000000000001';

-- 6. Paiement annuel (montant 118 800) : 365 jours
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2', 'pro_monthly', 118800, 'REF-ANNUEL');
SELECT public.t_assert(subscription_active_until > now() + interval '364 days', 'paiement annuel : 365 jours')
  FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';

-- 7. Refus
SELECT public.t_assert((public.apply_shop_subscription('00000000-0000-0000-0000-000000000002', NULL, 'free', 0, 'REF-F')->>'error') = 'invalid_plan', 'plan free refusé');
SELECT public.t_assert((public.apply_shop_subscription(gen_random_uuid(), NULL, 'starter', 12000, 'REF-G')->>'error') = 'shop_not_found', 'boutique inconnue refusée');
SELECT public.t_assert(count(*) = 0, 'aucune écriture pour un refus') FROM public.commission_payments WHERE transaction_reference IN ('REF-F', 'REF-G');
SELECT public.t_assert((public.apply_shop_subscription(NULL, '00000000-0000-0000-0000-0000000000f2', 'starter', 12000, 'REF-3')->>'shop_id')::uuid
                      = '00000000-0000-0000-0000-000000000002', 'sans boutique indiquée : boutique de l''utilisateur');

SELECT public.t_assert((public.apply_shop_subscription(NULL, '00000000-0000-0000-0000-0000000000f9', 'pro_monthly', 12000, 'REF-NOSHOP')->>'success')::boolean,
                       'abonnement de compte sans boutique : pas d''échec');
SELECT public.t_assert(status = 'active' AND end_date > now() + interval '29 days', 'abonnement de compte sans boutique : ligne subscriptions servie')
  FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-0000000000f9';

-- 8. Anciens abonnés échus avant le correctif : jamais fermés rétroactivement
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-0000000000c1') = 'none', 'ancien abonné échu : ignoré');
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-0000000000c2') = 'none', 'boutique jamais abonnée : ignorée');
SELECT public.t_assert(shop_payment_status = 'active' AND is_suspended = false, 'ancien abonné : toujours ouvert')
  FROM public.shops WHERE id = '00000000-0000-0000-0000-0000000000c1';

-- 9. Le fondateur peut changer la date de début d'application (CREATE OR REPLACE) : on l'avance pour les cas suivants
CREATE OR REPLACE FUNCTION public.subscription_enforcement_start() RETURNS timestamptz LANGUAGE sql IMMUTABLE
AS $$ SELECT '2000-01-01'::timestamptz $$;

-- 10. Échéance dépassée depuis 1 jour (dans le délai de grâce) : constat, commission toujours à 0, boutique ouverte
UPDATE public.shops SET subscription_active_until = now() - interval '1 day' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-000000000002') = 'expired', 'échéance constatée');
SELECT public.t_assert(commission_rate = 0.025 AND coalesce(is_subscribed, false) = false AND shop_payment_status = 'active' AND is_suspended = false,
                      'taux de commission rétabli, boutique encore ouverte pendant la grâce')
  FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-000000000002') = 'none', 'constat une seule fois');
SELECT public.t_assert(count(*) = 1, 'un seul événement subscription_expired') FROM public.shop_payment_events
 WHERE shop_id = '00000000-0000-0000-0000-000000000002' AND event_type = 'subscription_expired';
UPDATE public.shops SET commission_balance_due = 0 WHERE id = '00000000-0000-0000-0000-000000000002';
INSERT INTO public.orders (shop_id, total) VALUES ('00000000-0000-0000-0000-000000000002', 5000);
SELECT public.t_assert(commission_balance_due = 0, 'pendant la grâce : toujours 0 commission') FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';

-- 11. Délai de grâce écoulé (échu depuis 4 jours) : espace propriétaire fermé, sans fermeture définitive automatique
UPDATE public.shops SET subscription_active_until = now() - interval '4 days' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-000000000002') = 'locked', 'grâce écoulée : fermeture');
SELECT public.t_assert(shop_payment_status = 'locked' AND is_suspended = true AND second_deadline_at IS NULL AND locked_at IS NOT NULL,
                      'boutique verrouillée, sans échéance de fermeture définitive')
  FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(public.enforce_subscription_expiry_one('00000000-0000-0000-0000-000000000002') = 'none', 'déjà fermée : rien de plus');
INSERT INTO public.orders (shop_id, total) VALUES ('00000000-0000-0000-0000-000000000002', 5000);
SELECT public.t_assert(commission_balance_due = 50, 'après la grâce, la commission de 50 FCFA reprend') FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';

-- 12. Renouvellement : réouverture immédiate, solde effacé
SELECT public.apply_shop_subscription('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2', 'pro_monthly', 12000, 'REF-RENOUV');
SELECT public.t_assert(shop_payment_status = 'active' AND is_suspended = false AND commission_balance_due = 0 AND subscription_active_until > now() + interval '29 days',
                      'renouvellement : boutique rouverte pour 30 jours') FROM public.shops WHERE id = '00000000-0000-0000-0000-000000000002';

-- 13. Tâche planifiée : traite toutes les boutiques concernées en une passe
UPDATE public.shops SET subscription_active_until = now() - interval '1 day', is_subscribed = true, commission_rate = 0
 WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.shops SET subscription_active_until = now() - interval '5 days', is_subscribed = true, commission_rate = 0
 WHERE id = '00000000-0000-0000-0000-000000000002';
-- (la boutique 2 a déjà un événement d'échéance daté d'aujourd'hui, antérieur à sa nouvelle échéance : on le retire pour un cas réaliste)
DELETE FROM public.shop_payment_events WHERE shop_id = '00000000-0000-0000-0000-000000000002' AND event_type = 'subscription_expired';
SELECT public.t_assert(public.enforce_subscription_expiry() = '{"expired": 1, "locked": 2}'::jsonb,
                       'tâche planifiée : boutique 1 constatée ; boutiques 2 et « ancien abonné » (désormais dans le périmètre, date de début reculée) fermées');
SELECT public.t_assert(public.enforce_subscription_expiry() = '{"expired": 0, "locked": 0}'::jsonb, 'tâche planifiée : rejouable sans effet');

-- 14. Droits des fonctions d'échéance
SET ROLE anon;
DO $$ BEGIN
  PERFORM public.enforce_subscription_expiry();
  RAISE EXCEPTION 'ÉCHEC : anon peut lancer la tâche';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : la tâche planifiée est refusée à anon'; END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM public.enforce_subscription_expiry();
  RAISE EXCEPTION 'ÉCHEC : authenticated peut lancer la tâche';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK : la tâche planifiée est refusée à authenticated'; END $$;
RESET ROLE;

-- 15. Vérification à la lecture : réservée au propriétaire (ou fondateur)
UPDATE public.shops SET subscription_active_until = now() - interval '5 days', shop_payment_status = 'active', is_suspended = false
 WHERE id = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
SELECT public.t_assert(public.enforce_subscription_expiry_for('00000000-0000-0000-0000-000000000001') = 'none', 'un autre utilisateur ne déclenche rien');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
SELECT public.t_assert(public.enforce_subscription_expiry_for('00000000-0000-0000-0000-000000000001') = 'locked', 'le propriétaire déclenche la vérification de sa boutique');
RESET ROLE;

\echo 'TOUS LES CAS PASSENT'
