-- Test de 20261127130000_shop_orders_statistics.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_orders_statistics.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
-- « nombre/montant » d'une période.
CREATE FUNCTION pg_temp.cur(r jsonb) RETURNS text LANGUAGE sql AS
$$ SELECT (r->>'count') || '/' || (r->>'revenue')::numeric::bigint $$;
CREATE FUNCTION pg_temp.prev(r jsonb) RETURNS text LANGUAGE sql AS
$$ SELECT (r->>'previous_count') || '/' || (r->>'previous_revenue')::numeric::bigint $$;
-- Ligne d'un jour de shop_finance_daily : commandes/validées/livrées/CA/encaissé.
CREATE FUNCTION pg_temp.fin(r jsonb, wanted date) RETURNS text LANGUAGE sql AS
$$ SELECT COALESCE((SELECT concat_ws('/', e->>'count', e->>'confirmed_count', e->>'delivered_count',
     (e->>'revenue')::numeric::bigint, (e->>'cash_in')::numeric::bigint)
     FROM jsonb_array_elements(r) e WHERE e->>'day' = to_char(wanted, 'YYYY-MM-DD')), '') $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid(); v_market uuid := gen_random_uuid();
  v_s uuid; v_empty uuid; v_locked uuid; v_p uuid; v_p2 uuid; v_o uuid; v_o2 uuid;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_base timestamptz;
  r jsonb; e jsonb; t text; n int;
BEGIN
  -- Aujourd'hui à 00:00:01 UTC : toujours dans le passé et dans le jour courant.
  v_base := (v_today + time '00:00:01') AT TIME ZONE 'UTC';
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test'), (v_x, 'autre@prod.test'),
    (v_reader, 'lecture@prod.test'), (v_market, 'marketing@prod.test');

  ALTER TABLE public.shops DISABLE TRIGGER USER;
  ALTER TABLE public.products DISABLE TRIGGER USER;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  ALTER TABLE public.order_items DISABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators DISABLE TRIGGER USER;

  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Stats', 'stats-test') RETURNING id INTO v_s;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Vide', 'stats-vide') RETURNING id INTO v_empty;
  INSERT INTO public.shops (user_id, business_name, slug, shop_payment_status) VALUES (v_owner, 'Bloquee', 'stats-bloquee', 'locked') RETURNING id INTO v_locked;
  INSERT INTO public.products (shop_id, name, slug, price) VALUES (v_s, 'Sac', 'sac', 1000) RETURNING id INTO v_p;
  INSERT INTO public.products (shop_id, name, slug, price) VALUES (v_s, 'Pochette', 'pochette', 300) RETURNING id INTO v_p2;
  INSERT INTO public.shop_collaborators (shop_id, user_id, invited_email, roles, status, invitation_token, invited_by)
  VALUES (v_s, v_reader, 'lecture@prod.test', ARRAY['view_orders'], 'active', gen_random_uuid()::text, v_owner),
         (v_s, v_market, 'marketing@prod.test', ARRAY['manage_catalog'], 'active', gen_random_uuid()::text, v_owner);

  -- Aujourd'hui : livrée payée (CI par le nom), nouvelle non payée (CI par le téléphone), payée d'avance, annulée.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_country, total, order_status, payment_status, created_at)
  VALUES (v_s, 'S-1', 'C', '+2250700000001', 'Côte d''Ivoire', 1000, 'delivered', 'paid', v_base) RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o, v_p, 'Sac ancien nom', 1, 400, 400), (v_o, v_p2, 'Pochette', 2, 300, 600);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_country, total, order_status, payment_status, created_at)
  VALUES (v_s, 'S-2', 'C', '+2250700000002', NULL, 2000, 'new', 'pending', v_base + interval '1 second') RETURNING id INTO v_o2;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o2, v_p, 'Sac', 2, 1000, 2000);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_country, total, order_status, payment_status, created_at)
  VALUES (v_s, 'S-3', 'C', '+2210700000003', NULL, 4000, 'confirmed', 'paid', v_base + interval '2 seconds');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, payment_status, created_at)
  VALUES (v_s, 'S-4', 'C', '1', 8000, 'cancelled', 'pending', v_base + interval '3 seconds') RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o, v_p, 'Sac', 9, 1, 8000);
  -- J-6 (dans « 7 jours »), J-7 (période précédente), J-13 (précédente), J-14 (hors précédente), J-40, J-200.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, payment_status, created_at)
  VALUES (v_s, 'S-5', 'C', '1', 10, 'delivered', 'refunded', v_base - interval '6 days'),
         (v_s, 'S-6', 'C', '1', 20, 'delivered', 'pending', v_base - interval '7 days'),
         (v_s, 'S-7', 'C', '1', 40, 'new', 'pending', v_base - interval '13 days'),
         (v_s, 'S-8', 'C', '1', 80, 'new', 'pending', v_base - interval '14 days'),
         (v_s, 'S-9', 'C', '1', 160, 'delivered', 'pending', v_base - interval '40 days'),
         (v_s, 'S-10', 'C', '1', 320, 'shipped', 'pending', v_base - interval '200 days'),
         (v_s, 'S-11', 'C', '1', 640, 'returned', 'pending', v_base - interval '1 day');
  -- Plus de 1 000 commandes encaissées anciennes.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, payment_status, created_at)
  SELECT v_s, 'A-' || g, 'C', '1', 1, 'delivered', 'paid', v_base - interval '300 days' + (g || ' seconds')::interval FROM generate_series(1, 1100) g;
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, payment_status, created_at)
  VALUES (v_locked, 'L-1', 'Secret', '+2250799999999', 300, 'delivered', 'paid', v_base) RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (v_o, v_p, 'Article', 1, 300, 300);

  ALTER TABLE public.shops ENABLE TRIGGER USER;
  ALTER TABLE public.products ENABLE TRIGGER USER;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  ALTER TABLE public.order_items ENABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  r := public.shop_order_statistics(v_s, 'today');
  PERFORM pg_temp.chk('aujourd''hui, annulée exclue', pg_temp.cur(r) = '3/7000', pg_temp.cur(r));
  PERFORM pg_temp.chk('hier comme période précédente (retournée exclue)', pg_temp.prev(r) = '0/0', pg_temp.prev(r));
  PERFORM pg_temp.chk('en attente : ni livrée ni payée', (r->>'awaiting_total')::numeric = 2000, r->>'awaiting_total');
  PERFORM pg_temp.chk('heures', r->'hours' = jsonb_build_array(jsonb_build_object('hour', 0, 'count', 3, 'total', (r->'hours'->0->>'total')::numeric))
    AND (r->'hours'->0->>'total')::numeric = 7000, (r->'hours')::text);
  PERFORM pg_temp.chk('un seul jour', jsonb_array_length(r->'days') = 1, (r->'days')::text);

  r := public.shop_order_statistics(v_s, '7d');
  PERFORM pg_temp.chk('7 jours : de J-6 à aujourd''hui', pg_temp.cur(r) = '4/7010', pg_temp.cur(r));
  PERFORM pg_temp.chk('période précédente : de J-13 à J-7', pg_temp.prev(r) = '2/60', pg_temp.prev(r));

  r := public.shop_order_statistics(v_s);
  PERFORM pg_temp.chk('30 jours par défaut', pg_temp.cur(r) = '7/7150', pg_temp.cur(r));
  PERFORM pg_temp.chk('précédente sur 30 jours : J-40', pg_temp.prev(r) = '1/160', pg_temp.prev(r));

  r := public.shop_order_statistics(v_s, 'all');
  PERFORM pg_temp.chk('tout, au-delà de 1 000', pg_temp.cur(r) = '1109/' || (7150 + 160 + 320 + 1100), pg_temp.cur(r));
  PERFORM pg_temp.chk('tout : pas de période précédente', pg_temp.prev(r) = '0/0', pg_temp.prev(r));
  PERFORM pg_temp.chk('première commande', (r->>'first_order_at')::timestamptz = v_base - interval '300 days' + interval '1 second', r->>'first_order_at');
  PERFORM pg_temp.chk('courbe limitée à 90 jours',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'days') d WHERE (d->>'day')::date < v_today - 89), (r->'days')::text);
  PERFORM pg_temp.chk('ventes du mois', (r->>'month_revenue')::numeric >= 7000, r->>'month_revenue');

  r := public.shop_order_statistics(v_s, 'today');
  SELECT x INTO e FROM jsonb_array_elements(r->'countries') x WHERE x->>'country' = 'Côte d''Ivoire';
  PERFORM pg_temp.chk('pays renseigné', (e->>'count')::int = 1 AND (e->>'total')::numeric = 1000, (r->'countries')::text);
  PERFORM pg_temp.chk('sans pays : groupes par indicatif, avec un numéro',
    (SELECT count(*) FROM jsonb_array_elements(r->'countries') x WHERE x->>'country' IS NULL) = 2
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->'countries') x WHERE x->>'phone' = '+2210700000003'), (r->'countries')::text);
  SELECT x INTO e FROM jsonb_array_elements(r->'products') x WHERE x->>'key' = v_p::text;
  PERFORM pg_temp.chk('produit : quantités, montant et nom le plus récent (annulée exclue)',
    (e->>'quantity')::int = 3 AND (e->>'revenue')::numeric = 2400 AND e->>'name' = 'Sac', (r->'products')::text);
  PERFORM pg_temp.chk('un groupe par produit', jsonb_array_length(r->'products') = 2
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->'products') x WHERE x->>'key' = v_p2::text AND (x->>'quantity')::int = 2), (r->'products')::text);

  r := public.shop_order_statistics(v_s, 'today', 'Asia/Tokyo');
  PERFORM pg_temp.chk('heure du fuseau demandé', (r->'hours'->0->>'hour')::int = 9 OR (r->>'count')::int = 0, (r->'hours')::text);
  r := public.shop_order_statistics(v_s, 'today', 'Nulle/Part');
  PERFORM pg_temp.chk('fuseau inconnu : UTC', pg_temp.cur(r) = '3/7000', pg_temp.cur(r));
  r := public.shop_order_statistics(v_empty, 'all');
  PERFORM pg_temp.chk('boutique sans commande', pg_temp.cur(r) = '0/0' AND r->'days' = '[]'::jsonb AND r->'products' = '[]'::jsonb AND r->>'first_order_at' IS NULL, r::text);

  r := public.shop_finance_daily(v_s);
  PERFORM pg_temp.chk('finance du jour (annulée comptée dans le nombre)', pg_temp.fin(r, v_today) = '4/2/1/5000/1000', pg_temp.fin(r, v_today));
  PERFORM pg_temp.chk('remboursée : validée, pas encaissée', pg_temp.fin(r, v_today - 6) = '1/1/1/10/0', pg_temp.fin(r, v_today - 6));
  PERFORM pg_temp.chk('livrée en attente de paiement : encaissée', pg_temp.fin(r, v_today - 40) = '1/1/1/160/160', pg_temp.fin(r, v_today - 40));
  PERFORM pg_temp.chk('tout l''historique', (SELECT sum((d->>'count')::int) FROM jsonb_array_elements(r) d) = 1111,
    (SELECT sum((d->>'count')::int) FROM jsonb_array_elements(r) d)::text);

  SELECT count(*) INTO n FROM public.shop_cashed_orders(v_s);
  PERFORM pg_temp.chk('encaissées : tout l''historique', n = 1103, n::text);
  SELECT string_agg(order_number, '|') INTO t FROM public.shop_cashed_orders(v_s, v_today - 40);
  PERFORM pg_temp.chk('encaissées depuis une date, de la plus ancienne à la plus récente', t = 'S-9|S-6|S-1', t);
  SELECT count(*) INTO n FROM (SELECT * FROM public.shop_cashed_orders(v_s) LIMIT 1000 OFFSET 1000) q;
  PERFORM pg_temp.chk('lecture par pages', n = 103, n::text);

  r := public.shop_order_statistics(v_locked, 'today');
  PERFORM pg_temp.chk('boutique restreinte : totaux conservés, ni articles ni téléphone',
    pg_temp.cur(r) = '1/300' AND r->'products' = '[]'::jsonb AND position('0799999999' in r::text) = 0, r::text);
  r := public.shop_finance_daily(v_locked);
  PERFORM pg_temp.chk('boutique restreinte : finances', pg_temp.fin(r, v_today) = '1/1/1/300/300', r::text);
  SELECT count(*) INTO n FROM public.shop_cashed_orders(v_locked);
  PERFORM pg_temp.chk('boutique restreinte : fiche comptable', n = 1, n::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_order_statistics(v_s, 'today');
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur « voir les commandes »', pg_temp.cur(r) = '3/7000', pg_temp.cur(r));

  PERFORM set_config('request.jwt.claim.sub', v_market::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_order_statistics(v_s, 'all');
  e := public.shop_finance_daily(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur sans droit sur les commandes : rien', pg_temp.cur(r) = '0/0' AND e = '[]'::jsonb, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_order_statistics(v_s, 'all');
  e := public.shop_finance_daily(v_s);
  SELECT count(*) INTO n FROM public.shop_cashed_orders(v_s);
  PERFORM pg_temp.chk('un étranger ne voit rien', pg_temp.cur(r) = '0/0' AND r->'products' = '[]'::jsonb AND e = '[]'::jsonb AND n = 0, r::text);
  BEGIN
    PERFORM public.shop_finance_daily(v_locked);
    PERFORM pg_temp.chk('étranger sur boutique restreinte : refusé', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.chk('étranger sur boutique restreinte : refusé', true);
  END;
  RESET ROLE;

  PERFORM pg_temp.chk('refusé sans connexion',
    NOT has_function_privilege('anon', 'public.shop_order_rows(uuid)', 'execute')
    AND NOT has_function_privilege('anon', 'public.shop_order_statistics(uuid,text,text)', 'execute')
    AND NOT has_function_privilege('anon', 'public.shop_finance_daily(uuid,text)', 'execute')
    AND NOT has_function_privilege('anon', 'public.shop_cashed_orders(uuid,date,text)', 'execute'));
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
