-- Facturation boutique (23/10/2026) : les échéances de paiement sont enfin appliquées par le serveur.
--
-- enforce_shop_payment_state_for (payment_pending -> locked -> final_suspension) n'était appelée que par le navigateur
-- du marchand (useShopPaymentStatus) : une boutique en retard dont le propriétaire n'ouvre jamais son tableau de
-- bord n'était jamais verrouillée. Cette migration ajoute une fonction qui parcourt les boutiques échues et une
-- tâche planifiée toutes les 5 minutes. La règle elle-même (délais, conditions) reste celle de
-- enforce_shop_payment_state_for : rien n'est changé à ce qui est verrouillé, seulement à QUAND.
--
-- ATTENTION effet unique au premier passage : toute boutique déjà en retard (solde > 0 et échéance dépassée) sera
-- verrouillée dans les 5 minutes. Voir la requête de contrôle dans docs/DEPLOIEMENT-FACTURATION-2026-10.md.
-- Idempotent. Sans pg_cron, seule la fonction est créée.

CREATE OR REPLACE FUNCTION public.enforce_all_shop_payment_states()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_changed integer := 0;
  v_res jsonb;
BEGIN
  FOR r IN
    SELECT s.id
      FROM public.shops s
     WHERE COALESCE(s.commission_balance_due, 0) > 0
       AND (
            (s.shop_payment_status = 'payment_pending'
              AND s.first_deadline_at IS NOT NULL AND s.first_deadline_at < now())
         OR (s.shop_payment_status = 'locked'
              AND s.second_deadline_at IS NOT NULL AND s.second_deadline_at < now()
              AND NOT (COALESCE(s.extra_deadline_active, false)
                       AND s.extra_deadline_ends_at IS NOT NULL AND s.extra_deadline_ends_at > now()))
       )
  LOOP
    v_res := public.enforce_shop_payment_state_for(r.id);
    IF v_res ? 'changed' AND v_res->>'changed' IS NOT NULL THEN
      v_changed := v_changed + 1;
    END IF;
  END LOOP;
  RETURN v_changed;
END $$;

REVOKE ALL ON FUNCTION public.enforce_all_shop_payment_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_all_shop_payment_states() TO service_role;

DO $$
DECLARE v_jobid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'enforce-shop-payment-deadlines';
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;
    PERFORM cron.schedule(
      'enforce-shop-payment-deadlines',
      '*/5 * * * *',
      $cron$ SELECT public.enforce_all_shop_payment_states(); $cron$
    );
  END IF;
END $$;
