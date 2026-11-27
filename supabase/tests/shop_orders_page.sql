-- Test de 20261127140000_shop_orders_page.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_orders_page.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
-- Références des commandes d'une réponse, dans l'ordre reçu.
CREATE FUNCTION pg_temp.refs(r jsonb) RETURNS text LANGUAGE sql AS
$$ SELECT COALESCE(string_agg(e->>'order_number', '|' ORDER BY o), '') FROM jsonb_array_elements(r->'rows') WITH ORDINALITY AS x(e, o) $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid(); v_market uuid := gen_random_uuid();
  v_s uuid; v_s2 uuid; v_big uuid; v_locked uuid; v_p uuid; v_o uuid;
  v_today date := DATE '2026-11-27';
  r jsonb; t text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test'), (v_x, 'autre@prod.test'),
    (v_reader, 'lecture@prod.test'), (v_market, 'marketing@prod.test');

  ALTER TABLE public.shops DISABLE TRIGGER USER;
  ALTER TABLE public.products DISABLE TRIGGER USER;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  ALTER TABLE public.order_items DISABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators DISABLE TRIGGER USER;

  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Liste', 'liste-test') RETURNING id INTO v_s;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_x, 'Voisine', 'liste-voisine') RETURNING id INTO v_s2;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Grande', 'liste-grande') RETURNING id INTO v_big;
  INSERT INTO public.shops (user_id, business_name, slug, shop_payment_status) VALUES (v_owner, 'Bloquee', 'liste-bloquee', 'locked') RETURNING id INTO v_locked;
  INSERT INTO public.products (shop_id, name, slug, price) VALUES (v_s, 'Sac', 'sac', 1000) RETURNING id INTO v_p;
  INSERT INTO public.shop_collaborators (shop_id, user_id, invited_email, roles, status, invitation_token, invited_by)
  VALUES (v_s, v_reader, 'lecture@prod.test', ARRAY['view_orders'], 'active', gen_random_uuid()::text, v_owner),
         (v_s, v_market, 'marketing@prod.test', ARRAY['manage_catalog'], 'active', gen_random_uuid()::text, v_owner);

  -- O-1 (la plus ancienne) : date dans la colonne = aujourd'hui.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_city, scheduled_delivery_date, created_at)
  VALUES (v_s, 'O-1', 'Aïcha Koné', '+2250700000001', 'Bouaké', v_today, now() - interval '5 days') RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o, v_p, 'Sac', 1, 1000, 1000), (v_o, v_p, 'Sac', 2, 1000, 2000);
  -- O-2 : date seulement dans les notes (balise) = demain.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_email, notes, created_at)
  VALUES (v_s, 'O-2', 'Binta', '+2250700000002', 'binta@mail.test', '[Livraison Prévue: 2026-11-28] sonner deux fois', now() - interval '4 days');
  -- O-3 : colonne prioritaire sur la balise.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, scheduled_delivery_date, notes, created_at)
  VALUES (v_s, 'O-3', 'Cheick', '0700000003', DATE '2026-12-05', '[LIVRAISON PRÉVUE: 2026-11-27]', now() - interval '3 days');
  -- O-4 : sans date, note interne ; O-5 : sans rien, adresse.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, internal_delivery_note, created_at)
  VALUES (v_s, 'O-4', 'Dia', '0700000004', 'Appeler le GARDIEN', now() - interval '2 days');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_address, created_at)
  VALUES (v_s, 'O-5', 'Eve', '0700000005', 'Rue 100% (Cocody)', now() - interval '1 day');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, scheduled_delivery_date)
  VALUES (v_s2, 'V-1', 'Aïcha Voisine', '1', v_today);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone) VALUES (v_locked, 'L-1', 'Secret', '2');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, created_at)
  SELECT v_big, 'G-' || g, 'C', '1', now() - (g || ' minutes')::interval FROM generate_series(1, 1200) g;

  ALTER TABLE public.shops ENABLE TRIGGER USER;
  ALTER TABLE public.products ENABLE TRIGGER USER;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  ALTER TABLE public.order_items ENABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  r := public.shop_orders_page(v_s, _today => v_today);
  PERFORM pg_temp.chk('de la plus récente à la plus ancienne', pg_temp.refs(r) = 'O-5|O-4|O-3|O-2|O-1', pg_temp.refs(r));
  PERFORM pg_temp.chk('totaux', (r->>'total')::int = 5 AND (r->>'shop_total')::int = 5 AND NOT (r->>'restricted')::boolean, r::text);
  PERFORM pg_temp.chk('compteurs de livraison', r->'counts' = '{"today":1,"tomorrow":1,"scheduled":3,"unscheduled":2}'::jsonb, (r->'counts')::text);
  PERFORM pg_temp.chk('numéro d''ordre : la plus ancienne est la 1',
    (r->'rows'->0->>'sequence')::int = 5 AND (r->'rows'->4->>'sequence')::int = 1, r::text);
  PERFORM pg_temp.chk('articles joints', jsonb_array_length(r->'rows'->4->'order_items') = 2 AND r->'rows'->0->'order_items' = '[]'::jsonb, (r->'rows'->4)::text);
  PERFORM pg_temp.chk('toutes les colonnes de la commande',
    (r->'rows'->0) ?& array['customer_address','payment_method','payment_status','is_read','notes','scheduled_delivery_date','products_summary'], (r->'rows'->0)::text);

  r := public.shop_orders_page(v_s, _today => v_today, _limit => 2, _offset => 2);
  PERFORM pg_temp.chk('deuxième page, numéros conservés', pg_temp.refs(r) = 'O-3|O-2' AND (r->'rows'->0->>'sequence')::int = 3 AND (r->>'total')::int = 5, r::text);
  r := public.shop_orders_page(v_s, _today => v_today, _limit => 2, _offset => 40);
  PERFORM pg_temp.chk('page au-delà : vide avec le total', r->'rows' = '[]'::jsonb AND (r->>'total')::int = 5, r::text);

  r := public.shop_orders_page(v_s, _delivery => 'today', _today => v_today);
  PERFORM pg_temp.chk('aujourd''hui', pg_temp.refs(r) = 'O-1' AND (r->>'total')::int = 1 AND (r->>'shop_total')::int = 5, pg_temp.refs(r));
  r := public.shop_orders_page(v_s, _delivery => 'tomorrow', _today => v_today);
  PERFORM pg_temp.chk('demain (balise des notes)', pg_temp.refs(r) = 'O-2', pg_temp.refs(r));
  r := public.shop_orders_page(v_s, _delivery => 'scheduled', _today => v_today);
  PERFORM pg_temp.chk('planifiées', pg_temp.refs(r) = 'O-3|O-2|O-1', pg_temp.refs(r));
  r := public.shop_orders_page(v_s, _delivery => 'unscheduled', _today => v_today);
  PERFORM pg_temp.chk('non planifiées', pg_temp.refs(r) = 'O-5|O-4', pg_temp.refs(r));
  PERFORM pg_temp.chk('les compteurs ignorent le filtre', (r->'counts'->>'scheduled')::int = 3, (r->'counts')::text);

  r := public.shop_orders_page(v_s, _search => '  AICHA kone ');
  PERFORM pg_temp.chk('recherche par nom sans accents', pg_temp.refs(r) = 'O-1' AND (r->'rows'->0->>'sequence')::int = 1, pg_temp.refs(r));
  PERFORM pg_temp.chk('recherche par ville', pg_temp.refs(public.shop_orders_page(v_s, _search => 'bouake')) = 'O-1');
  PERFORM pg_temp.chk('recherche par référence', pg_temp.refs(public.shop_orders_page(v_s, _search => 'o-4')) = 'O-4');
  PERFORM pg_temp.chk('recherche par téléphone', pg_temp.refs(public.shop_orders_page(v_s, _search => '0700000003')) = 'O-3');
  PERFORM pg_temp.chk('recherche par e-mail', pg_temp.refs(public.shop_orders_page(v_s, _search => 'binta@')) = 'O-2');
  PERFORM pg_temp.chk('recherche dans les notes', pg_temp.refs(public.shop_orders_page(v_s, _search => 'sonner')) = 'O-2');
  PERFORM pg_temp.chk('recherche dans la note interne', pg_temp.refs(public.shop_orders_page(v_s, _search => 'gardien')) = 'O-4');
  PERFORM pg_temp.chk('« % » et parenthèses sont ordinaires',
    pg_temp.refs(public.shop_orders_page(v_s, _search => '100% (')) = 'O-5' AND (public.shop_orders_page(v_s, _search => '%%')->>'total')::int = 0);
  r := public.shop_orders_page(v_s, _search => 'aicha', _delivery => 'unscheduled', _today => v_today);
  PERFORM pg_temp.chk('recherche et filtre combinés', (r->>'total')::int = 0, r::text);

  r := public.shop_orders_page(v_big, _limit => 20, _offset => 1180);
  PERFORM pg_temp.chk('au-delà de 1 000 commandes', (r->>'total')::int = 1200 AND jsonb_array_length(r->'rows') = 20
    AND (r->'rows'->19->>'sequence')::int = 1 AND r->'rows'->19->>'order_number' = 'G-1200', pg_temp.refs(r));
  r := public.shop_orders_page(v_big, _limit => 5000);
  PERFORM pg_temp.chk('limite plafonnée à 1 000', jsonb_array_length(r->'rows') = 1000, jsonb_array_length(r->'rows')::text);

  r := public.shop_orders_page(v_locked);
  PERFORM pg_temp.chk('boutique restreinte : signalée, aucune ligne', (r->>'restricted')::boolean AND r->'rows' = '[]'::jsonb AND position('Secret' in r::text) = 0, r::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_page(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur « voir les commandes »', (r->>'total')::int = 5 AND jsonb_array_length(r->'rows'->4->'order_items') = 2, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_market::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_page(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur sans droit sur les commandes : rien', (r->>'total')::int = 0 AND r->'rows' = '[]'::jsonb, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_page(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('un étranger ne voit rien', (r->>'total')::int = 0 AND (r->>'shop_total')::int = 0 AND r->'rows' = '[]'::jsonb, r::text);

  PERFORM pg_temp.chk('refusé sans connexion',
    NOT has_function_privilege('anon', 'public.shop_orders_page(uuid,text,text,date,integer,integer)', 'execute'));
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
