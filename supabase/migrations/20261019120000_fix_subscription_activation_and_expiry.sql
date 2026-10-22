-- Correctif prod : un abonnement payé n'était pas appliqué à la boutique (commission de 50 FCFA toujours facturée),
-- et un abonnement échu n'était jamais constaté (ni rappel, ni fermeture).
--
-- Causes constatées en production (22/10/2026) :
--   * 20260524 : apply_shop_subscription n'acceptait que starter / business / premium. « pro_monthly » (plan vendu sur
--     /pricing) renvoyait invalid_plan, ignoré par verify-payment : argent encaissé, rien d'activé.
--   * 20261015130000 (H7) : la fonction a été remplacée par une version qui écrit shops.is_subscribed, colonne créée
--     seulement par 20260911/20260912, jamais appliquées en production : la fonction plantait à chaque abonnement.
--
-- Cette migration est AUTONOME : elle ne suppose aucune migration de facturation (20260909/11/12) ni shop_invoices.
-- Règle unique : une boutique est abonnée si, et seulement si, shops.subscription_active_until > now().
-- Aucune autre colonne ne fait foi (is_subscribed n'est qu'un reflet pour la compatibilité).
--
-- Idempotente. Les droits d'exécution de apply_shop_subscription (service_role seul, audit C2) sont conservés par
-- CREATE OR REPLACE.

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Colonnes attendues (certaines n'existent pas en production)
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_subscribed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_deadline_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_deadline_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_deadline_ends_at timestamptz;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Paramètres de la règle (modifiables par CREATE OR REPLACE, sans toucher au reste)
-- ---------------------------------------------------------------------------------------------------------------

-- Délai de grâce après l'échéance : bandeau « renouvelez », pas de commission, boutique encore ouverte.
CREATE OR REPLACE FUNCTION public.subscription_grace_interval()
RETURNS interval
LANGUAGE sql IMMUTABLE
AS $$ SELECT interval '3 days' $$;

-- Taux de commission d'une boutique sans abonnement (valeur par défaut de shops.commission_rate).
CREATE OR REPLACE FUNCTION public.subscription_default_commission_rate()
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$ SELECT 0.025::numeric $$;

-- Date à partir de laquelle l'échéance d'un abonnement entraîne la fermeture. Les abonnements échus AVANT cette date
-- (anciens abonnés repassés à la commission) ne sont jamais fermés rétroactivement. Fixée une seule fois, à
-- l'application de la migration.
DO $$
BEGIN
  IF to_regprocedure('public.subscription_enforcement_start()') IS NULL THEN
    EXECUTE format(
      'CREATE FUNCTION public.subscription_enforcement_start() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $f$ SELECT %L::timestamptz $f$',
      now()
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Règle unique « abonnement actif »
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_shop_subscription_active(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT subscription_active_until > now() FROM public.shops WHERE id = p_shop_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. apply_shop_subscription : activation / renouvellement d'un abonnement payé
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_shop_subscription(
  p_shop_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_plan text DEFAULT 'pro_monthly',
  p_amount numeric DEFAULT 0,
  p_transaction_reference text DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_shop_id uuid;
  v_shop record;
  v_existing uuid;
  v_new_until timestamptz;
  v_normalized_plan text;
  v_duration_interval interval := interval '30 days';
  v_has_ref boolean := p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '';
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

  -- Durée : le cycle de facturation n'est pas transmis par les métadonnées du paiement. Les montants sont fixés par
  -- le serveur (pricing.ts, correctif C6) : seul un paiement annuel (118 800 / 342 000 FCFA) atteint 100 000 FCFA.
  IF v_normalized_plan LIKE '%annual%' OR v_normalized_plan LIKE '%year%' OR COALESCE(p_amount, 0) >= 100000 THEN
    v_duration_interval := interval '365 days';
  END IF;

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
    -- Abonnement de compte sans boutique (p_shop_id absent) : seule la ligne `subscriptions` est servie.
    -- Pas de cumul, donc rejouable sans effet supplémentaire.
    IF p_shop_id IS NULL AND p_user_id IS NOT NULL THEN
      v_new_until := now() + v_duration_interval;
      UPDATE public.subscriptions
         SET status = 'active', plan = v_normalized_plan, amount = COALESCE(p_amount, 0),
             start_date = now(), end_date = v_new_until, updated_at = now()
       WHERE user_id = p_user_id;
      IF NOT FOUND THEN
        INSERT INTO public.subscriptions (user_id, status, plan, amount, start_date, end_date, created_at, updated_at)
        VALUES (p_user_id, 'active', v_normalized_plan, COALESCE(p_amount, 0), now(), v_new_until, now(), now());
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

  -- Renouvellement : cumul tant que l'abonnement court, sinon à partir de maintenant
  IF v_shop.subscription_active_until IS NOT NULL AND v_shop.subscription_active_until > now() THEN
    v_new_until := v_shop.subscription_active_until + v_duration_interval;
  ELSE
    v_new_until := now() + v_duration_interval;
  END IF;

  UPDATE public.shops
     SET subscription_plan = v_normalized_plan,
         subscription_started_at = COALESCE(subscription_started_at, now()),
         subscription_active_until = v_new_until,
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

  IF v_has_ref THEN
    INSERT INTO public.commission_payments (
      shop_id, amount, payment_method, transaction_reference, status, created_by, notes
    ) VALUES (
      v_target_shop_id, COALESCE(p_amount, 0),
      COALESCE(NULLIF(p_payment_method, ''), 'geniuspay'),
      p_transaction_reference, 'paid', COALESCE(p_user_id, v_shop.user_id),
      'Abonnement ' || v_normalized_plan
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Trace, avec le solde effacé (permet de le rétablir si le fondateur change d'avis)
  INSERT INTO public.shop_payment_events (shop_id, event_type, amount, note)
  VALUES (
    v_target_shop_id, 'subscription_activated', COALESCE(p_amount, 0),
    format('Abonnement %s jusqu''au %s (réf %s). Solde de commission effacé : %s FCFA. Ancienne fin : %s.',
           v_normalized_plan, to_char(v_new_until, 'YYYY-MM-DD HH24:MI'), COALESCE(p_transaction_reference, '-'),
           v_shop.balance_due::text, COALESCE(to_char(v_shop.subscription_active_until, 'YYYY-MM-DD HH24:MI'), 'aucune'))
  );

  -- Accès utilisateur (table subscriptions) : mise à jour de la ligne existante, sinon création
  IF p_user_id IS NOT NULL THEN
    UPDATE public.subscriptions
       SET status = 'active', plan = v_normalized_plan, amount = COALESCE(p_amount, 0),
           start_date = now(), end_date = v_new_until, updated_at = now()
     WHERE user_id = p_user_id;
    IF NOT FOUND THEN
      INSERT INTO public.subscriptions (user_id, status, plan, amount, start_date, end_date, created_at, updated_at)
      VALUES (p_user_id, 'active', v_normalized_plan, COALESCE(p_amount, 0), now(), v_new_until, now(), now());
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_normalized_plan,
    'shop_id', v_target_shop_id,
    'active_until', v_new_until
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. sync_shop_order_stats : pas de commission pour un abonné (délai de grâce compris)
--    Reprise de la version de 20260701091528 (celle de la production), seule la condition d'exemption change.
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
        SET payment_deadline = now() + interval '3 days',
            threshold_reached_at = now(),
            first_deadline_at = now() + interval '3 days',
            shop_payment_status = 'payment_pending'
        WHERE id = target_shop_id;

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (target_shop_id, 'threshold_reached', v_new_balance,
              'Seuil de 12 000 FCFA atteint - 3 jours pour régler');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Fin d'abonnement : constat, délai de grâce, puis fermeture de l'espace propriétaire
--    (même mécanisme que le non-paiement : shop_payment_status = 'locked' + is_suspended, la boutique publique
--    continue de vendre ; le renouvellement rouvre aussitôt).
-- ---------------------------------------------------------------------------------------------------------------

-- Traite une boutique. Retourne 'none' | 'expired' | 'locked'.
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
           -- Pas d'échéance : le verrouillage ne s'aggrave pas en fermeture définitive, seul le renouvellement le lève.
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

-- Tâche planifiée (service_role) : toutes les boutiques concernées.
CREATE OR REPLACE FUNCTION public.enforce_subscription_expiry()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_res text;
  v_expired int := 0;
  v_locked int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.shops
     WHERE subscription_active_until IS NOT NULL
       AND subscription_active_until <= now()
       AND subscription_active_until >= public.subscription_enforcement_start()
       AND (
         COALESCE(is_subscribed, false) = true
         OR COALESCE(commission_rate, 1) = 0
         OR (subscription_active_until + public.subscription_grace_interval() <= now()
             AND shop_payment_status NOT IN ('locked', 'final_suspension'))
       )
  LOOP
    v_res := public.enforce_subscription_expiry_one(r.id);
    IF v_res = 'expired' THEN v_expired := v_expired + 1;
    ELSIF v_res = 'locked' THEN v_locked := v_locked + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'locked', v_locked);
END;
$$;

-- À la lecture : le propriétaire (ou un fondateur) peut déclencher la vérification de SA boutique, sans attendre le cron.
CREATE OR REPLACE FUNCTION public.enforce_subscription_expiry_for(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = auth.uid())
     AND NOT (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder')) THEN
    RETURN 'none';
  END IF;
  RETURN public.enforce_subscription_expiry_one(_shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_subscription_expiry_one(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_expiry_one(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_subscription_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_expiry() TO service_role;
REVOKE ALL ON FUNCTION public.enforce_subscription_expiry_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_expiry_for(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_shop_subscription_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_subscription_active(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Planification quotidienne (pg_cron), si l'extension est disponible
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron absent : planifier public.enforce_subscription_expiry() autrement (voir le guide de déploiement).';
    RETURN;
  END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'enforce-subscription-expiry';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule('enforce-subscription-expiry', '*/30 * * * *', $cron$ SELECT public.enforce_subscription_expiry(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification impossible (%) : à faire manuellement.', SQLERRM;
END $$;
