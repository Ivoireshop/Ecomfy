-- Test de supabase/migrations/20261023150000_billing_threshold_system_fixes.sql (23/10/2026).
-- Reconstruit le système de facturation par seuil dans une transaction annulée (absent de dev), applique la migration, puis teste.
-- Lancer sur dev :  npx supabase db query --linked -f supabase/tests/billing_threshold_system.sql   (rapport dans l'exception finale ; tout est annulé)
-- Attendu : tous les champs 'ok' / *_ok / a_* / b_* / c_* à true.
-- ===== PRÉREQUIS : sections 1 à 5 de 20260909100000 =====
-- Migration: Ecomfy Billing Threshold System (240 Orders / 12,000 FCFA), Grace Period & STORE_RESTRICTED Partial Lock

-- 1. Create shop_invoices table
CREATE TABLE IF NOT EXISTS public.shop_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  orders_threshold integer NOT NULL DEFAULT 240,
  amount numeric NOT NULL DEFAULT 12000,
  currency text NOT NULL DEFAULT 'FCFA',
  status text NOT NULL DEFAULT 'PAYMENT_DUE',
  created_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  paid_at timestamptz,
  payment_reference text,
  payment_method text,
  reactivated_at timestamptz,
  CONSTRAINT shop_invoices_status_check CHECK (
    status IN ('PAYMENT_DUE', 'GRACE_PERIOD', 'PAYMENT_OVERDUE', 'STORE_RESTRICTED', 'PAYMENT_CONFIRMED', 'CANCELLED')
  ),
  CONSTRAINT shop_invoices_unique_threshold UNIQUE (shop_id, orders_threshold)
);

-- Grant RLS permissions
GRANT SELECT ON public.shop_invoices TO authenticated;
GRANT ALL ON public.shop_invoices TO service_role;
ALTER TABLE public.shop_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners read own invoices" ON public.shop_invoices;
CREATE POLICY "Shop owners read own invoices"
  ON public.shop_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'co_founder')
  );

DROP POLICY IF EXISTS "Founders manage all invoices" ON public.shop_invoices;
CREATE POLICY "Founders manage all invoices"
  ON public.shop_invoices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE INDEX IF NOT EXISTS idx_shop_invoices_shop ON public.shop_invoices(shop_id, status);

-- 2. Update shops payment status constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_payment_status_check'
  ) THEN
    ALTER TABLE public.shops DROP CONSTRAINT shops_payment_status_check;
  END IF;
  
  ALTER TABLE public.shops
    ADD CONSTRAINT shops_payment_status_check
    CHECK (shop_payment_status IN (
      'STORE_ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'PAYMENT_OVERDUE', 
      'STORE_RESTRICTED', 'PAYMENT_CONFIRMED', 'STORE_REACTIVATED',
      'active', 'payment_pending', 'locked', 'final_suspension'
    ));
END $$;

-- 3. Function: Check & Trigger Billing Threshold (240 Orders = 12 000 FCFA)
CREATE OR REPLACE FUNCTION public.check_and_trigger_billing_threshold(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actual_orders int;
  v_shop_status text;
  v_invoice_id uuid;
  v_invoice_num text;
  v_threshold int := 240;
  v_amount numeric := 12000;
BEGIN
  IF _shop_id IS NULL THEN
    RETURN jsonb_build_object('triggered', false, 'reason', 'invalid_shop_id');
  END IF;

  -- Count actual non-cancelled orders for shop
  SELECT COUNT(*) INTO v_actual_orders
    FROM public.orders
   WHERE shop_id = _shop_id;

  SELECT shop_payment_status INTO v_shop_status
    FROM public.shops
   WHERE id = _shop_id;

  -- Check if threshold of 240 orders is reached
  IF v_actual_orders >= v_threshold THEN
    -- Check if invoice already exists for 240 threshold
    SELECT id INTO v_invoice_id
      FROM public.shop_invoices
     WHERE shop_id = _shop_id AND orders_threshold = v_threshold;

    IF v_invoice_id IS NULL THEN
      -- Generate unique invoice number
      v_invoice_num := 'BILL-ECOMFY-' || lpad(floor(random() * 899999 + 100000)::text, 6, '0');

      INSERT INTO public.shop_invoices (
        invoice_number,
        shop_id,
        orders_threshold,
        amount,
        currency,
        status,
        due_date
      ) VALUES (
        v_invoice_num,
        _shop_id,
        v_threshold,
        v_amount,
        'FCFA',
        'PAYMENT_DUE',
        now() + interval '3 days'
      ) RETURNING id INTO v_invoice_id;

      -- Update shop status to PAYMENT_DUE with 3-day grace period
      UPDATE public.shops
         SET shop_payment_status = 'PAYMENT_DUE',
             payment_deadline = now() + interval '3 days',
             threshold_reached_at = now(),
             first_deadline_at = now() + interval '3 days',
             commission_balance_due = v_amount,
             updated_at = now()
       WHERE id = _shop_id;

      -- Log payment event
      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (
        _shop_id, 
        'BILLING_THRESHOLD_REACHED', 
        v_amount, 
        'Seuil de 240 commandes atteint (Facture ' || v_invoice_num || ') — 12 000 FCFA dû sous 3 jours'
      );

      RETURN jsonb_build_object('triggered', true, 'invoice_number', v_invoice_num, 'status', 'PAYMENT_DUE');
    END IF;
  END IF;

  RETURN jsonb_build_object('triggered', false, 'orders_count', v_actual_orders);
END $$;

-- 4. Trigger on orders table to check threshold after order insertion
CREATE OR REPLACE FUNCTION public.trg_on_order_inserted_billing_check()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_trigger_billing_threshold(NEW.shop_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_billing_threshold_check ON public.orders;
CREATE TRIGGER trg_order_billing_threshold_check
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_order_inserted_billing_check();

-- 5. Auto-escalation function: Enforce 3-day grace period deadline
CREATE OR REPLACE FUNCTION public.enforce_shop_billing_deadlines()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_restricted_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT s.id, s.shop_payment_status, i.id AS invoice_id, i.invoice_number
      FROM public.shops s
      LEFT JOIN public.shop_invoices i ON i.shop_id = s.id AND i.orders_threshold = 240
     WHERE s.shop_payment_status IN ('PAYMENT_DUE', 'GRACE_PERIOD', 'payment_pending')
       AND s.payment_deadline IS NOT NULL
       AND s.payment_deadline < now()
  LOOP
    -- Update shop status to STORE_RESTRICTED (partial lock)
    UPDATE public.shops
       SET shop_payment_status = 'STORE_RESTRICTED',
           locked_at = now(),
           is_suspended = true,
           updated_at = now()
     WHERE id = r.id;

    -- Update invoice status
    IF r.invoice_id IS NOT NULL THEN
      UPDATE public.shop_invoices
         SET status = 'STORE_RESTRICTED'
       WHERE id = r.invoice_id;
    END IF;

    -- Log payment event
    INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
    VALUES (
      r.id, 
      'STORE_RESTRICTED', 
      12000, 
      'Délai de 3 jours écoulé sans règlement — Boutique temporairement restreinte'
    );

    v_restricted_count := v_restricted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('restricted_shops_count', v_restricted_count);
END $$;

-- ===== MIGRATION TESTÉE =====
-- Facturation par seuil (23/10/2026) : correctifs à appliquer APRÈS 20260909100000 (et ses suites 20260912000000,
-- 20261003120000, 20261022150000) si ce système est déployé. Sans la table shop_invoices, cette migration ne fait rien.
-- Elle redéfinit les fonctions plutôt que de modifier les anciens fichiers (déjà appliqués ailleurs).
--
-- 1. Ordre des déclencheurs : trg_order_billing_threshold_check s'exécutait AVANT trigger_sync_shop_stats (ordre
--    alphabétique). À la 240e commande le solde était fixé à 12 000 puis la commission de 50 de cette commande
--    s'y ajoutait : facture de 12 000 mais solde de 12 050. Le contrôle passe après la synchronisation.
-- 2. check_and_trigger_billing_threshold :
--    - ne remplace plus le solde par 12 000 (les règlements partiels déjà faits étaient effacés) ; il n'impose
--      12 000 que si aucun solde n'a été accumulé ;
--    - une facture par palier de 240 commandes (240, 480, ...) et non une seule par boutique à vie : à partir du
--      second cycle plus rien n'était facturé ni restreint côté serveur ;
--    - la dispense d'abonné ne lit plus shops.is_subscribed (colonne absente en production, la fonction échouait).
-- 3. enforce_shop_billing_deadlines : ne restreint plus une boutique dont le solde est nul (la facture restait
--    ouverte alors que l'interface affichait « boutique active »), referme toutes les factures ouvertes de la
--    boutique, journalise le solde réel au lieu de 12 000 ; remet « active » une boutique en délai sans solde.
--    Elle est planifiée toutes les 5 minutes (avant : seulement appelée par le navigateur) et retirée aux
--    utilisateurs connectés.
-- 4. check_and_trigger_billing_threshold n'est plus exécutable par anon.

DO $outer$
BEGIN
  IF to_regclass('public.shop_invoices') IS NULL THEN
    RAISE NOTICE 'shop_invoices absente : facturation par seuil non déployée, rien à corriger.';
    RETURN;
  END IF;

  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.check_and_trigger_billing_threshold(_shop_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
  DECLARE
    v_actual_orders int;
    v_cycle_threshold int;
    v_invoice_id uuid;
    v_invoice_num text;
    v_base constant int := 240;
    v_amount constant numeric := 12000;
    v_sub_until timestamptz;
    v_balance numeric;
  BEGIN
    IF _shop_id IS NULL THEN
      RETURN jsonb_build_object('triggered', false, 'reason', 'invalid_shop_id');
    END IF;

    SELECT subscription_active_until, COALESCE(commission_balance_due, 0)
      INTO v_sub_until, v_balance
      FROM public.shops WHERE id = _shop_id;

    -- Abonné actif : pas de facture de seuil
    IF v_sub_until IS NOT NULL AND v_sub_until > now() THEN
      RETURN jsonb_build_object('triggered', false, 'reason', 'active_subscription');
    END IF;

    SELECT COUNT(*) INTO v_actual_orders FROM public.orders WHERE shop_id = _shop_id;

    -- Palier courant : 240, 480, 720, ...
    v_cycle_threshold := (v_actual_orders / v_base) * v_base;

    IF v_cycle_threshold >= v_base THEN
      SELECT id INTO v_invoice_id FROM public.shop_invoices
       WHERE shop_id = _shop_id AND orders_threshold = v_cycle_threshold;

      IF v_invoice_id IS NULL THEN
        v_invoice_num := 'BILL-ECOMFY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

        INSERT INTO public.shop_invoices (invoice_number, shop_id, orders_threshold, amount, currency, status, due_date)
        VALUES (v_invoice_num, _shop_id, v_cycle_threshold, v_amount, 'FCFA', 'PAYMENT_DUE', now() + interval '3 days')
        RETURNING id INTO v_invoice_id;

        UPDATE public.shops
           SET shop_payment_status = 'PAYMENT_DUE',
               payment_deadline = now() + interval '3 days',
               threshold_reached_at = now(),
               first_deadline_at = now() + interval '3 days',
               commission_balance_due = CASE WHEN COALESCE(commission_balance_due, 0) > 0 THEN commission_balance_due ELSE v_amount END,
               updated_at = now()
         WHERE id = _shop_id;

        INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
        VALUES (_shop_id, 'BILLING_THRESHOLD_REACHED', v_amount,
                'Seuil de ' || v_cycle_threshold || ' commandes atteint (Facture ' || v_invoice_num || ')');

        RETURN jsonb_build_object('triggered', true, 'invoice_number', v_invoice_num, 'status', 'PAYMENT_DUE', 'threshold', v_cycle_threshold);
      END IF;
    END IF;

    RETURN jsonb_build_object('triggered', false, 'orders_count', v_actual_orders);
  END $body$;
  $fn$;

  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.enforce_shop_billing_deadlines()
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
  DECLARE
    v_restricted_count int := 0;
    v_healed_count int := 0;
    r record;
  BEGIN
    -- Boutiques en délai sans aucun solde : rien à restreindre, on les remet en service.
    FOR r IN
      SELECT s.id FROM public.shops s
       WHERE s.shop_payment_status IN ('PAYMENT_DUE', 'GRACE_PERIOD')
         AND COALESCE(s.commission_balance_due, 0) <= 0
    LOOP
      UPDATE public.shops
         SET shop_payment_status = 'STORE_ACTIVE', payment_deadline = NULL, first_deadline_at = NULL,
             threshold_reached_at = NULL, updated_at = now()
       WHERE id = r.id;
      UPDATE public.shop_invoices
         SET status = 'CANCELLED'
       WHERE shop_id = r.id AND status IN ('PAYMENT_DUE', 'GRACE_PERIOD');
      v_healed_count := v_healed_count + 1;
    END LOOP;

    FOR r IN
      SELECT s.id, COALESCE(s.commission_balance_due, 0) AS balance
        FROM public.shops s
       WHERE s.shop_payment_status IN ('PAYMENT_DUE', 'GRACE_PERIOD', 'payment_pending')
         AND s.payment_deadline IS NOT NULL
         AND s.payment_deadline < now()
         AND COALESCE(s.commission_balance_due, 0) > 0
    LOOP
      UPDATE public.shops
         SET shop_payment_status = 'STORE_RESTRICTED', locked_at = now(), is_suspended = true, updated_at = now()
       WHERE id = r.id;

      UPDATE public.shop_invoices
         SET status = 'STORE_RESTRICTED'
       WHERE shop_id = r.id AND status IN ('PAYMENT_DUE', 'GRACE_PERIOD');

      INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note)
      VALUES (r.id, 'STORE_RESTRICTED', r.balance,
              'Délai de 3 jours écoulé sans règlement — Boutique temporairement restreinte');

      v_restricted_count := v_restricted_count + 1;
    END LOOP;

    RETURN jsonb_build_object('restricted_shops_count', v_restricted_count, 'healed_shops_count', v_healed_count);
  END $body$;
  $fn$;

  -- Le contrôle de seuil passe après la synchronisation des statistiques (voir en-tête, point 1).
  DROP TRIGGER IF EXISTS trg_order_billing_threshold_check ON public.orders;
  DROP TRIGGER IF EXISTS trigger_zz_order_billing_threshold_check ON public.orders;
  CREATE TRIGGER trigger_zz_order_billing_threshold_check
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.trg_on_order_inserted_billing_check();

  -- Droits : le seuil reste appelable par le marchand connecté (écran de facturation), jamais par anon ;
  -- les échéances sont appliquées par la tâche planifiée uniquement.
  REVOKE ALL ON FUNCTION public.check_and_trigger_billing_threshold(uuid) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.check_and_trigger_billing_threshold(uuid) TO authenticated, service_role;
  REVOKE ALL ON FUNCTION public.enforce_shop_billing_deadlines() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.enforce_shop_billing_deadlines() TO service_role;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'enforce-shop-billing-deadlines';
    PERFORM cron.schedule('enforce-shop-billing-deadlines', '*/5 * * * *',
                          $cron$ SELECT public.enforce_shop_billing_deadlines(); $cron$);
  END IF;
END $outer$;

-- ===== TEST =====
DO $$
DECLARE
  uid uuid := gen_random_uuid(); rep jsonb := '{}'::jsonb; i int; sh record; inv record; n int;
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  VALUES (uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','bill3@example.test','x',now(),'{}','{}',now(),now(),'','','','');
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate)
  VALUES (a, uid, 'Cycle', 'zz-thr-a', true, true, true, 0.05), (b, uid, 'Partiel', 'zz-thr-b', true, true, true, 0.05), (c, uid, 'Zero', 'zz-thr-c', true, true, true, 0.05);

  -- A : 239 commandes, pas de facture ; 240e : facture, solde exactement 12 000 (et non 12 050)
  FOR i IN 1..239 LOOP INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (a, 'TA-'||i, 'c', '0700000000'); END LOOP;
  SELECT count(*) INTO n FROM public.shop_invoices WHERE shop_id = a;
  rep := rep || jsonb_build_object('a_239_sans_facture', n = 0);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (a, 'TA-240', 'c', '0700000000');
  SELECT * INTO sh FROM public.shops WHERE id = a;
  SELECT count(*) INTO n FROM public.shop_invoices WHERE shop_id = a AND orders_threshold = 240;
  rep := rep || jsonb_build_object('a_240_facture_et_solde_12000', jsonb_build_object('ok', n = 1 AND sh.commission_balance_due = 12000 AND sh.shop_payment_status = 'PAYMENT_DUE', 'solde', sh.commission_balance_due, 'statut', sh.shop_payment_status, 'factures', n));
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (a, 'TA-241', 'c', '0700000000');
  SELECT count(*) INTO n FROM public.shop_invoices WHERE shop_id = a;
  rep := rep || jsonb_build_object('a_241_pas_de_nouvelle_facture', n = 1);

  -- A : règlement complet -> facture réglée ; 2e cycle : 480e commande -> 2e facture, boutique de nouveau en délai
  PERFORM public.apply_commission_payment(a, 12100, 'TEST-THR-A1', NULL, 'wave', 'test');
  SELECT * INTO inv FROM public.shop_invoices WHERE shop_id = a AND orders_threshold = 240;
  rep := rep || jsonb_build_object('a_facture_240_reglee', inv.status = 'PAYMENT_CONFIRMED');
  FOR i IN 242..480 LOOP INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (a, 'TA-'||i, 'c', '0700000000'); END LOOP;
  SELECT * INTO sh FROM public.shops WHERE id = a;
  SELECT count(*) INTO n FROM public.shop_invoices WHERE shop_id = a AND orders_threshold = 480;
  rep := rep || jsonb_build_object('a_cycle2_facture_480', jsonb_build_object('ok', n = 1 AND sh.shop_payment_status = 'PAYMENT_DUE' AND sh.commission_balance_due > 0, 'solde', sh.commission_balance_due, 'statut', sh.shop_payment_status));
  -- échéance dépassée -> restreinte par le serveur
  UPDATE public.shops SET payment_deadline = now() - interval '1 hour' WHERE id = a;
  PERFORM public.enforce_shop_billing_deadlines();
  SELECT * INTO sh FROM public.shops WHERE id = a;
  SELECT status INTO inv FROM public.shop_invoices WHERE shop_id = a AND orders_threshold = 480;
  rep := rep || jsonb_build_object('a_cycle2_restreinte', jsonb_build_object('ok', sh.shop_payment_status = 'STORE_RESTRICTED' AND sh.is_suspended AND inv.status = 'STORE_RESTRICTED', 'statut', sh.shop_payment_status));

  -- B : 100 commandes (5 000), règlement partiel de 3 000, puis 140 commandes : le solde n'est pas écrasé par 12 000
  FOR i IN 1..100 LOOP INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (b, 'TB-'||i, 'c', '0700000000'); END LOOP;
  PERFORM public.apply_commission_payment(b, 3000, 'TEST-THR-B1', NULL, 'wave', 'test');
  FOR i IN 101..240 LOOP INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (b, 'TB-'||i, 'c', '0700000000'); END LOOP;
  SELECT * INTO sh FROM public.shops WHERE id = b;
  rep := rep || jsonb_build_object('b_solde_conserve_apres_paiement_partiel', jsonb_build_object('ok', sh.commission_balance_due = 9000, 'solde', sh.commission_balance_due, 'statut', sh.shop_payment_status));

  -- C : en délai sans solde, échéance passée -> jamais restreinte, remise en service, facture annulée
  UPDATE public.shops SET commission_balance_due = 0, shop_payment_status = 'PAYMENT_DUE', payment_deadline = now() - interval '1 hour' WHERE id = c;
  INSERT INTO public.shop_invoices (invoice_number, shop_id, orders_threshold, status) VALUES ('BILL-TEST-C', c, 240, 'PAYMENT_DUE');
  PERFORM public.enforce_shop_billing_deadlines();
  SELECT * INTO sh FROM public.shops WHERE id = c;
  SELECT status INTO inv FROM public.shop_invoices WHERE shop_id = c;
  rep := rep || jsonb_build_object('c_solde_zero_non_restreinte', jsonb_build_object('ok', sh.shop_payment_status = 'STORE_ACTIVE' AND NOT sh.is_suspended AND inv.status = 'CANCELLED', 'statut', sh.shop_payment_status));

  -- Droits
  rep := rep || jsonb_build_object('droits', jsonb_build_object(
    'seuil_anon_refuse', NOT has_function_privilege('anon', 'public.check_and_trigger_billing_threshold(uuid)', 'EXECUTE'),
    'seuil_authenticated_ok', has_function_privilege('authenticated', 'public.check_and_trigger_billing_threshold(uuid)', 'EXECUTE'),
    'enforce_authenticated_refuse', NOT has_function_privilege('authenticated', 'public.enforce_shop_billing_deadlines()', 'EXECUTE'),
    'declencheur_apres_sync', (SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.orders'::regclass AND tgname LIKE '%billing%') > 'trigger_sync_shop_stats'));
  RAISE EXCEPTION 'RAPPORT %', rep::text;
END $$;
