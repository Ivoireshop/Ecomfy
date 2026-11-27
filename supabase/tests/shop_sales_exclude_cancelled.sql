-- Test de 20261127120000_shop_sales_exclude_cancelled.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_sales_exclude_cancelled.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.
-- Les déclencheurs de commande (facturation, compteurs) restent actifs.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
CREATE FUNCTION pg_temp.counters(s uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS
$$ SELECT total_orders || '/' || total_sales::bigint FROM public.shops WHERE id = s $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_s uuid; v_a uuid; v_b uuid; v_balance numeric;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test');
  ALTER TABLE public.shops DISABLE TRIGGER USER;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Revenus', 'revenus-test') RETURNING id INTO v_s;
  ALTER TABLE public.shops ENABLE TRIGGER USER;

  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total)
  VALUES (v_s, 'R-1', 'C', '0700000001', 1000) RETURNING id INTO v_a;
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total)
  VALUES (v_s, 'R-2', 'C', '0700000001', 200) RETURNING id INTO v_b;
  PERFORM pg_temp.chk('nouvelles commandes comptées', pg_temp.counters(v_s) = '2/1200', pg_temp.counters(v_s));
  SELECT commission_balance_due INTO v_balance FROM public.shops WHERE id = v_s;
  PERFORM pg_temp.chk('commission toujours ajoutée par commande', v_balance > 0, v_balance::text);

  UPDATE public.orders SET order_status = 'cancelled' WHERE id = v_b;
  PERFORM pg_temp.chk('annulée : retirée des revenus, pas du nombre', pg_temp.counters(v_s) = '2/1000', pg_temp.counters(v_s));
  UPDATE public.orders SET order_status = 'returned' WHERE id = v_a;
  PERFORM pg_temp.chk('retournée : retirée des revenus', pg_temp.counters(v_s) = '2/0', pg_temp.counters(v_s));
  UPDATE public.orders SET order_status = 'delivered' WHERE id = v_a;
  PERFORM pg_temp.chk('rétablie : de nouveau comptée', pg_temp.counters(v_s) = '2/1000', pg_temp.counters(v_s));

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.orders SET order_status = 'confirmed' WHERE id = v_b;
  RESET ROLE;
  PERFORM pg_temp.chk('statut changé par le marchand', pg_temp.counters(v_s) = '2/1200', pg_temp.counters(v_s));

  -- Un enregistrement des réglages qui renvoie le montant inchangé reste accepté.
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.shops SET business_name = 'Revenus 2', total_sales = total_sales WHERE id = v_s;
    RESET ROLE;
    PERFORM pg_temp.chk('montant renvoyé inchangé : accepté', pg_temp.counters(v_s) = '2/1200', pg_temp.counters(v_s));
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    PERFORM pg_temp.chk('montant renvoyé inchangé : accepté', false, SQLERRM);
  END;
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.shops SET total_sales = 99999999 WHERE id = v_s;
    RESET ROLE;
    PERFORM pg_temp.chk('faux montant du marchand : refusé', false, pg_temp.counters(v_s));
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('faux montant du marchand : refusé', true);
  END;

  -- Écriture d'administration : la valeur est recalculée.
  UPDATE public.shops SET total_sales = 5 WHERE id = v_s;
  PERFORM pg_temp.chk('toute écriture recalcule le montant', pg_temp.counters(v_s) = '2/1200', pg_temp.counters(v_s));

  -- Reprise d'une boutique enregistrée avec les annulées.
  UPDATE public.orders SET order_status = 'cancelled' WHERE id = v_b;
  ALTER TABLE public.shops DISABLE TRIGGER zz_shops_set_total_sales;
  UPDATE public.shops SET total_sales = 1200 WHERE id = v_s;
  ALTER TABLE public.shops ENABLE TRIGGER zz_shops_set_total_sales;
  UPDATE public.shops s SET total_sales = s.total_sales WHERE s.total_sales IS DISTINCT FROM public.shop_sales_total(s.id);
  PERFORM pg_temp.chk('reprise des montants existants', pg_temp.counters(v_s) = '2/1000', pg_temp.counters(v_s));

  DELETE FROM public.orders WHERE id = v_a;
  PERFORM pg_temp.chk('suppression', pg_temp.counters(v_s) = '1/0', pg_temp.counters(v_s));

  PERFORM pg_temp.chk('fonctions inaccessibles aux clients',
    NOT has_function_privilege('authenticated', 'public.shop_sales_total(uuid)', 'execute')
    AND NOT has_function_privilege('anon', 'public.shop_sales_total(uuid)', 'execute'));
END $$;

DO $$
DECLARE r record; total int; bad int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT ok) INTO total, bad FROM _t;
  FOR r IN SELECT * FROM _t ORDER BY n LOOP
    RAISE NOTICE '% % %', CASE WHEN r.ok THEN 'OK   ' ELSE 'ECHEC' END, r.label, CASE WHEN r.ok THEN '' ELSE r.detail END;
  END LOOP;
  RAISE EXCEPTION 'Fin du test : % cas (% échecs) — annulation volontaire', total, bad;
END $$;
