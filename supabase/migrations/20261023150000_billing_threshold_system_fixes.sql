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
