-- Grilles d'abonnement et commission paramétrables par le fondateur.
--
-- Avant : prix des plans codés en dur à 4 endroits, commission (50 FCFA), seuil (12 000 FCFA) et délais codés en dur
-- dans les fonctions SQL et l'interface, un abonnement rattaché à UNE seule boutique, aucune limite de boutiques.
--
-- Après :
--   * subscription_plans : une ligne par plan (prix mensuel/annuel, boutiques couvertes, quotas IA, fonctionnalités) ;
--   * billing_settings   : commission par commande, seuil de blocage, délais ;
--   * billing_config_audit : journal de chaque modification ;
--   * l'abonnement du COMPTE couvre les N boutiques les plus anciennes de l'utilisateur (0 commission). Les boutiques
--     au-delà restent créables mais paient la commission par commande, avec le seuil et les échéances habituels.
--
-- Écriture réservée aux fondateurs / co-fondateurs, uniquement par les fonctions founder_save_* (SECURITY DEFINER).
-- Aucune colonne ajoutée à `shops` : le garde trg_guard_shop_billing_columns (20261025100000) reste valable.
-- Idempotente. Suppose 20261019120000 (apply_shop_subscription, sync_shop_order_stats, délai de grâce).

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code            text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name            text NOT NULL CHECK (btrim(name) <> ''),
  description     text,
  badge           text,
  price_monthly   integer NOT NULL CHECK (price_monthly >= 200),
  price_annual    integer CHECK (price_annual IS NULL OR price_annual >= 200),
  max_shops       integer NOT NULL DEFAULT 1 CHECK (max_shops BETWEEN 0 AND 100),
  ai_video_quota  integer NOT NULL DEFAULT 0 CHECK (ai_video_quota BETWEEN 0 AND 10000),
  ai_image_quota  integer NOT NULL DEFAULT 0 CHECK (ai_image_quota BETWEEN 0 AND 10000),
  features        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  is_active       boolean NOT NULL DEFAULT true,
  is_public       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);

CREATE TABLE IF NOT EXISTS public.billing_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

CREATE TABLE IF NOT EXISTS public.billing_config_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('plan', 'setting')),
  key         text NOT NULL,
  old_value   jsonb,
  new_value   jsonb,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_config_audit_changed_at_idx ON public.billing_config_audit (changed_at DESC);

-- Plan du compte (l'ancienne colonne `plan` n'existe pas : c'est ce qui avait cassé le hotfix d'octobre)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_code text;

-- Valeurs de départ = celles qui étaient codées en dur (pricing.ts, pricingPlans.ts, billingSystem.ts, 20261019120000).
-- Boutiques couvertes (max_shops) : 1 / 3 / 10, à ajuster dans le menu fondateur.
INSERT INTO public.subscription_plans
  (code, name, description, badge, price_monthly, price_annual, max_shops, ai_video_quota, ai_image_quota, features, is_active, is_public, sort_order)
VALUES
  ('starter', 'Starter', 'Formule historique, renouvellement mensuel.', NULL, 12000, NULL, 1, 0, 0, '[]'::jsonb, true, false, 0),
  ('pro_monthly', 'Ecomfy Pro', 'Pour les e-commerçants actifs voulant zéro commission et un domaine propre.', 'POPULAIRE',
   12000, 118800, 3, 10, 20,
   '["Zéro commission sur vos ventes (0 FCFA)", "Domaine personnalisé (.com, .net)", "Visuels IA & Textes SEO optimisés", "10 vidéos animées IA par mois", "20 images HD studio IA par mois", "Tableau de bord financier avancé", "Support prioritaire WhatsApp 24/7"]'::jsonb,
   true, true, 10),
  ('premium_academy_pro', 'Premium Académie & VIP', 'L''écosystème ultime : Formations vidéo Masterclasses, vidéos et images IA & Communauté.', 'OFFRE COMPLÈTE MEMBRE',
   35000, 342000, 10, 20, 40,
   '["Formations & Masterclasses vidéo Académie Ecomfy", "Jusqu''à 20 vidéos publicitaires animées IA / mois", "Jusqu''à 40 images HD studio IA / mois", "Accès VIP à la Communauté des Marchands Ecomfy", "Zéro commission sur vos ventes (0 FCFA)", "Nom de domaine personnalisé", "Support prioritaire VIP WhatsApp 24/7"]'::jsonb,
   true, true, 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.billing_settings (key, value) VALUES
  ('commission_per_order', '50'::jsonb),
  ('commission_threshold', '12000'::jsonb),
  ('payment_deadline_days', '3'::jsonb),
  ('subscription_grace_days', '3'::jsonb),
  ('subscription_reminder_days', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Droits : lecture publique des plans et réglages, aucune écriture directe
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_config_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans lisibles" ON public.subscription_plans;
CREATE POLICY "Plans lisibles" ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

DROP POLICY IF EXISTS "Réglages de facturation lisibles" ON public.billing_settings;
CREATE POLICY "Réglages de facturation lisibles" ON public.billing_settings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Journal de facturation (fondateurs)" ON public.billing_config_audit;
CREATE POLICY "Journal de facturation (fondateurs)" ON public.billing_config_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

REVOKE ALL ON public.subscription_plans, public.billing_settings, public.billing_config_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_plans, public.billing_settings TO anon, authenticated;
GRANT SELECT ON public.billing_config_audit TO authenticated;
GRANT ALL ON public.subscription_plans, public.billing_settings, public.billing_config_audit TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Lecture d'un réglage + délais paramétrés
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.billing_setting_numeric(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v numeric;
BEGIN
  SELECT (value #>> '{}')::numeric INTO v FROM public.billing_settings WHERE key = p_key;
  RETURN COALESCE(v, p_default);
EXCEPTION WHEN OTHERS THEN
  RETURN p_default;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_setting_numeric(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_setting_numeric(text, numeric) TO authenticated, service_role;

-- Délai de grâce après l'échéance d'un abonnement (était un intervalle fixe de 3 jours)
CREATE OR REPLACE FUNCTION public.subscription_grace_interval()
RETURNS interval
LANGUAGE sql
STABLE
AS $$ SELECT make_interval(days => GREATEST(0, public.billing_setting_numeric('subscription_grace_days', 3))::int) $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Les colonnes shops.commission_per_order / commission_threshold restent les valeurs lues par les fonctions
--    existantes (RPC de règlement, tâches planifiées, écrans). Elles suivent le réglage global :
--    mise à jour en masse à l'enregistrement, et valeur du réglage à la création d'une boutique.
--    Ce déclencheur se nomme après trg_guard_shop_billing_columns : le garde voit d'abord les valeurs par défaut.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shops_apply_billing_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.commission_per_order := public.billing_setting_numeric('commission_per_order', 50);
  NEW.commission_threshold := public.billing_setting_numeric('commission_threshold', 12000);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shops_apply_billing_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_shops_sync_billing_defaults ON public.shops;
CREATE TRIGGER trg_shops_sync_billing_defaults
  BEFORE INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_apply_billing_defaults();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Commande : même version que 20261019120000, avec le délai de paiement paramétré et le seuil réel dans le message
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_shop_id uuid;
  v_per_order numeric;
  v_threshold numeric;
  v_new_balance numeric;
  v_current_deadline timestamptz;
  v_sub_until timestamptz;
  v_status text;
  v_days int := GREATEST(1, public.billing_setting_numeric('payment_deadline_days', 3))::int;
BEGIN
  IF TG_OP = 'DELETE' THEN target_shop_id := OLD.shop_id; ELSE target_shop_id := NEW.shop_id; END IF;

  UPDATE shops SET
    total_orders = (SELECT COUNT(*) FROM orders WHERE shop_id = target_shop_id),
    total_sales = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE shop_id = target_shop_id),
    updated_at = now()
  WHERE id = target_shop_id;

  IF TG_OP = 'INSERT' THEN
    SELECT commission_per_order, commission_threshold, payment_deadline, subscription_active_until, shop_payment_status
      INTO v_per_order, v_threshold, v_current_deadline, v_sub_until, v_status
      FROM shops WHERE id = target_shop_id;

    -- Abonnement en cours, ou échu depuis moins que le délai de grâce : aucune commission.
    IF v_sub_until IS NOT NULL AND v_sub_until + public.subscription_grace_interval() > now() THEN
      RETURN NEW;
    END IF;

    UPDATE shops
      SET commission_balance_due = COALESCE(commission_balance_due, 0) + COALESCE(v_per_order, 50)
      WHERE id = target_shop_id
      RETURNING commission_balance_due INTO v_new_balance;

    IF v_new_balance >= COALESCE(v_threshold, 12000)
       AND v_current_deadline IS NULL
       AND v_status = 'active' THEN
      UPDATE shops
        SET payment_deadline = now() + make_interval(days => v_days),
            threshold_reached_at = now(),
            first_deadline_at = now() + make_interval(days => v_days),
            shop_payment_status = 'payment_pending'
        WHERE id = target_shop_id;

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (target_shop_id, 'threshold_reached', v_new_balance,
              format('Seuil de %s FCFA atteint - %s jours pour régler', COALESCE(v_threshold, 12000)::bigint, v_days));
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Couverture par l'abonnement du compte : les N boutiques les plus anciennes
-- ---------------------------------------------------------------------------------------------------------------
-- p_allow_uncover = true (renouvellement seulement) : les boutiques au-delà de N perdent la couverture. Ailleurs
-- (nouvelle boutique, hausse de la limite) on ne retire jamais une couverture déjà payée.
CREATE OR REPLACE FUNCTION public.apply_subscription_coverage(p_user_id uuid, p_allow_uncover boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
  v_max int;
  v_covered uuid[] := ARRAY[]::uuid[];
  v_uncovered uuid[] := ARRAY[]::uuid[];
  r record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('covered', '[]'::jsonb, 'uncovered', '[]'::jsonb);
  END IF;

  SELECT plan_code, end_date, status INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND OR v_sub.status IS DISTINCT FROM 'active' OR v_sub.end_date IS NULL OR v_sub.end_date <= now() THEN
    RETURN jsonb_build_object('covered', '[]'::jsonb, 'uncovered', '[]'::jsonb, 'reason', 'no_active_subscription');
  END IF;

  SELECT max_shops INTO v_max FROM public.subscription_plans WHERE code = v_sub.plan_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('covered', '[]'::jsonb, 'uncovered', '[]'::jsonb, 'reason', 'unknown_plan');
  END IF;

  -- FOR UPDATE est interdit avec une fonction de fenêtre : on verrouille d'abord, on classe ensuite
  PERFORM 1 FROM public.shops WHERE user_id = p_user_id FOR UPDATE;

  FOR r IN
    SELECT s.id, s.is_subscribed, s.subscription_plan, s.subscription_active_until,
           row_number() OVER (ORDER BY s.created_at, s.id) AS rank
      FROM public.shops s
     WHERE s.user_id = p_user_id
  LOOP
    IF r.rank <= v_max THEN
      -- Couverte : on garde la plus lointaine des deux échéances (une boutique déjà payée plus longtemps n'est pas raccourcie)
      IF COALESCE(r.is_subscribed, false) = false
         OR r.subscription_plan IS DISTINCT FROM v_sub.plan_code
         OR r.subscription_active_until IS NULL
         OR r.subscription_active_until < v_sub.end_date THEN
        UPDATE public.shops
           SET subscription_plan = v_sub.plan_code,
               subscription_started_at = COALESCE(subscription_started_at, now()),
               subscription_active_until = GREATEST(COALESCE(subscription_active_until, v_sub.end_date), v_sub.end_date),
               is_subscribed = true,
               commission_rate = 0,
               updated_at = now()
         WHERE id = r.id;
        v_covered := array_append(v_covered, r.id);
        INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
        VALUES (r.id, 'subscription_coverage', 0,
                format('Boutique couverte par l''abonnement %s du compte (rang %s sur %s incluses).', v_sub.plan_code, r.rank, v_max));
      END IF;
    ELSIF p_allow_uncover
          AND COALESCE(r.is_subscribed, false) = true
          AND r.subscription_active_until IS NOT NULL
          AND r.subscription_active_until <= v_sub.end_date THEN
      -- Au-delà de la limite du plan : retour à la commission par commande. Pas d'échéance (NULL) : la tâche
      -- enforce_subscription_expiry ne la traite pas comme un abonnement échu.
      UPDATE public.shops
         SET subscription_plan = 'free',
             subscription_active_until = NULL,
             is_subscribed = false,
             commission_rate = public.subscription_default_commission_rate(),
             updated_at = now()
       WHERE id = r.id;
      v_uncovered := array_append(v_uncovered, r.id);
      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (r.id, 'subscription_coverage_removed', 0,
              format('Boutique au-delà des %s incluses dans le plan %s : commission par commande rétablie.', v_max, v_sub.plan_code));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('max_shops', v_max, 'covered', to_jsonb(v_covered), 'uncovered', to_jsonb(v_uncovered));
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_coverage(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_coverage(uuid, boolean) TO service_role;

-- Une nouvelle boutique d'un compte abonné est couverte s'il reste de la place dans le plan.
CREATE OR REPLACE FUNCTION public.shop_inherit_account_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.apply_subscription_coverage(NEW.user_id, false);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais empêcher la création d'une boutique
  RAISE WARNING 'shop_inherit_account_subscription: %', SQLERRM;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_inherit_account_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_shops_inherit_subscription ON public.shops;
CREATE TRIGGER trg_shops_inherit_subscription
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shop_inherit_account_subscription();

-- Boutique au-delà des boutiques incluses dans le plan du compte (rang > max_shops), que l'abonnement du compte soit
-- en cours ou échu. Faux si le compte n'a pas de plan connu (anciens abonnés sans plan_code).
CREATE OR REPLACE FUNCTION public.shop_is_beyond_plan_limit(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT x.rank > p.max_shops
      FROM (
        SELECT s.id, s.user_id, row_number() OVER (PARTITION BY s.user_id ORDER BY s.created_at, s.id) AS rank
          FROM public.shops s
         WHERE s.user_id = (SELECT user_id FROM public.shops WHERE id = p_shop_id)
      ) x
      JOIN public.subscriptions sub ON sub.user_id = x.user_id
      JOIN public.subscription_plans p ON p.code = sub.plan_code
     WHERE x.id = p_shop_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.shop_is_beyond_plan_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_is_beyond_plan_limit(uuid) TO authenticated, service_role;

-- À l'échéance d'une boutique hors des boutiques incluses : retour à la commission, JAMAIS de fermeture (le propriétaire
-- n'a pas à renouveler un abonnement qui ne couvre plus cette boutique). Le reste est identique à 20261019120000.
CREATE OR REPLACE FUNCTION public.enforce_subscription_expiry_one(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s record;
  v_result text := 'none';
BEGIN
  SELECT id, subscription_active_until, subscription_plan, commission_rate, shop_payment_status, is_suspended
    INTO s
    FROM public.shops
   WHERE id = _shop_id
   FOR UPDATE;

  IF NOT FOUND
     OR s.subscription_active_until IS NULL
     OR s.subscription_active_until > now()
     OR s.subscription_active_until < public.subscription_enforcement_start() THEN
    RETURN 'none';
  END IF;

  IF public.shop_is_beyond_plan_limit(_shop_id) THEN
    UPDATE public.shops
       SET subscription_plan = 'free',
           subscription_active_until = NULL,
           is_subscribed = false,
           commission_rate = public.subscription_default_commission_rate(),
           updated_at = now()
     WHERE id = _shop_id;
    INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
    VALUES (_shop_id, 'subscription_coverage_removed', 0,
            format('Abonnement %s échu sur une boutique hors des boutiques incluses du plan : commission par commande rétablie, pas de fermeture.', s.subscription_plan));
    RETURN 'expired';
  END IF;

  -- Échéance constatée (une seule fois par échéance) : fin de l'exemption de commission, taux rétabli.
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_payment_events
     WHERE shop_id = _shop_id AND event_type = 'subscription_expired' AND created_at >= s.subscription_active_until
  ) THEN
    UPDATE public.shops
       SET is_subscribed = false,
           commission_rate = CASE WHEN COALESCE(commission_rate, 0) = 0
                                  THEN public.subscription_default_commission_rate() ELSE commission_rate END,
           updated_at = now()
     WHERE id = _shop_id;
    INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
    VALUES (_shop_id, 'subscription_expired', 0,
            format('Abonnement %s échu le %s. Renouvellement attendu avant le %s.',
                   s.subscription_plan,
                   to_char(s.subscription_active_until, 'YYYY-MM-DD HH24:MI'),
                   to_char(s.subscription_active_until + public.subscription_grace_interval(), 'YYYY-MM-DD HH24:MI')));
    v_result := 'expired';
  END IF;

  -- Délai de grâce écoulé : espace propriétaire fermé (sauf s'il l'est déjà pour un autre motif).
  IF s.subscription_active_until + public.subscription_grace_interval() <= now()
     AND s.shop_payment_status NOT IN ('locked', 'final_suspension') THEN
    UPDATE public.shops
       SET shop_payment_status = 'locked',
           locked_at = now(),
           second_deadline_at = NULL,
           is_suspended = true,
           updated_at = now()
     WHERE id = _shop_id;
    INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
    VALUES (_shop_id, 'subscription_locked', 0, 'Abonnement non renouvelé après le délai de grâce : espace boutique fermé.');
    v_result := 'locked';
  END IF;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_subscription_expiry_one(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_expiry_one(uuid) TO service_role;

-- Boutique déjà fermée pour abonnement échu alors qu'elle n'est plus couverte par le plan : le propriétaire la repasse à la
-- commission au lieu de payer un renouvellement qui ne lui servirait pas. Une dette de commission non payée garde le verrou.
CREATE OR REPLACE FUNCTION public.release_shop_to_commission(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;
  SELECT id, user_id, commission_balance_due, commission_threshold INTO s FROM public.shops WHERE id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'shop_not_found'; END IF;
  IF s.user_id <> auth.uid() AND NOT (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder')) THEN
    RETURN 'forbidden';
  END IF;
  IF NOT public.shop_is_beyond_plan_limit(_shop_id) THEN RETURN 'covered'; END IF;

  UPDATE public.shops
     SET subscription_plan = 'free',
         subscription_active_until = NULL,
         is_subscribed = false,
         commission_rate = public.subscription_default_commission_rate(),
         shop_payment_status = CASE WHEN COALESCE(commission_balance_due, 0) < COALESCE(commission_threshold, 12000) THEN 'active' ELSE shop_payment_status END,
         is_suspended = CASE WHEN COALESCE(commission_balance_due, 0) < COALESCE(commission_threshold, 12000) THEN false ELSE is_suspended END,
         locked_at = CASE WHEN COALESCE(commission_balance_due, 0) < COALESCE(commission_threshold, 12000) THEN NULL ELSE locked_at END,
         second_deadline_at = CASE WHEN COALESCE(commission_balance_due, 0) < COALESCE(commission_threshold, 12000) THEN NULL ELSE second_deadline_at END,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note, created_by)
  VALUES (_shop_id, 'subscription_coverage_removed', 0, 'Boutique hors des boutiques incluses du plan : repassée à la commission par commande.', auth.uid());
  RETURN 'released';
END;
$$;
REVOKE ALL ON FUNCTION public.release_shop_to_commission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_shop_to_commission(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. apply_shop_subscription : abonnement du compte + couverture. Nouveau paramètre p_billing_cycle ('monthly' |
--    'annual'). À défaut, la durée se déduit du montant payé par rapport au prix mensuel du plan (le critère
--    « montant >= 100 000 » ne tient plus dès que les prix sont modifiables).
--    La signature change : on supprime l'ancienne pour ne pas laisser deux surcharges ambiguës pour PostgREST.
-- ---------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.apply_shop_subscription(uuid, uuid, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_plan text DEFAULT 'pro_monthly',
  p_amount numeric DEFAULT 0,
  p_transaction_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay',
  p_billing_cycle text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_shop_id uuid;
  v_shop record;
  v_owner uuid;
  v_existing uuid;
  v_new_until timestamptz;
  v_base timestamptz;
  v_account_until timestamptz;
  v_normalized_plan text;
  v_plan record;
  v_annual boolean := false;
  v_duration_interval interval := interval '30 days';
  v_has_ref boolean := p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '';
  v_cycle text := lower(btrim(COALESCE(p_billing_cycle, '')));
  v_cov jsonb;
  v_target_covered boolean;
BEGIN
  IF p_shop_id IS NULL AND p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_user_and_shop_id');
  END IF;

  v_normalized_plan := LOWER(btrim(COALESCE(p_plan, 'pro_monthly')));
  IF v_normalized_plan IN ('', 'free', 'starter_free') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  -- Sérialise les appels concurrents portant sur la même référence (relâché au COMMIT)
  IF v_has_ref THEN
    PERFORM pg_advisory_xact_lock(hashtext('apply_billing:' || p_transaction_reference));
  END IF;

  -- Durée : cycle transmis par le paiement, sinon déduit du montant par rapport aux prix du plan
  SELECT price_monthly, price_annual INTO v_plan FROM public.subscription_plans WHERE code = v_normalized_plan;
  IF v_cycle = 'annual' THEN
    v_annual := true;
  ELSIF v_cycle = 'monthly' THEN
    v_annual := false;
  ELSIF v_normalized_plan LIKE '%annual%' OR v_normalized_plan LIKE '%year%' THEN
    v_annual := true;
  ELSIF FOUND THEN
    v_annual := v_plan.price_annual IS NOT NULL AND COALESCE(p_amount, 0) >= v_plan.price_monthly * 5;
  ELSE
    v_annual := COALESCE(p_amount, 0) >= 100000;  -- plan inconnu de la table : règle historique
  END IF;
  IF v_annual THEN v_duration_interval := interval '365 days'; END IF;

  -- Boutique : celle indiquée, sinon la plus récente de l'utilisateur
  v_target_shop_id := p_shop_id;
  IF v_target_shop_id IS NULL THEN
    SELECT id INTO v_target_shop_id
      FROM public.shops
     WHERE user_id = p_user_id
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;
  IF v_target_shop_id IS NULL THEN
    -- Abonnement de compte sans boutique : seule la ligne `subscriptions` est servie (rejouable sans effet supplémentaire).
    IF p_shop_id IS NULL AND p_user_id IS NOT NULL THEN
      v_new_until := now() + v_duration_interval;
      UPDATE public.subscriptions
         SET status = 'active', amount = COALESCE(p_amount, 0), plan_code = v_normalized_plan,
             start_date = now(), end_date = v_new_until, updated_at = now()
       WHERE user_id = p_user_id;
      IF NOT FOUND THEN
        INSERT INTO public.subscriptions (user_id, status, amount, plan_code, start_date, end_date, created_at, updated_at)
        VALUES (p_user_id, 'active', COALESCE(p_amount, 0), v_normalized_plan, now(), v_new_until, now(), now());
      END IF;
      RETURN jsonb_build_object('success', true, 'plan', v_normalized_plan, 'shop_id', NULL, 'active_until', v_new_until);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- Idempotence par référence : déjà appliquée, on ne prolonge pas une seconde fois
  IF v_has_ref THEN
    SELECT id INTO v_existing
      FROM public.commission_payments
     WHERE transaction_reference = p_transaction_reference
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'shop_id', v_target_shop_id);
    END IF;
  END IF;

  SELECT id, user_id, subscription_active_until, subscription_started_at,
         COALESCE(commission_balance_due, 0) AS balance_due
    INTO v_shop
    FROM public.shops
   WHERE id = v_target_shop_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;
  v_owner := v_shop.user_id;

  -- Renouvellement : cumul tant que l'abonnement court (celui de la boutique ou celui du compte), sinon à partir de maintenant
  SELECT end_date INTO v_account_until FROM public.subscriptions WHERE user_id = v_owner AND status = 'active';
  v_base := GREATEST(
    CASE WHEN v_shop.subscription_active_until > now() THEN v_shop.subscription_active_until END,
    CASE WHEN v_account_until > now() THEN v_account_until END
  );
  IF v_base IS NOT NULL THEN
    v_new_until := v_base + v_duration_interval;
  ELSE
    v_new_until := now() + v_duration_interval;
  END IF;

  -- Abonnement du compte d'abord (plan, échéance), puis couverture des N boutiques les plus anciennes
  UPDATE public.subscriptions
     SET status = 'active', amount = COALESCE(p_amount, 0), plan_code = v_normalized_plan,
         start_date = now(), end_date = v_new_until, updated_at = now()
   WHERE user_id = v_owner;
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, status, amount, plan_code, start_date, end_date, created_at, updated_at)
    VALUES (v_owner, 'active', COALESCE(p_amount, 0), v_normalized_plan, now(), v_new_until, now(), now());
  END IF;

  -- Plan absent de la table (ancien code) : comportement historique, la boutique payée est la seule couverte.
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE code = v_normalized_plan) THEN
    v_cov := jsonb_build_object('covered', jsonb_build_array(v_target_shop_id), 'uncovered', '[]'::jsonb);
    v_target_covered := true;
  ELSE
    -- Couverture des N plus anciennes boutiques ; sur un renouvellement, celles au-delà de N reviennent à la commission
    v_cov := public.apply_subscription_coverage(v_owner, true);
    v_target_covered := COALESCE(
      (SELECT is_subscribed AND subscription_active_until > now() FROM public.shops WHERE id = v_target_shop_id), false);
  END IF;

  IF v_target_covered THEN
    UPDATE public.shops
       SET subscription_plan = v_normalized_plan,
           subscription_started_at = COALESCE(subscription_started_at, now()),
           subscription_active_until = GREATEST(COALESCE(subscription_active_until, v_new_until), v_new_until),
           is_subscribed = true,
           commission_rate = 0,
           -- L'abonné paie un forfait : la commission due est soldée, la boutique est rouverte.
           commission_balance_due = 0,
           payment_deadline = NULL,
           is_suspended = false,
           shop_payment_status = 'active',
           threshold_reached_at = NULL,
           first_deadline_at = NULL,
           locked_at = NULL,
           second_deadline_at = NULL,
           final_suspension_at = NULL,
           extra_deadline_active = false,
           extra_deadline_started_at = NULL,
           extra_deadline_ends_at = NULL,
           updated_at = now()
     WHERE id = v_target_shop_id;
  END IF;

  IF v_has_ref THEN
    INSERT INTO public.commission_payments (
      shop_id, amount, payment_method, transaction_reference, status, created_by, notes
    ) VALUES (
      v_target_shop_id, COALESCE(p_amount, 0),
      COALESCE(NULLIF(p_payment_method, ''), 'geniuspay'),
      p_transaction_reference, 'paid', COALESCE(p_user_id, v_owner),
      'Abonnement ' || v_normalized_plan
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Trace, avec le solde effacé (permet de le rétablir si le fondateur change d'avis)
  INSERT INTO public.shop_payment_events (shop_id, event_type, amount, note)
  VALUES (
    v_target_shop_id, 'subscription_activated', COALESCE(p_amount, 0),
    format('Abonnement %s (%s) jusqu''au %s (réf %s). Solde de commission effacé : %s FCFA. Ancienne fin : %s.%s',
           v_normalized_plan, CASE WHEN v_annual THEN 'annuel' ELSE 'mensuel' END,
           to_char(v_new_until, 'YYYY-MM-DD HH24:MI'), COALESCE(p_transaction_reference, '-'),
           CASE WHEN v_target_covered THEN v_shop.balance_due::text ELSE '0 (boutique hors des boutiques incluses : commission conservée)' END,
           COALESCE(to_char(v_shop.subscription_active_until, 'YYYY-MM-DD HH24:MI'), 'aucune'),
           CASE WHEN v_target_covered THEN '' ELSE ' Cette boutique n''est pas couverte par le plan.' END)
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_normalized_plan,
    'shop_id', v_target_shop_id,
    'active_until', v_new_until,
    'target_covered', v_target_covered,
    'covered_shop_ids', COALESCE(v_cov -> 'covered', '[]'::jsonb),
    'uncovered_shop_ids', COALESCE(v_cov -> 'uncovered', '[]'::jsonb)
  );
END;
$$;

-- Droits (audit C2) : service_role seul
REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Enregistrement par le fondateur (seule voie d'écriture)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.founder_save_subscription_plan(p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := lower(btrim(COALESCE(p_plan ->> 'code', '')));
  v_name text := btrim(COALESCE(p_plan ->> 'name', ''));
  v_monthly integer;
  v_annual integer;
  v_max integer;
  v_video integer;
  v_image integer;
  v_features jsonb;
  v_old public.subscription_plans;
  v_new public.subscription_plans;
  v_users uuid[];
  v_uid2 uuid;
  v_synced int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT (public.has_role(v_uid, 'founder') OR public.has_role(v_uid, 'co_founder')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_code !~ '^[a-z][a-z0-9_]{1,40}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code', 'message', 'Code du plan invalide (lettres minuscules, chiffres, _).');
  END IF;
  IF v_code IN ('free', 'starter_free') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code', 'message', 'Ce code est réservé à l''offre gratuite.');
  END IF;
  IF v_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name', 'message', 'Le nom du plan est obligatoire.');
  END IF;

  BEGIN
    v_monthly := (p_plan ->> 'price_monthly')::integer;
    v_annual := NULLIF(p_plan ->> 'price_annual', '')::integer;
    v_max := COALESCE(NULLIF(p_plan ->> 'max_shops', '')::integer, 1);
    v_video := COALESCE(NULLIF(p_plan ->> 'ai_video_quota', '')::integer, 0);
    v_image := COALESCE(NULLIF(p_plan ->> 'ai_image_quota', '')::integer, 0);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_number', 'message', 'Un des nombres saisis est invalide.');
  END;

  IF v_monthly IS NULL OR v_monthly < 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_price', 'message', 'Le prix mensuel doit être d''au moins 200 FCFA (minimum du prestataire de paiement).');
  END IF;
  IF v_annual IS NOT NULL AND v_annual < v_monthly * 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_price', 'message', 'Le prix annuel doit être d''au moins 5 fois le prix mensuel.');
  END IF;
  IF v_max < 0 OR v_max > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_max_shops', 'message', 'Le nombre de boutiques doit être compris entre 0 et 100.');
  END IF;
  IF v_video < 0 OR v_video > 10000 OR v_image < 0 OR v_image > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quota', 'message', 'Les quotas IA doivent être compris entre 0 et 10 000.');
  END IF;

  v_features := COALESCE(p_plan -> 'features', '[]'::jsonb);
  IF jsonb_typeof(v_features) <> 'array' OR jsonb_array_length(v_features) > 30
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_features) e WHERE jsonb_typeof(e) <> 'string' OR length(e #>> '{}') > 200) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_features', 'message', 'Fonctionnalités : 30 lignes de texte au plus, 200 caractères chacune.');
  END IF;

  SELECT * INTO v_old FROM public.subscription_plans WHERE code = v_code FOR UPDATE;

  INSERT INTO public.subscription_plans
    (code, name, description, badge, price_monthly, price_annual, max_shops, ai_video_quota, ai_image_quota,
     features, is_active, is_public, sort_order, updated_at, updated_by)
  VALUES
    (v_code, v_name, NULLIF(btrim(COALESCE(p_plan ->> 'description', '')), ''), NULLIF(btrim(COALESCE(p_plan ->> 'badge', '')), ''),
     v_monthly, v_annual, v_max, v_video, v_image, v_features,
     COALESCE((p_plan ->> 'is_active')::boolean, true), COALESCE((p_plan ->> 'is_public')::boolean, true),
     COALESCE(NULLIF(p_plan ->> 'sort_order', '')::integer, 0), now(), v_uid)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, badge = EXCLUDED.badge,
    price_monthly = EXCLUDED.price_monthly, price_annual = EXCLUDED.price_annual, max_shops = EXCLUDED.max_shops,
    ai_video_quota = EXCLUDED.ai_video_quota, ai_image_quota = EXCLUDED.ai_image_quota, features = EXCLUDED.features,
    is_active = EXCLUDED.is_active, is_public = EXCLUDED.is_public, sort_order = EXCLUDED.sort_order,
    updated_at = now(), updated_by = v_uid
  RETURNING * INTO v_new;

  INSERT INTO public.billing_config_audit (kind, key, old_value, new_value, changed_by)
  VALUES ('plan', v_code, CASE WHEN v_old.code IS NULL THEN NULL ELSE to_jsonb(v_old) END, to_jsonb(v_new), v_uid);

  -- Hausse du nombre de boutiques incluses : couverture immédiate. Une baisse ne retire rien avant le renouvellement.
  IF v_old.code IS NOT NULL AND v_new.max_shops > v_old.max_shops THEN
    SELECT array_agg(user_id) INTO v_users
      FROM public.subscriptions
     WHERE plan_code = v_code AND status = 'active' AND end_date > now();
    IF v_users IS NOT NULL THEN
      FOREACH v_uid2 IN ARRAY v_users LOOP
        PERFORM public.apply_subscription_coverage(v_uid2, false);
        v_synced := v_synced + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan', to_jsonb(v_new), 'accounts_resynced', v_synced);
END;
$$;
REVOKE ALL ON FUNCTION public.founder_save_subscription_plan(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_save_subscription_plan(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.founder_save_billing_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_old jsonb;
  v_num numeric;
  v_min numeric;
  v_max numeric;
  v_changed text[] := ARRAY[]::text[];
  v_per_order numeric;
  v_threshold numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT (public.has_role(v_uid, 'founder') OR public.has_role(v_uid, 'co_founder')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  FOR r IN SELECT key, value FROM jsonb_each(p_settings) LOOP
    CASE r.key
      WHEN 'commission_per_order'       THEN v_min := 0;   v_max := 10000;
      WHEN 'commission_threshold'       THEN v_min := 100; v_max := 10000000;
      WHEN 'payment_deadline_days'      THEN v_min := 1;   v_max := 30;
      WHEN 'subscription_grace_days'    THEN v_min := 0;   v_max := 30;
      WHEN 'subscription_reminder_days' THEN v_min := 0;   v_max := 30;
      ELSE RETURN jsonb_build_object('success', false, 'error', 'unknown_setting', 'message', 'Réglage inconnu : ' || r.key);
    END CASE;
    IF jsonb_typeof(r.value) <> 'number' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_number', 'message', r.key || ' : nombre attendu.');
    END IF;
    v_num := (r.value #>> '{}')::numeric;
    IF v_num <> trunc(v_num) OR v_num < v_min OR v_num > v_max THEN
      RETURN jsonb_build_object('success', false, 'error', 'out_of_range',
                                'message', format('%s : entier entre %s et %s attendu.', r.key, v_min::bigint, v_max::bigint));
    END IF;
  END LOOP;

  FOR r IN SELECT key, value FROM jsonb_each(p_settings) LOOP
    SELECT value INTO v_old FROM public.billing_settings WHERE key = r.key;
    IF v_old IS DISTINCT FROM r.value THEN
      INSERT INTO public.billing_settings (key, value, updated_at, updated_by)
      VALUES (r.key, r.value, now(), v_uid)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = v_uid;
      INSERT INTO public.billing_config_audit (kind, key, old_value, new_value, changed_by)
      VALUES ('setting', r.key, v_old, r.value, v_uid);
      v_changed := array_append(v_changed, r.key);
    END IF;
  END LOOP;

  -- Les boutiques suivent le nouveau montant et le nouveau seuil (lus par les RPC de règlement et les écrans)
  v_per_order := public.billing_setting_numeric('commission_per_order', 50);
  v_threshold := public.billing_setting_numeric('commission_threshold', 12000);
  IF 'commission_per_order' = ANY (v_changed) OR 'commission_threshold' = ANY (v_changed) THEN
    UPDATE public.shops
       SET commission_per_order = v_per_order, commission_threshold = v_threshold
     WHERE commission_per_order IS DISTINCT FROM v_per_order OR commission_threshold IS DISTINCT FROM v_threshold;
  END IF;

  RETURN jsonb_build_object('success', true, 'changed', to_jsonb(v_changed));
END;
$$;
REVOKE ALL ON FUNCTION public.founder_save_billing_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_save_billing_settings(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. Lectures : couverture du marchand connecté, aperçu fondateur
-- ---------------------------------------------------------------------------------------------------------------
-- Pour les écrans marchand : combien de boutiques le plan couvre, lesquelles le sont, et la commission des autres.
CREATE OR REPLACE FUNCTION public.get_my_shop_coverage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub record;
  v_plan_name text;
  v_plan_max int;
  v_max int;
  v_active boolean;
  v_shops jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT plan_code, end_date, status INTO v_sub FROM public.subscriptions WHERE user_id = v_uid;
  v_active := FOUND AND v_sub.status = 'active' AND v_sub.end_date > now();
  IF v_sub.plan_code IS NOT NULL THEN
    SELECT name, max_shops INTO v_plan_name, v_plan_max FROM public.subscription_plans WHERE code = v_sub.plan_code;
  END IF;
  v_max := CASE WHEN v_active THEN v_plan_max END;

  -- within_plan : le rang de la boutique (la plus ancienne = 1) tient dans les boutiques incluses du plan du compte.
  -- Sans plan connu, toutes les boutiques sont réputées dans la limite.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'business_name', x.business_name,
           'covered', COALESCE(x.is_subscribed, false) AND x.subscription_active_until > now(),
           'within_plan', CASE WHEN v_plan_max IS NULL THEN true ELSE x.rank <= v_plan_max END
         ) ORDER BY x.created_at, x.id), '[]'::jsonb)
    INTO v_shops
    FROM (
      SELECT s.*, row_number() OVER (ORDER BY s.created_at, s.id) AS rank
        FROM public.shops s WHERE s.user_id = v_uid
    ) x;

  RETURN jsonb_build_object(
    'authenticated', true,
    'subscription_active', v_active,
    'plan_code', CASE WHEN v_active THEN v_sub.plan_code END,
    'plan_name', v_plan_name,
    'max_shops', v_max,
    'active_until', CASE WHEN v_active THEN v_sub.end_date END,
    'commission_per_order', public.billing_setting_numeric('commission_per_order', 50),
    'shops', v_shops
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_shop_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_shop_coverage() TO authenticated, service_role;

-- Aperçu fondateur : abonnés par plan, comptes ayant plus de boutiques que la limite
CREATE OR REPLACE FUNCTION public.founder_subscription_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'founder') OR public.has_role(v_uid, 'co_founder')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'code', p.code,
               'active_accounts', (SELECT count(*) FROM public.subscriptions s
                                    WHERE s.plan_code = p.code AND s.status = 'active' AND s.end_date > now()),
               'accounts_over_limit', (SELECT count(*) FROM public.subscriptions s
                                        WHERE s.plan_code = p.code AND s.status = 'active' AND s.end_date > now()
                                          AND (SELECT count(*) FROM public.shops sh WHERE sh.user_id = s.user_id) > p.max_shops),
               'shops_on_commission', (SELECT count(*) FROM public.subscriptions s
                                        JOIN public.shops sh ON sh.user_id = s.user_id
                                       WHERE s.plan_code = p.code AND s.status = 'active' AND s.end_date > now()
                                         AND NOT (COALESCE(sh.is_subscribed, false) AND sh.subscription_active_until > now()))
             ) ORDER BY p.sort_order, p.code)
        FROM public.subscription_plans p), '[]'::jsonb),
    'total_shops', (SELECT count(*) FROM public.shops),
    'shops_on_commission', (SELECT count(*) FROM public.shops
                             WHERE NOT (COALESCE(is_subscribed, false) AND subscription_active_until > now()))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.founder_subscription_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_subscription_overview() TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 10. Reprise de l'existant : le plan des comptes déjà abonnés (aucune re-synchronisation : une couverture payée
--     n'est jamais retirée rétroactivement).
-- ---------------------------------------------------------------------------------------------------------------
UPDATE public.subscriptions s
   SET plan_code = x.subscription_plan
  FROM (
    SELECT DISTINCT ON (user_id) user_id, subscription_plan
      FROM public.shops
     WHERE subscription_plan IN (SELECT code FROM public.subscription_plans)
       AND subscription_active_until IS NOT NULL
     ORDER BY user_id, subscription_active_until DESC
  ) x
 WHERE s.user_id = x.user_id AND s.plan_code IS NULL;
